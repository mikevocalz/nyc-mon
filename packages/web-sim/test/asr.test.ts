import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createAsrSocket, type AsrEvent, type OpenAsrStream } from '../server/asr.ts';
import { isEcho, liveMicUrl } from '../src/client/liveMic.ts';

let server: Server | null = null;
afterEach(() => {
  server?.close();
  server = null;
});

/** A recognizer that records the PCM it got and lets the test emit events. */
function fakeRecognizer() {
  const got = { pcm: [] as Buffer[], ended: 0, emit: (_e: AsrEvent) => {} };
  const open: OpenAsrStream = (onEvent) => {
    got.emit = onEvent;
    return { write: (b) => got.pcm.push(b), end: () => void got.ended++ };
  };
  return { got, open };
}

async function listen(deps: Partial<Parameters<typeof createAsrSocket>[0]> & { open: OpenAsrStream }) {
  server = createServer();
  await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const upgrade = createAsrSocket({ allowedOrigin: origin, rateLimit: () => true, clientKey: () => 'k', ...deps });
  server.on('upgrade', (req, socket, head) => {
    if (!upgrade(req, socket, head)) socket.destroy();
  });
  return origin;
}

function connect(origin: string, headerOrigin = origin) {
  const ws = new WebSocket(`${origin.replace('http', 'ws')}/api/asr`, { headers: { origin: headerOrigin } });
  const messages: AsrEvent[] = [];
  ws.on('message', (d) => messages.push(JSON.parse(String(d)) as AsrEvent));
  const closed = new Promise<number>((done) => ws.on('close', (code) => done(code)));
  const opened = new Promise<void>((done, fail) => {
    ws.on('open', () => done());
    ws.on('error', fail);
  });
  const until = async (pred: () => boolean) => {
    for (let i = 0; i < 100 && !pred(); i++) await new Promise((r) => setTimeout(r, 10));
  };
  return { ws, messages, closed, opened, until };
}

describe('/api/asr socket', () => {
  it('refuses a page from another origin', async () => {
    const origin = await listen(fakeRecognizer());
    const c = connect(origin, 'https://evil.example');
    await expect(c.opened).rejects.toThrow(/403/);
  });

  it('relays PCM to the recognizer and its text back to the page', async () => {
    const { got, open } = fakeRecognizer();
    const origin = await listen({ open });
    const c = connect(origin);
    await c.opened;
    c.ws.send(JSON.stringify({ type: 'start', token: '' }));
    await c.until(() => c.messages.some((m) => m.type === 'ready'));
    c.ws.send(Buffer.alloc(3200, 1));
    await c.until(() => got.pcm.length > 0);
    expect(got.pcm[0]?.length).toBe(3200);
    got.emit({ type: 'interim', text: 'yo Lil' });
    got.emit({ type: 'final', text: "Yo Lil' Ratti, you good?" });
    await c.until(() => c.messages.length >= 3);
    expect(c.messages).toEqual([{ type: 'ready' }, { type: 'interim', text: 'yo Lil' }, { type: 'final', text: "Yo Lil' Ratti, you good?" }]);
    c.ws.close();
    await c.closed;
    await c.until(() => got.ended > 0);
    expect(got.ended).toBe(1);
  });

  it('closes without opening a recognizer when the sign-in check fails', async () => {
    const { got, open } = fakeRecognizer();
    let seen: string | null = 'unset';
    const origin = await listen({
      open,
      auth: async (h) => {
        seen = h;
        throw new Error('no');
      },
    });
    const c = connect(origin);
    await c.opened;
    c.ws.send(JSON.stringify({ type: 'start', token: 'abc' }));
    expect(await c.closed).toBe(1008);
    expect(seen).toBe('Bearer abc');
    expect(got.pcm).toEqual([]);
  });

  it('drops audio sent before the start message is accepted', async () => {
    const { got, open } = fakeRecognizer();
    const origin = await listen({ open });
    const c = connect(origin);
    await c.opened;
    c.ws.send(Buffer.alloc(3200));
    c.ws.send(JSON.stringify({ type: 'start' }));
    await c.until(() => c.messages.some((m) => m.type === 'ready'));
    expect(got.pcm).toEqual([]);
    c.ws.close();
  });
});

describe('live mic helpers', () => {
  const reply = 'Say less, Callah. That hit. Fullness is at 80 percent.';
  it('treats the Mon’s own words coming back through the mic as echo', () => {
    expect(isEcho('that hit fullness is at 80 percent', reply)).toBe(true);
  });
  it('lets the person cut in', () => {
    expect(isEcho('hold up is he asleep', reply)).toBe(false);
  });
  it('builds a same-origin socket URL', () => {
    expect(liveMicUrl({ protocol: 'https:', host: 'sim.example' })).toBe('wss://sim.example/api/asr');
    expect(liveMicUrl({ protocol: 'http:', host: 'localhost:5180' })).toBe('ws://localhost:5180/api/asr');
  });
});
