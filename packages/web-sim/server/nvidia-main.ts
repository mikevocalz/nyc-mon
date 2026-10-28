import { createServer, type IncomingMessage } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAsrSocket, createParakeetStream } from './asr.ts';
import { createModelAuth } from './model-auth.ts';
import { asrClientKey, nodeRequest, sendResponse } from './nvidia-http.ts';
import { createModelHandler, createRateLimiter } from './model.ts';
import { nebiusBackend } from './nebius.ts';
import { loadNvidiaEnv, nvidiaPublicConfig } from './nvidia-env.ts';
import { createNvidiaTts, nvidiaCsp } from './nvidia-tts.ts';
import { createMemoryClient, createMemoryProxy, withPersistentMemory } from './companion-memory-client.ts';
import { createSkillLoader, resolveSkillPath } from './skill.ts';

/** Focused NVIDIA route inside the existing simulator package. Bedrock/Alexa entry stays unchanged. */
const env = loadNvidiaEnv();
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const auth = createModelAuth({ issuer: env.AUTH_ISSUER.replace(/\/$/, ''), audience: env.SIM_MCP_URL,
  clientId: env.OAUTH_SIM_CLIENT_ID, jwks: `${env.AUTH_ISSUER.replace(/\/$/, '')}/payload-api/auth/jwks` });
const memory = createMemoryClient({ baseUrl: env.V1_BASE_URL, serviceKey: env.V1_MCP_SERVICE_KEY });
const backend = nebiusBackend({ apiKey: env.NEBIUS_API_KEY, baseUrl: env.NEBIUS_BASE_URL,
  modelId: env.SIM_NEBIUS_MODEL_ID, maxTokens: env.SIM_MAX_OUTPUT_TOKENS }, {
  onReceipt: (receipt) => console.info('[nvidia-runtime]', JSON.stringify(receipt)),
});
const system = createSkillLoader(resolveSkillPath(undefined));
const modelLimit = createRateLimiter(30, { globalPerMinute: 120 });
const memoryLimit = createRateLimiter(30, { globalPerMinute: 120 });
const memoryProxy = createMemoryProxy({ origin: new URL(env.SIM_PUBLIC_ORIGIN).origin, auth, memory, rateLimit: memoryLimit });
// The Mon's voice: same handler and sign-in as the simulator's /api/tts, its own rate limiter (nvidia-tts.ts).
const tts = createNvidiaTts(env, { auth, fetch });
const csp = nvidiaCsp(env);

const requestFrom = (req: IncomingMessage) => nodeRequest(req, env.SIM_PUBLIC_ORIGIN);
const send = sendResponse;
// Live speech-to-text (asr.ts): the page's echo-cancelled mic streams to NVIDIA Riva Parakeet over NVCF.
// No NVIDIA_API_KEY: /api/asr is closed and the page listens with the browser's SpeechRecognition.
const asrUpgrade = env.NVIDIA_API_KEY ? createAsrSocket({
  open: createParakeetStream({ apiKey: env.NVIDIA_API_KEY }),
  allowedOrigin: new URL(env.SIM_PUBLIC_ORIGIN).origin,
  // One session per listening window; a conversation opens one every turn or two.
  rateLimit: createRateLimiter(20, { globalPerMinute: 120 }),
  clientKey: asrClientKey,
  auth,
}) : null;
const mime: Record<string,string> = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml' };
async function start() {
  const vite = env.NODE_ENV === 'production' ? undefined : await (await import('vite')).createServer({ root, server: { middlewareMode: true }, appType: 'mpa' });
  const server = createServer((req,res) => {
    const path = new URL(req.url ?? '/', env.SIM_PUBLIC_ORIGIN).pathname;
    const fail = () => { if (!res.headersSent) res.writeHead(503, { 'content-type':'application/json' }); res.end('{"error":"unavailable"}'); };
    if (path === '/healthz' && req.method === 'GET') { res.writeHead(200, { 'content-type':'application/json' }); res.end('{"service":"nyc-mon-nvidia","provider":"nebius-token-factory"}'); return; }
    if (path === '/api/nvidia/config' && req.method === 'GET') { res.writeHead(200, { 'content-type':'application/json','cache-control':'no-store' }); res.end(JSON.stringify(nvidiaPublicConfig(env))); return; }
    if (path === '/api/model') {
      // Owner capture is request-local. Shared backend never stores one person's context for another.
      let owner: string | undefined;
      const handle = createModelHandler({
        backend: withPersistentMemory(backend,memory,() => owner), system, allowedOrigin: new URL(env.SIM_PUBLIC_ORIGIN).origin,
        auth: async (authorization) => { const actor = await auth(authorization); owner = actor.callerId; return actor; },
        rateLimit: () => modelLimit(owner ?? 'unauthenticated'),
      });
      void handle(requestFrom(req), req.socket.remoteAddress ?? 'unknown').then((r) => send(res,r)).catch(fail); return;
    }
    // POST /api/tts, and GET /api/tts/face/:id, mounted as server/main.ts mounts them.
    if (path === '/api/tts' || path.startsWith('/api/tts/face/')) { void tts(requestFrom(req), req.socket.remoteAddress ?? 'unknown').then((r) => send(res,r)).catch(fail); return; }
    if (path === '/api/memory') { void memoryProxy(requestFrom(req)).then((r) => send(res,r)).catch(fail); return; }
    if (path.startsWith('/api/')) { res.writeHead(404); res.end(); return; }
    if (path === '/') { res.writeHead(302, { location:'/nvidia.html' }); res.end(); return; }
    if (vite) { vite.middlewares(req,res,() => { res.writeHead(404);res.end(); }); return; }
    let file: string;
    try { file = resolve(dist, '.' + decodeURIComponent(path)); } catch { res.writeHead(400);res.end();return; }
    if (!file.startsWith(dist + sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404);res.end();return; }
    res.writeHead(200, { 'content-type':mime[extname(file)] ?? 'application/octet-stream',
      'content-security-policy':csp,'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
      'cache-control': file.endsWith('.html') ? 'no-store' : 'public, max-age=3600' });
    createReadStream(file).on('error',fail).pipe(res);
  });
  server.on('upgrade', (req, socket, head) => {
    if (asrUpgrade?.(req, socket, head)) return;
    // Vite's dev server takes its own HMR upgrades; anything else is closed.
    if (vite && new URL(req.url ?? '/', env.SIM_PUBLIC_ORIGIN).pathname !== '/api/asr') return;
    socket.destroy();
  });
  server.listen(env.SIM_PORT, env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => {
    console.info(`[nvidia] ${env.SIM_PUBLIC_ORIGIN}/nvidia.html; OAuth required; ${env.SIM_NEBIUS_MODEL_ID}; mic: ${asrUpgrade ? 'NVIDIA Riva Parakeet' : 'browser speech recognition (no NVIDIA_API_KEY)'}`);
  });
  for (const event of ['SIGTERM','SIGINT'] as const) process.on(event, () => { server.close(); void vite?.close(); });
}
void start().catch(() => { console.error('NVIDIA companion could not start; check nonsecret configuration and build.'); process.exitCode = 1; });
