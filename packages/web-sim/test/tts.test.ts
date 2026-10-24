import { describe, expect, it, vi } from 'vitest';
import type { ModelAuthCheck } from '../server/model-auth.ts';
import { createRateLimiter } from '../server/model.ts';
import {
  createTtsHandler,
  ELEVENLABS_TTS_MODEL,
  MAX_TTS_TEXT,
  type PitchShifter,
  pitchFilter,
  pitchShiftArgs,
  type TtsFetch,
} from '../server/tts.ts';

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

/** Passes audio through untouched and records the factor it was asked for. */
function fakeShifter() {
  return vi.fn<PitchShifter>((audio) => audio);
}

function handler(
  opts: { apiKey?: string; fetchFn?: TtsFetch; limit?: number; auth?: ModelAuthCheck; pitchShift?: PitchShifter | null } = {},
) {
  return createTtsHandler({
    allowedOrigin: ORIGIN,
    rateLimit: createRateLimiter(opts.limit ?? 100),
    apiKey: 'apiKey' in opts ? opts.apiKey : 'test-key',
    fetch: opts.fetchFn ?? fakeFetch(),
    pitchShift: 'pitchShift' in opts ? (opts.pitchShift ?? null) : fakeShifter(),
    ...(opts.auth ? { auth: opts.auth } : {}),
  });
}

const sentBody = (fetchFn: ReturnType<typeof fakeFetch>) => JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body)) as unknown;

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
    const res = await handler({ fetchFn })(post({ text: 'hi', lineageId: LINEAGE, stage: 'Egg', mood: 'content' }), 'ip');
    expect(res.status).toBe(204);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('answers 204 for a lineage with no voice yet', async () => {
    const fetchFn = fakeFetch();
    const res = await handler({ fetchFn })(post({ text: 'hi', lineageId: 'dex-008/male/1', stage: 'Mid' }), 'ip');
    expect(res.status).toBe(204);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('calls ElevenLabs /stream with the resolved voice, the key header and the expressive model, and streams audio back', async () => {
    const fetchFn = fakeFetch();
    const res = await handler({ fetchFn })(post({ text: 'Hey there *short huff*', lineageId: LINEAGE, stage: 'Baby' }), 'ip');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 0x90]));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(String(url)).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${AYLA}/stream?output_format=mp3_44100_128`);
    const headers = new Headers(init?.headers);
    expect(headers.get('xi-api-key')).toBe('test-key');
    expect(init?.method).toBe('POST');
    expect(ELEVENLABS_TTS_MODEL).toBe('eleven_v4_turbo');
    expect(sentBody(fetchFn)).toEqual({
      text: 'Hey there [sighs]',
      model_id: 'eleven_v4_turbo',
      voice_settings: { stability: 0.45, similarity_boost: 0.8 },
    });
  });

  it.each([
    ['content', '[happily]', 0.35],
    ['asleep', '[whispers]', 0.6],
    ['sluggish', '[slow]', 0.55],
    ['needs-fullness', '[curious]', 0.4],
    ['needs-energy', '[sighs]', 0.55],
    ['needs-social', '[sad]', 0.4],
  ] as const)('delivers a %s Mon with %s and stability %s', async (mood, tag, stability) => {
    const fetchFn = fakeFetch();
    const res = await handler({ fetchFn })(
      post({ text: 'Hi *chuckles* friend *scritchy chirp*', lineageId: LINEAGE, stage: 'Small', mood }),
      'ip',
    );
    expect(res.status).toBe(200);
    expect(sentBody(fetchFn)).toEqual({
      text: `${tag} Hi [laughs] friend`,
      model_id: 'eleven_v4_turbo',
      voice_settings: { stability, similarity_boost: 0.8 },
    });
  });

  it('rejects an unknown mood', async () => {
    const fetchFn = fakeFetch();
    const res = await handler({ fetchFn })(post({ text: 'hi', lineageId: LINEAGE, stage: 'Baby', mood: 'grumpy' }), 'ip');
    expect(res.status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("bakes the stage's pitch in on the server and reports it", async () => {
    for (const [stage, factor] of [
      ['Baby', 1.3],
      ['Small', 1.15],
      ['Max', 0.92],
    ] as const) {
      const pitchShift = fakeShifter();
      const res = await handler({ pitchShift })(post({ text: 'hi', lineageId: LINEAGE, stage }), 'ip');
      expect(res.status).toBe(200);
      expect(pitchShift).toHaveBeenCalledTimes(1);
      expect(pitchShift.mock.calls[0]?.[1]).toBe(factor);
      expect(res.headers.get('x-mon-pitch')).toBe(String(factor));
    }
  });

  it('skips the shifter at factor 1 and serves the natural pitch when no shifter exists', async () => {
    const pitchShift = fakeShifter();
    const mid = await handler({ pitchShift })(post({ text: 'hi', lineageId: LINEAGE, stage: 'Mid' }), 'ip');
    expect(pitchShift).not.toHaveBeenCalled();
    expect(mid.headers.get('x-mon-pitch')).toBe('1');
    const none = await handler({ pitchShift: null })(post({ text: 'hi', lineageId: LINEAGE, stage: 'Baby' }), 'ip');
    expect(none.status).toBe(200);
    expect(none.headers.get('x-mon-pitch')).toBe('1');
    expect(new Uint8Array(await none.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 0x90]));
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

describe('pitch filter', () => {
  it('relabels the rate by the factor and stretches time back by the exact inverse', () => {
    expect(pitchFilter(1.3)).toBe('asetrate=57330,aresample=44100,atempo=0.769231');
    expect(pitchFilter(1.15)).toBe('asetrate=50715,aresample=44100,atempo=0.869565');
    expect(pitchFilter(0.92)).toBe('asetrate=40572,aresample=44100,atempo=1.086957');
    for (const factor of [1.3, 1.15, 1, 0.92]) {
      const [, rate, , tempo] = /asetrate=(\d+),aresample=(\d+),atempo=([\d.]+)/.exec(pitchFilter(factor)) ?? [];
      // The relabel plays rate/44100 faster; atempo slows it by `tempo`. Net duration change ~1.
      expect((Number(rate) / 44_100) * Number(tempo)).toBeCloseTo(1, 5);
    }
  });

  it('rejects factors atempo cannot undo', () => {
    expect(() => pitchFilter(0)).toThrow(RangeError);
    expect(() => pitchFilter(-1)).toThrow(RangeError);
    expect(() => pitchFilter(3)).toThrow(RangeError);
  });

  it('streams mp3 through stdin and stdout', () => {
    const args = pitchShiftArgs(1.3);
    const input = args.indexOf('-i');
    expect(args.slice(input, input + 2)).toEqual(['-i', 'pipe:0']);
    expect(args.at(-1)).toBe('pipe:1');
    expect(args[args.indexOf('-af') + 1]).toBe(pitchFilter(1.3));
  });
});
