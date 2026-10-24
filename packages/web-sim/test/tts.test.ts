import { describe, expect, it, vi } from 'vitest';
import type { ModelAuthCheck } from '../server/model-auth.ts';
import { createRateLimiter } from '../server/model.ts';
import { createTtsHandler, ELEVENLABS_TTS_MODEL, MAX_TTS_TEXT, type TtsFetch } from '../server/tts.ts';

const ORIGIN = 'http://localhost:5180';
const LINEAGE = 'dex-001/female/1';
const AYLA = 'b8JMPeNuVrqqWExQc8e9';

const post = (body: unknown, origin: string | null = ORIGIN) =>
  new Request(`${ORIGIN}/api/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin === null ? {} : { origin }) },
    body: JSON.stringify(body),
  });

function fakeFetch(status = 200) {
  return vi.fn<TtsFetch>(async () => new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status, headers: { 'content-type': 'audio/mpeg' } }));
}

function handler(opts: { apiKey?: string; fetchFn?: TtsFetch; limit?: number; auth?: ModelAuthCheck } = {}) {
  return createTtsHandler({
    allowedOrigin: ORIGIN,
    rateLimit: createRateLimiter(opts.limit ?? 100),
    apiKey: 'apiKey' in opts ? opts.apiKey : 'test-key',
    fetch: opts.fetchFn ?? fakeFetch(),
    ...(opts.auth ? { auth: opts.auth } : {}),
  });
}

describe('/api/tts', () => {
  it('refuses other origins and a missing origin without calling ElevenLabs', async () => {
    const fetchFn = fakeFetch();
    const h = handler({ fetchFn });
    for (const origin of ['https://evil.example', 'null', 'http://localhost:5181', null]) {
      expect((await h(post({ text: 'hi', lineageId: LINEAGE, stage: 'Baby' }, origin), 'ip')).status, String(origin)).toBe(403);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('answers 204 without an API key, so the client falls back to Web Speech', async () => {
    const fetchFn = fakeFetch();
    const res = await handler({ apiKey: undefined, fetchFn })(post({ text: 'hi', lineageId: LINEAGE, stage: 'Baby' }), 'ip');
    expect(res.status).toBe(204);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('answers 204 for an Egg: an Egg does not speak', async () => {
    const fetchFn = fakeFetch();
    const res = await handler({ fetchFn })(post({ text: 'hi', lineageId: LINEAGE, stage: 'Egg' }), 'ip');
    expect(res.status).toBe(204);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('answers 204 for a lineage with no voice yet', async () => {
    const fetchFn = fakeFetch();
    const res = await handler({ fetchFn })(post({ text: 'hi', lineageId: 'dex-008/male/1', stage: 'Mid' }), 'ip');
    expect(res.status).toBe(204);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('calls ElevenLabs with the resolved voice, the key header and the flash model, and streams audio back', async () => {
    const fetchFn = fakeFetch();
    const res = await handler({ fetchFn })(post({ text: 'Hey there *short huff*', lineageId: LINEAGE, stage: 'Baby' }), 'ip');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 0x90]));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(String(url)).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${AYLA}?output_format=mp3_44100_128`);
    const headers = new Headers(init?.headers);
    expect(headers.get('xi-api-key')).toBe('test-key');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ text: 'Hey there short huff', model_id: ELEVENLABS_TTS_MODEL });
  });

  it('rejects text over the limit, an unknown stage and a malformed body', async () => {
    const fetchFn = fakeFetch();
    const h = handler({ fetchFn });
    expect((await h(post({ text: 'a'.repeat(MAX_TTS_TEXT + 1), lineageId: LINEAGE, stage: 'Baby' }), 'ip')).status).toBe(400);
    expect((await h(post({ text: 'hi', lineageId: LINEAGE, stage: 'Adult' }), 'ip')).status).toBe(400);
    expect((await h(post({ text: '', lineageId: LINEAGE, stage: 'Baby' }), 'ip')).status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rate-limits per client', async () => {
    const h = handler({ limit: 1 });
    expect((await h(post({ text: 'hi', lineageId: LINEAGE, stage: 'Baby' }), 'ip')).status).toBe(200);
    expect((await h(post({ text: 'hi', lineageId: LINEAGE, stage: 'Baby' }), 'ip')).status).toBe(429);
  });

  it('requires sign-in when auth is on', async () => {
    const auth = vi.fn<ModelAuthCheck>(async (header) => {
      if (header !== 'Bearer ok') throw new Error('no');
      return { callerId: 'caller-1' };
    });
    const res = await handler({ auth })(post({ text: 'hi', lineageId: LINEAGE, stage: 'Baby' }), 'ip');
    expect(res.status).toBe(401);
  });

  it('reports an ElevenLabs failure as 502 without leaking the key or the text to the log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handler({ fetchFn: fakeFetch(401) })(post({ text: 'secret words', lineageId: LINEAGE, stage: 'Mid' }), 'ip');
    expect(res.status).toBe(502);
    const logged = log.mock.calls.flat().map(String).join(' ');
    expect(logged).not.toContain('test-key');
    expect(logged).not.toContain('secret words');
    log.mockRestore();
  });
});
