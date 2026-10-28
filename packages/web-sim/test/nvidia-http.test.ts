import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { ModelBackend } from '../server/model.ts';
import { createModelHandler } from '../server/model.ts';
import { asrClientKey, nodeRequest, sendResponse } from '../server/nvidia-http.ts';
import { loadNvidiaEnv, nvidiaPublicConfig } from '../server/nvidia-env.ts';
import { nvidiaCsp } from '../server/nvidia-tts.ts';

/**
 * Barge-in on the NVIDIA companion: the page aborts its /api/model fetch, and
 * the server must stop the Nebius request it is waiting on. This runs the real
 * Node HTTP bridge nvidia-main.ts uses, with a backend that waits on its signal.
 */
let server: Server | null = null;
afterEach(() => {
  server?.close();
  server = null;
});

const base = { NEBIUS_API_KEY: 'k', V1_MCP_SERVICE_KEY: 'v'.repeat(32) };

async function serve(backend: ModelBackend) {
  let origin = '';
  server = createServer((req, res) => {
    const handle = createModelHandler({ backend, system: () => 'sys', allowedOrigin: origin, rateLimit: () => true });
    void handle(nodeRequest(req, origin), 'k').then((r) => sendResponse(res, r));
  });
  await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return origin;
}

describe('barge-in cancels the in-flight model turn', () => {
  it('aborts the backend request when the page aborts its fetch', async () => {
    let aborted: number | null = null;
    let started!: () => void;
    const begun = new Promise<void>((done) => (started = done));
    const backend: ModelBackend = {
      label: 'test',
      stream: (_p, _t, signal) =>
        new Promise((_resolve, reject) => {
          started();
          signal.addEventListener('abort', () => {
            aborted = performance.now();
            reject(signal.reason);
          });
        }),
    };
    const origin = await serve(backend);
    const page = new AbortController();
    // Nebius is buffered, so the turn's first SSE bytes come only at the end: the page aborts while waiting.
    const answer = fetch(`${origin}/api/model`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], tools: [] }),
      signal: page.signal,
    }).then((r) => r.text());
    await begun;
    const cut = performance.now();
    page.abort();
    await expect(answer).rejects.toThrow();
    for (let i = 0; i < 50 && aborted === null; i++) await new Promise((r) => setTimeout(r, 10));
    expect(aborted).not.toBeNull();
    expect(aborted! - cut).toBeLessThan(250);
  });
});

describe('NVIDIA ASR configuration', () => {
  it('reports Riva when NVIDIA_API_KEY is set, without publishing it', () => {
    const config = nvidiaPublicConfig(loadNvidiaEnv({ ...base, NVIDIA_API_KEY: 'nvapi-secret' }));
    expect(config.asr).toBe('riva');
    expect(JSON.stringify(config)).not.toContain('nvapi-secret');
  });

  it('reports the browser fallback without a key (empty counts as unset)', () => {
    expect(nvidiaPublicConfig(loadNvidiaEnv(base)).asr).toBe('browser');
    expect(nvidiaPublicConfig(loadNvidiaEnv({ ...base, NVIDIA_API_KEY: '' })).asr).toBe('browser');
  });

  it('lets the page open the /api/asr WebSocket on its own origin', () => {
    const csp = nvidiaCsp(loadNvidiaEnv({ ...base, NODE_ENV: 'test', SIM_PUBLIC_ORIGIN: 'http://localhost:5180' }));
    expect(csp).toContain('ws://localhost:5180');
    const prod = nvidiaCsp(loadNvidiaEnv({ ...base, SIM_PUBLIC_ORIGIN: 'https://mon.example', SIM_MCP_URL: 'https://mcp.example/mcp',
      AUTH_ISSUER: 'https://auth.example', V1_BASE_URL: 'https://auth.example' }));
    expect(prod).toContain('wss://mon.example');
    expect(prod).not.toContain('ws://');
  });

  it('keys the ASR rate limit on the first forwarded address behind the proxy', () => {
    expect(asrClientKey({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }, socket: { remoteAddress: '10.0.0.1' } })).toBe('203.0.113.9');
    expect(asrClientKey({ headers: {}, socket: { remoteAddress: '10.0.0.1' } })).toBe('10.0.0.1');
  });
});
