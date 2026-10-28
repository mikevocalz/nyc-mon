import { describe, expect, it, vi } from 'vitest';
import type { ModelAuthCheck } from '../server/model-auth.ts';
import { createRateLimiter } from '../server/model.ts';
import {
  createTtsHandler,
  MAX_TTS_TEXT,
  type PitchShifter,
  pitchFilter,
  pitchShiftArgs,
  type TtsFetch,
} from '../server/tts.ts';
import { ELEVENLABS_TTS_MODEL } from '@acme/content/voice';
import { expressiveVoiceSettings, resolveVoice } from '@acme/content/voices';

const ORIGIN = 'http://localhost:5180';
const LINEAGE = 'dex-001/female/1';
/** The ElevenLabs voice behind LINEAGE, from the registry, so a recast doesn't strand the tests. */
const VOICE = resolveVoice(LINEAGE)!;
const AYLA = VOICE.elevenLabsVoiceId;
/** The voice's own style and speed ride along with the mood's stability. */
const expressive = { style: expect.any(Number), speed: expect.any(Number) };

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
      voice_settings: { stability: 0.45, similarity_boost: 0.8, ...expressive },
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
      post({ text: 'Hi friend *scritchy chirp*', lineageId: LINEAGE, stage: 'Small', mood }),
      'ip',
    );
    expect(res.status).toBe(200);
    expect(sentBody(fetchFn)).toEqual({
      text: `${tag} Hi friend`,
      model_id: 'eleven_v4_turbo',
      voice_settings: { stability, similarity_boost: 0.8, ...expressive },
    });
  });

  it.each([
    ['content', '*chuckle* Hi friend', '[laughs] Hi friend', 0.35],
    ['asleep', '*whisper* Shh, sleepy', '[whispers] Shh, sleepy', 0.6],
    ['needs-energy', '*sighs* So tired', '[sighs] So tired', 0.55],
    ['needs-social', '*huff* Where were you', '[sighs] Where were you', 0.4],
    ['content', '*laughs* Again!', '[laughs] Again!', 0.35],
  ] as const)('a %s line that opens with its own direction (%s) gets no second, mood tag', async (mood, text, spoken, stability) => {
    const fetchFn = fakeFetch();
    const res = await handler({ fetchFn })(post({ text, lineageId: LINEAGE, stage: 'Small', mood }), 'ip');
    expect(res.status).toBe(200);
    // One tag only, and the mood still sets stability.
    expect(sentBody(fetchFn)).toEqual({ text: spoken, model_id: 'eleven_v4_turbo', voice_settings: { stability, similarity_boost: 0.8, ...expressive } });
  });

  it.each([
    ["Yeah Callah, I'm good.", "Yeah Call-uh, I'm good."],
    ['Hey Caller! Wanna play?', 'Hey Call-uh! Wanna play?'],
  ])('says the canon name as Call-uh: %s', async (text, spoken) => {
    const fetchFn = fakeFetch();
    await handler({ fetchFn })(post({ text, lineageId: LINEAGE, stage: 'Small' }), 'ip');
    expect(sentBody(fetchFn)).toMatchObject({ text: spoken });
  });

  it('sends the voice’s style and speed with the mood, damped for a low-energy Mon', async () => {
    for (const mood of ['content', 'asleep', undefined] as const) {
      const fetchFn = fakeFetch();
      await handler({ fetchFn })(post({ text: 'Hi', lineageId: LINEAGE, stage: 'Small', ...(mood ? { mood } : {}) }), 'ip');
      expect((sentBody(fetchFn) as { voice_settings: unknown }).voice_settings).toEqual(expressiveVoiceSettings(VOICE, mood));
    }
  });

  it('strips *yawn*, which has no documented ElevenLabs tag, and then leads with the mood tag', async () => {
    const fetchFn = fakeFetch();
    const res = await handler({ fetchFn })(post({ text: '*yawn* Night night', lineageId: LINEAGE, stage: 'Small', mood: 'asleep' }), 'ip');
    expect(res.status).toBe(200);
    expect(sentBody(fetchFn)).toMatchObject({ text: '[whispers] Night night', voice_settings: { stability: 0.6 } });
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

describe('/api/tts JSON (lip-sync)', () => {
  const alignment = { characters: ['H', 'i'], character_start_times_seconds: [0, 0.1], character_end_times_seconds: [0.1, 0.2] };
  const timed = (body: unknown = { audio_base64: Buffer.from([1, 2, 3]).toString('base64'), alignment, normalized_alignment: alignment }) =>
    vi.fn<TtsFetch>(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  const postJson = (body: unknown) =>
    new Request(`${ORIGIN}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, audio/mpeg', origin: ORIGIN },
      body: JSON.stringify(body),
    });
  /** A shifter that appends a marker byte, so the test can see which bytes went where. */
  const markShifter = () =>
    vi.fn<PitchShifter>((audio) =>
      audio.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform: (c, ctl) => ctl.enqueue(new Uint8Array([...c, 9])) })),
    );

  it('asks /with-timestamps and answers base64 audio with the alignment', async () => {
    const fetchFn = timed();
    const res = await handler({ fetchFn, pitchShift: null })(postJson({ text: 'Hi', lineageId: LINEAGE, stage: 'Mid' }), 'ip');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${AYLA}/with-timestamps?output_format=mp3_44100_128`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ audio: Buffer.from([1, 2, 3]).toString('base64'), audioContentType: 'audio/mpeg', pitch: 1, alignment });
  });

  const getFace = (id: string, headers: Record<string, string> = { origin: ORIGIN }) =>
    new Request(`${ORIGIN}/api/tts/face/${id}`, { method: 'GET', headers });

  it('answers the clip at once and renders the face from the SAME shifted bytes afterwards', async () => {
    let finishFace!: (f: unknown) => void;
    const face = vi.fn(() => new Promise((r) => (finishFace = r)));
    const h = createTtsHandler({
      allowedOrigin: ORIGIN,
      rateLimit: createRateLimiter(100),
      apiKey: 'k',
      fetch: timed(),
      pitchShift: markShifter(),
      face: face as never,
    });
    // The face has not finished, and the clip is already answered.
    const res = await h(postJson({ text: 'Hi', lineageId: LINEAGE, stage: 'Baby', mood: 'content' }), 'ip');
    const body = (await res.json()) as { audio: string; pitch: number; face?: unknown; faceId: string; alignment: unknown };
    expect(body.pitch).toBe(1.3);
    expect([...Buffer.from(body.audio, 'base64')]).toEqual([1, 2, 3, 9]);
    expect(body.face).toBeUndefined();
    expect(body.alignment).toEqual(alignment);
    expect(body.faceId).toMatch(/^[0-9a-f-]{36}$/);
    const sent = (face.mock.calls[0] as unknown as [{ audio: Uint8Array; mood: string }])[0];
    expect([...sent.audio]).toEqual([1, 2, 3, 9]);
    expect(sent.mood).toBe('content');

    const pending = h(getFace(body.faceId), 'ip');
    finishFace({ fps: 30, names: ['jawOpen'], frames: [[0.2]] });
    const got = await pending;
    expect(got.status).toBe(200);
    expect(await got.json()).toEqual({ face: { fps: 30, names: ['jawOpen'], frames: [[0.2]] } });
    // Handed out once.
    expect((await h(getFace(body.faceId), 'ip')).status).toBe(204);
  });

  it('a face that fails or an unknown id answers 204; the clip still has its alignment', async () => {
    const h = createTtsHandler({
      allowedOrigin: ORIGIN,
      rateLimit: createRateLimiter(100),
      apiKey: 'k',
      fetch: timed(),
      pitchShift: null,
      face: async () => null,
    });
    const body = (await (await h(postJson({ text: 'Hi', lineageId: LINEAGE, stage: 'Mid' }), 'ip')).json()) as { faceId: string; alignment: unknown };
    expect(body.alignment).toEqual(alignment);
    expect((await h(getFace(body.faceId), 'ip')).status).toBe(204);
    expect((await h(getFace('00000000-0000-4000-8000-000000000000'), 'ip')).status).toBe(204);
  });

  it('the face route takes same-origin requests only, and checks sign-in', async () => {
    const auth = vi.fn(async (header: string | null) => {
      if (header !== 'Bearer ok') throw new Error('no');
    });
    const h = createTtsHandler({ allowedOrigin: ORIGIN, rateLimit: createRateLimiter(100), apiKey: 'k', fetch: timed(), pitchShift: null, face: async () => null, auth: auth as never });
    const id = '00000000-0000-4000-8000-000000000000';
    expect((await h(getFace(id, { origin: 'https://evil.example', authorization: 'Bearer ok' }), 'ip')).status).toBe(403);
    expect((await h(getFace(id, { 'sec-fetch-site': 'cross-site', authorization: 'Bearer ok' }), 'ip')).status).toBe(403);
    expect((await h(getFace(id, { 'sec-fetch-site': 'same-origin' }), 'ip')).status).toBe(401);
    expect((await h(getFace(id, { 'sec-fetch-site': 'same-origin', authorization: 'Bearer ok' }), 'ip')).status).toBe(204);
  });

  it('without Audio2Face there is no faceId', async () => {
    const body = (await (await handler({ fetchFn: timed(), pitchShift: null })(postJson({ text: 'Hi', lineageId: LINEAGE, stage: 'Mid' }), 'ip')).json()) as Record<string, unknown>;
    expect(body.faceId).toBeUndefined();
  });

  it('drops a malformed alignment and reports an upstream failure as 502', async () => {
    const bad = timed({ audio_base64: 'AQID', alignment: { characters: ['a'], character_start_times_seconds: [], character_end_times_seconds: [] } });
    const body = (await (await handler({ fetchFn: bad, pitchShift: null })(postJson({ text: 'Hi', lineageId: LINEAGE, stage: 'Mid' }), 'ip')).json()) as Record<string, unknown>;
    expect(body.alignment).toBeUndefined();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = vi.fn<TtsFetch>(async () => new Response('no', { status: 500 }));
    expect((await handler({ fetchFn: down })(postJson({ text: 'Hi', lineageId: LINEAGE, stage: 'Mid' }), 'ip')).status).toBe(502);
    err.mockRestore();
  });
});
