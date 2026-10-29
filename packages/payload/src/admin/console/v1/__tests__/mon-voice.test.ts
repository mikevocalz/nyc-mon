import { FALLBACK_MON_LINGO, planMonUtterance, MAX_SPOKEN_TEXT, type MonLingo, type MonVoiceRef } from '@acme/content/voice';
import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { MON_INSTANCES_SLUG } from '../../../../collections/MonInstances.ts';
import {
  createClipCache,
  createMonVoiceHandler,
  createMonVoiceRateLimiter,
  MON_VOICE_REASON_HEADER,
  type MonVoiceFetch,
} from '../mon-voice.ts';
import { ON_BEHALF_OF_HEADER, SERVICE_KEY_HEADER } from '../service-caller.ts';

type Doc = Record<string, unknown>;
type LocalApiCall = (options: Record<string, unknown>) => Promise<unknown>;

const SERVICE_KEY = 'k'.repeat(48);
const WEB_ORIGIN = 'https://nycmon.test';
const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x44]);

function monDoc(monInstanceId: string, callerId: string, extra: Doc = {}): Doc {
  return {
    id: monInstanceId,
    monInstanceId,
    speciesId: 'dex-001',
    nickname: null,
    callerId,
    hatchedAt: 1,
    bond: 0,
    stage: 'Small',
    gender: 'female',
    voiceLineageId: 'dex-001/female/1',
    ...extra,
  };
}

function fakePayload(opts: { sessionUser?: Doc | null; mons?: Doc[] } = {}) {
  const tables: Record<string, Doc[]> = { users: [], [MON_INSTANCES_SLUG]: opts.mons ?? [] };
  const find = vi.fn<LocalApiCall>(async (args) => {
    const where = (args.where ?? {}) as Record<string, { equals?: unknown }>;
    const rows = tables[String(args.collection)] ?? [];
    return { docs: rows.filter((doc) => Object.entries(where).every(([k, c]) => doc[k] === c.equals)) };
  });
  const findByID = vi.fn<LocalApiCall>(async () => null);
  const auth = vi.fn(async () => ({ user: opts.sessionUser ?? null }));
  return { find, payload: { find, findByID, auth } as unknown as Payload };
}

function upstreamOk() {
  return vi.fn<MonVoiceFetch>(async () => new Response(MP3, { status: 200, headers: { 'content-type': 'audio/mpeg' } }));
}

function setup(opts: {
  sessionUser?: Doc | null;
  mons?: Doc[];
  apiKey?: string | undefined;
  fetch?: ReturnType<typeof upstreamOk>;
  rateLimit?: (key: string) => boolean;
  lingo?: MonLingo;
} = {}) {
  const fake = fakePayload({ sessionUser: 'sessionUser' in opts ? opts.sessionUser : { id: 'c1' }, mons: opts.mons ?? [monDoc('mon_1', 'c1')] });
  const upstream = opts.fetch ?? upstreamOk();
  const handle = createMonVoiceHandler({
    getPayload: async () => fake.payload,
    apiKey: () => ('apiKey' in opts ? opts.apiKey : 'test-key'),
    fetch: upstream,
    rateLimit: opts.rateLimit ?? (() => true),
    cache: createClipCache(),
    serviceKey: SERVICE_KEY,
    corsOrigins: async () => [WEB_ORIGIN],
    lingo: async () => opts.lingo ?? FALLBACK_MON_LINGO,
  });
  return { fake, upstream, handle };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://admin.test/v1/mon-voice', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('POST /v1/mon-voice', () => {
  it('needs a signed-in Caller', async () => {
    const { handle, upstream } = setup({ sessionUser: null });
    expect((await handle(post({ monId: 'mon_1', text: 'Hi.' }))).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('refuses the MCP service key: this route is not on its list', async () => {
    const { handle } = setup({ sessionUser: null });
    const res = await handle(post({ monId: 'mon_1', text: 'Hi.' }, { [SERVICE_KEY_HEADER]: SERVICE_KEY, [ON_BEHALF_OF_HEADER]: 'c1' }));
    expect(res.status).toBe(401);
  });

  it("answers 404 for another Caller's Mon and never calls the voice", async () => {
    const { handle, upstream } = setup({ mons: [monDoc('mon_theirs', 'c2')] });
    const res = await handle(post({ monId: 'mon_theirs', text: 'Hi.' }));
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('answers 404 for a Mon that does not exist', async () => {
    const { handle } = setup();
    expect((await handle(post({ monId: 'mon_missing', text: 'Hi.' }))).status).toBe(404);
  });

  it('keeps an Egg silent: 204 with a reason, no upstream call', async () => {
    const { handle, upstream } = setup({ mons: [monDoc('mon_1', 'c1', { stage: 'Egg' })] });
    const res = await handle(post({ monId: 'mon_1', text: 'Hi.' }));
    expect(res.status).toBe(204);
    expect(res.headers.get(MON_VOICE_REASON_HEADER)).toBe('silent');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('answers 204 for a Mon hatched before voice lineages', async () => {
    const { handle } = setup({ mons: [monDoc('mon_1', 'c1', { voiceLineageId: null })] });
    const res = await handle(post({ monId: 'mon_1', text: 'Hi.' }));
    expect(res.status).toBe(204);
    expect(res.headers.get(MON_VOICE_REASON_HEADER)).toBe('no-voice');
  });

  it('answers 204 with reason no-key when ELEVENLABS_API_KEY is unset', async () => {
    const { handle, upstream } = setup({ apiKey: undefined });
    const res = await handle(post({ monId: 'mon_1', text: 'Hi.' }));
    expect(res.status).toBe(204);
    expect(res.headers.get(MON_VOICE_REASON_HEADER)).toBe('no-key');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('bounds the input: text over MAX_SPOKEN_TEXT, empty text and extra fields are 400', async () => {
    const { handle, upstream } = setup();
    expect((await handle(post({ monId: 'mon_1', text: 'a'.repeat(MAX_SPOKEN_TEXT + 1) }))).status).toBe(400);
    expect((await handle(post({ monId: 'mon_1', text: '   ' }))).status).toBe(400);
    expect((await handle(post({ monId: 'mon_1', text: 'Hi.', voiceId: 'x' }))).status).toBe(400);
    expect((await handle(post('{not json'))).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON (a cross-site form post) with 415', async () => {
    const { handle, upstream } = setup();
    const res = await handle(post({ monId: 'mon_1', text: 'Hi.' }, { 'content-type': 'text/plain' }));
    expect(res.status).toBe(415);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('refuses a body larger than the byte cap with 413', async () => {
    const { handle } = setup();
    const res = await handle(post({ monId: 'mon_1', text: 'Hi.', pad: 'x'.repeat(8_000) }));
    expect(res.status).toBe(413);
  });

  it('rate limits per Caller, before any upstream call', async () => {
    const seen: string[] = [];
    const { handle, upstream } = setup({ rateLimit: (key) => (seen.push(key), false) });
    expect((await handle(post({ monId: 'mon_1', text: 'Hi.' }))).status).toBe(429);
    expect(seen).toEqual(['c1']);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('returns the mp3 and the stage pitch the client still has to apply', async () => {
    const { handle } = setup();
    const res = await handle(post({ monId: 'mon_1', text: 'Hi.' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(res.headers.get('x-mon-pitch')).toBe('1');
    expect(res.headers.get('x-mon-pitch-target')).toBe('1.15');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(MP3);
  });

  it('caches by the plan: the same line in the same voice calls ElevenLabs once', async () => {
    const { handle, upstream } = setup();
    const a = await handle(post({ monId: 'mon_1', text: 'Hi.', mood: 'content' }));
    const b = await handle(post({ monId: 'mon_1', text: 'Hi.', mood: 'content' }));
    const c = await handle(post({ monId: 'mon_1', text: 'Hi.', mood: 'asleep' }));
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
    expect(b.headers.get('x-mon-voice-cache')).toBe('hit');
    expect(a.headers.get('etag')).toBe(b.headers.get('etag'));
    expect(c.headers.get('etag')).not.toBe(a.headers.get('etag'));
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('answers 502 when ElevenLabs fails, and caches nothing', async () => {
    const failing = vi.fn<MonVoiceFetch>(async () => new Response('nope', { status: 500 }));
    const { handle } = setup({ fetch: failing });
    expect((await handle(post({ monId: 'mon_1', text: 'Hi.' }))).status).toBe(502);
    expect((await handle(post({ monId: 'mon_1', text: 'Hi.' }))).status).toBe(502);
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('never sends the API key or the text to the client', async () => {
    const { handle } = setup();
    const res = await handle(post({ monId: 'mon_1', text: 'Hi.' }));
    for (const [, value] of res.headers) expect(value).not.toContain('test-key');
  });
});

/** The same lines and voices as packages/web-sim/test/mon-voice-parity.test.ts. */
const LINES = ["*chuckle* Yeah Callah, I'm good.", '“Say less, Callah. That hit.”', '*yawn* Night night.', 'Bet!'] as const;
const VOICED: readonly MonVoiceRef[] = [
  { lineageId: 'dex-001/female/1', stage: 'Small', mood: 'content' },
  { lineageId: 'dex-001/male/3', stage: 'Baby', mood: 'asleep' },
  { lineageId: 'dex-001/female/4', stage: 'Max' },
];

describe('POST /v1/mon-voice matches the shared plan (mon-voice parity)', () => {
  for (const ref of VOICED) {
    for (const line of LINES) {
      it(`${ref.lineageId} ${ref.stage} ${ref.mood ?? '-'}: ${line}`, async () => {
        const mon = monDoc('mon_1', 'c1', { voiceLineageId: ref.lineageId, stage: ref.stage });
        const { handle, upstream } = setup({ mons: [mon] });
        const res = await handle(post({ monId: 'mon_1', text: line, ...(ref.mood ? { mood: ref.mood } : {}) }));
        const plan = planMonUtterance(line, ref);
        if (plan.voice.kind !== 'lineage') throw new Error('parity voices must resolve to a lineage voice');
        expect(res.status).toBe(200);
        const [url, init] = upstream.mock.calls[0]!;
        expect(String(url)).toContain(`/v1/text-to-speech/${plan.voice.voiceId}`);
        const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(sent).toEqual({ text: plan.spoken, model_id: plan.voice.model, voice_settings: plan.voice.settings });
        expect(Number(res.headers.get('x-mon-pitch-target'))).toBe(plan.voice.pitchFactor);
      });
    }
  }
});

describe('POST /v1/mon-voice speaks with the lingo Payload publishes', () => {
  it('uses the served voice, model, pronunciation and pitch, not the bundled fallback', async () => {
    const served: MonLingo = {
      ...FALLBACK_MON_LINGO,
      pronunciations: [{ key: 'p', written: 'Caller', variants: ['Callah'], spoken: 'Kawl-luh', spokenPlural: null }],
      voices: {
        ...FALLBACK_MON_LINGO.voices,
        model: 'eleven_test_model',
        lineages: [{ lineageId: 'dex-001/female/1', elevenLabsVoiceId: 'voice-from-payload', name: 'Test', expression: { style: 0.2, speed: 1 } }],
        stagePitch: { ...FALLBACK_MON_LINGO.voices.stagePitch, Small: 1.5 },
      },
    };
    const { handle, upstream } = setup({ lingo: served });
    const res = await handle(post({ monId: 'mon_1', text: 'Yo Callah!' }));
    expect(res.status).toBe(200);
    const [url, init] = upstream.mock.calls[0]!;
    expect(String(url)).toContain('/v1/text-to-speech/voice-from-payload');
    const sent = JSON.parse(String(init.body)) as { text: string; model_id: string };
    expect(sent.text).toBe('Yo Kawl-luh!');
    expect(sent.model_id).toBe('eleven_test_model');
    expect(res.headers.get('x-mon-pitch-target')).toBe('1.5');
  });

  it('answers 500 and calls no voice when the lingo cannot be read', async () => {
    const fake = fakePayload({ sessionUser: { id: 'c1' }, mons: [monDoc('mon_1', 'c1')] });
    const upstream = upstreamOk();
    const handle = createMonVoiceHandler({
      getPayload: async () => fake.payload,
      apiKey: () => 'test-key',
      fetch: upstream,
      rateLimit: () => true,
      cache: createClipCache(),
      serviceKey: SERVICE_KEY,
      corsOrigins: async () => [],
      lingo: async () => {
        throw new Error('db down');
      },
    });
    expect((await handle(post({ monId: 'mon_1', text: 'Hi.' }))).status).toBe(500);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe('CORS for the web app', () => {
  it('answers a preflight from an allowed origin with credentials and the pitch headers exposed', async () => {
    const { handle } = setup();
    const res = await handle(new Request('https://admin.test/v1/mon-voice', { method: 'OPTIONS', headers: { origin: WEB_ORIGIN, 'access-control-request-method': 'POST' } }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('refuses a preflight from any other origin', async () => {
    const { handle } = setup();
    const res = await handle(new Request('https://admin.test/v1/mon-voice', { method: 'OPTIONS', headers: { origin: 'https://evil.test' } }));
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('labels a clip for an allowed origin so the browser can read the pitch', async () => {
    const { handle } = setup();
    const res = await handle(post({ monId: 'mon_1', text: 'Hi.' }, { origin: WEB_ORIGIN }));
    expect(res.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN);
    expect(res.headers.get('access-control-expose-headers')).toContain('x-mon-pitch-target');
    const other = await handle(post({ monId: 'mon_1', text: 'Hi.' }, { origin: 'https://evil.test' }));
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('only answers POST and OPTIONS', async () => {
    const { handle } = setup();
    expect((await handle(new Request('https://admin.test/v1/mon-voice', { method: 'GET' }))).status).toBe(405);
  });
});

describe('createMonVoiceRateLimiter', () => {
  it('allows `limit` requests per key per window', () => {
    let now = 0;
    const allow = createMonVoiceRateLimiter({ limit: 2, windowMs: 1_000, now: () => now });
    expect([allow('a'), allow('a'), allow('a'), allow('b')]).toEqual([true, true, false, true]);
    now = 1_000;
    expect(allow('a')).toBe(true);
  });
});

describe('createClipCache', () => {
  it('evicts the oldest clip past the byte budget', () => {
    const cache = createClipCache({ maxBytes: 8 });
    cache.set('a', new Uint8Array(4));
    cache.set('b', new Uint8Array(4));
    cache.get('a');
    cache.set('c', new Uint8Array(4));
    expect([cache.get('a') !== undefined, cache.get('b') !== undefined, cache.get('c') !== undefined]).toEqual([true, false, true]);
  });
});
