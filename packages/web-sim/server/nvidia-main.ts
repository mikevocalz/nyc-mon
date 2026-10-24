import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createModelAuth } from './model-auth.ts';
import { createModelHandler, createRateLimiter } from './model.ts';
import { nebiusBackend } from './nebius.ts';
import { loadNvidiaEnv, nvidiaPublicConfig } from './nvidia-env.ts';
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
const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ${new URL(env.SIM_MCP_URL).origin} ${new URL(env.AUTH_ISSUER).origin}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`;

function requestFrom(req: IncomingMessage): Request {
  const headers = new Headers();
  for (const [key,value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key,value); else if (Array.isArray(value)) headers.set(key,value.join(', '));
  }
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Readable.toWeb(req);
  const controller = new AbortController(); req.on('aborted', () => controller.abort());
  return new Request(new URL(req.url ?? '/', env.SIM_PUBLIC_ORIGIN), {
    method: req.method, headers, signal: controller.signal,
    ...(body ? { body, duplex: 'half' } : {}),
  } as RequestInit);
}
async function send(res: ServerResponse, response: Response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) { res.end(); return; }
  const reader = response.body.getReader();
  res.on('close', () => { void reader.cancel().catch(() => {}); });
  try { for (;;) { const part = await reader.read(); if (part.done) break; res.write(part.value); } }
  finally { reader.releaseLock(); res.end(); }
}
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
  server.listen(env.SIM_PORT, env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => {
    console.info(`[nvidia] ${env.SIM_PUBLIC_ORIGIN}/nvidia.html; OAuth required; ${env.SIM_NEBIUS_MODEL_ID}`);
  });
  for (const event of ['SIGTERM','SIGINT'] as const) process.on(event, () => { server.close(); void vite?.close(); });
}
void start().catch(() => { console.error('NVIDIA companion could not start; check nonsecret configuration and build.'); process.exitCode = 1; });
