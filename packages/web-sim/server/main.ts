import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { jwksUrl, loadSimEnv, publicConfig } from './env.ts';
import { createModelAuth } from './model-auth.ts';
import { bedrockBackend, clientKey, createModelHandler, createRateLimiter, mockBackend } from './model.ts';
import { sandboxDocument, sandboxHeaders } from './sandbox.ts';
import { createSkillLoader, resolveSkillPath } from './skill.ts';

/**
 * Two listeners:
 *  - the simulator page + /api (SIM_PORT): page assets, /api/config, /api/model
 *  - the MCP Apps sandbox proxy (SIM_SANDBOX_PORT), a separate origin by spec
 * In dev the page is served through Vite middleware; in production from dist/.
 */

const env = loadSimEnv();
const isProd = env.NODE_ENV === 'production';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hostOrigin = new URL(env.SIM_PUBLIC_ORIGIN).origin;
const sandboxOrigin = new URL(env.SIM_SANDBOX_ORIGIN).origin;
const mcpOrigin = new URL(env.SIM_MCP_URL).origin;
const issuerOrigin = new URL(env.AUTH_ISSUER).origin;

const skillPath = resolveSkillPath(env.SIM_SKILL_PATH);
const backend =
  env.SIM_MODEL_BACKEND === 'mock'
    ? mockBackend()
    : bedrockBackend({
        modelId: env.SIM_BEDROCK_MODEL_ID,
        region: env.SIM_BEDROCK_REGION ?? env.AWS_REGION,
        effort: env.SIM_MODEL_EFFORT,
        maxTokens: env.SIM_MAX_OUTPUT_TOKENS,
      });
const handleModel = createModelHandler({
  backend,
  system: createSkillLoader(skillPath),
  allowedOrigin: hostOrigin,
  rateLimit: createRateLimiter(env.SIM_RATE_LIMIT_PER_MIN, { globalPerMinute: env.SIM_GLOBAL_RATE_LIMIT_PER_MIN }),
  // With sign-in on, a model turn needs the person's MCP token (issued to this client).
  ...(env.SIM_AUTH_MODE === 'oauth'
    ? {
        auth: createModelAuth({
          issuer: env.AUTH_ISSUER.replace(/\/+$/, ''),
          audience: env.SIM_MCP_URL,
          clientId: env.OAUTH_SIM_CLIENT_ID,
          jwks: jwksUrl(env),
        }),
      }
    : {}),
});

function toRequest(req: IncomingMessage): Request {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(', '));
  }
  const abort = new AbortController();
  req.on('close', () => {
    if (!req.complete) abort.abort();
  });
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(new URL(req.url ?? '/', hostOrigin), {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
    signal: abort.signal,
    // Node's fetch Request needs this for a streamed body.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);
}

async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (!response.body) return void res.end();
  const reader = response.body.getReader();
  res.on('close', () => void reader.cancel().catch(() => {}));
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

const PAGE_CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval': CanvasKit (the GridFloor fallback) compiles WebAssembly.
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The MCP server and the authorization server (OAuth discovery, token exchange).
  `connect-src 'self' ${mcpOrigin} ${issuerOrigin}`,
  `frame-src ${sandboxOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const dist = join(root, 'dist');
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', hostOrigin).pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' });
    return void res.end('Bad path.');
  }
  const candidate = normalize(join(dist, pathname));
  const inside = candidate.startsWith(dist + '/') || candidate === dist;
  let file = inside && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(dist, 'index.html');
  if (!existsSync(file)) file = join(dist, 'index.html');
  const headers: Record<string, string> = {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  if (file.endsWith('index.html')) headers['content-security-policy'] = PAGE_CSP;
  else headers['cache-control'] = 'public, max-age=31536000, immutable';
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}

async function main(): Promise<void> {
  let viteMiddleware: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | null = null;
  if (!isProd) {
    const { createServer: createVite } = await import('vite');
    const vite = await createVite({ root, server: { middlewareMode: true }, appType: 'spa' });
    viteMiddleware = vite.middlewares;
  }

  const app = createServer((req, res) => {
    const url = new URL(req.url ?? '/', hostOrigin);
    const fail = (err: unknown) => {
      console.error('[web-sim]', err);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
    };
    if (url.pathname === '/api/config' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return void res.end(JSON.stringify(publicConfig(env)));
    }
    if (url.pathname === '/api/model') {
      const forwarded = req.headers['x-forwarded-for'];
      const key = clientKey(req.socket.remoteAddress, typeof forwarded === 'string' ? forwarded : null, env.SIM_TRUST_PROXY === '1');
      return void handleModel(toRequest(req), key).then((r) => sendResponse(res, r)).catch(fail);
    }
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return void res.end(JSON.stringify({ error: 'not_found' }));
    }
    if (viteMiddleware) return viteMiddleware(req, res, () => res.end());
    serveStatic(req, res);
  });

  const sandbox = createServer((req, res) => {
    const url = new URL(req.url ?? '/', sandboxOrigin);
    if (req.method === 'GET' && url.pathname === '/sandbox') {
      res.writeHead(200, sandboxHeaders(url.search, hostOrigin));
      return void res.end(sandboxDocument(hostOrigin));
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Only /sandbox is served on this origin.');
  });

  app.listen(env.SIM_PORT, () => {
    console.log(`[web-sim] simulator  ${hostOrigin}  (${isProd ? 'production' : 'dev'})`);
    console.log(`[web-sim] MCP server ${env.SIM_MCP_URL}  auth=${env.SIM_AUTH_MODE}`);
    console.log(`[web-sim] model      ${env.SIM_MODEL_BACKEND === 'mock' ? 'scripted mock' : env.SIM_BEDROCK_MODEL_ID}`);
    console.log(`[web-sim] skill      ${skillPath}`);
    if (env.SIM_AUTH_MODE === 'dev-bypass') console.warn('[web-sim] SIM_AUTH_MODE=dev-bypass: no sign-in. Local development only.');
  });
  sandbox.listen(env.SIM_SANDBOX_PORT, () => console.log(`[web-sim] sandbox    ${sandboxOrigin}`));
}

// Log, then exit: a process past an uncaught exception is in an unknown state.
// The supervisor (or the developer) restarts it.
process.on('uncaughtException', (err) => {
  console.error('[web-sim] uncaught exception, exiting', err);
  process.exit(1);
});

void main();
