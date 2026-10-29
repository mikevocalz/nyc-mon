import { createHash } from 'node:crypto';
import { MAX_SPOKEN_TEXT, monVoiceRef, planMonUtterance, type MonLingo } from '@acme/content/voice';
import { MonInstanceSchema, MonMoodSchema } from '@acme/core/schemas';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import { z } from 'zod';
import { parseRecord } from '../../../collections/guards.ts';
import { MON_INSTANCES_SLUG, toMonInstance } from '../../../collections/MonInstances.ts';
import { preflight, withCors } from './cors.ts';
import { authenticateCaller, v1Error } from './game.ts';
import { monLingoReader } from './mon-lingo.ts';

/**
 * `POST /v1/mon-voice`: one line in the signed-in Caller's Mon's own voice,
 * for the app (native and web). The web simulator has its own `/api/tts`;
 * this is the same server adapter behind the app's Better Auth session.
 *
 * Body `{ monId, text, mood? }`. The server loads the Mon (owner only; any
 * other Mon is a 404), plans the line with `planMonUtterance` from its stored
 * `voiceLineageId` and stage and the lingo Payload publishes (the
 * `language-lexicon` rows and the `mon-voices` global, read through the same
 * cached reader as `GET /v1/mon-lingo`), the plan every surface uses, and asks ElevenLabs
 * for the clip. `ELEVENLABS_API_KEY` stays on the server.
 *
 * Answers:
 * - 200 `audio/mpeg`. `x-mon-pitch` is the pitch factor baked into the clip
 *   (always 1 here: no ffmpeg on this host) and `x-mon-pitch-target` the
 *   stage's factor, so the player applies `target / baked` itself without
 *   changing duration (react-native-audio-api: detune with pitchCorrection).
 * - 204 with `x-mon-voice-reason`: `silent` (an Egg, or nothing to say),
 *   `no-voice` (no lineage voice for this Mon) or `no-key` (the server has no
 *   ElevenLabs key). The client shows the caption and may use its fallback.
 * - 400 malformed or over MAX_SPOKEN_TEXT, 401, 404, 413, 415 (not JSON), 429, 502.
 *
 * Clips are cached in memory by a hash of the plan (voice, model, settings,
 * spoken text), so a repeated reaction costs one ElevenLabs call per instance.
 * The text and the key are never logged.
 */

export const MON_VOICE_REASON_HEADER = 'x-mon-voice-reason';
export type MonVoiceSilenceReason = 'silent' | 'no-voice' | 'no-key';

const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const OUTPUT_FORMAT = 'mp3_44100_128';
const MAX_BODY_BYTES = 4_096;
/** About two minutes of 128 kbps mp3; a 400-character line is well under. */
const MAX_CLIP_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;

export const MonVoiceRequestSchema = z.strictObject({
  monId: z.string().min(1).max(128),
  text: z.string().trim().min(1).max(MAX_SPOKEN_TEXT),
  mood: MonMoodSchema.optional(),
});

/** The one call this route makes; `fetch` satisfies it, tests pass a fake. */
export type MonVoiceFetch = (url: string, init: RequestInit) => Promise<Response>;

/** In-memory clip cache keyed by plan hash, bounded by total bytes (oldest use evicted first). */
export interface ClipCache {
  get(key: string): Uint8Array | undefined;
  set(key: string, clip: Uint8Array): void;
}

export function createClipCache(options: { maxBytes?: number } = {}): ClipCache {
  const maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  const clips = new Map<string, Uint8Array>();
  let bytes = 0;
  return {
    get(key) {
      const clip = clips.get(key);
      if (clip === undefined) return undefined;
      // Map keeps insertion order: re-inserting marks it most recently used.
      clips.delete(key);
      clips.set(key, clip);
      return clip;
    },
    set(key, clip) {
      if (clip.byteLength > maxBytes) return;
      const old = clips.get(key);
      if (old !== undefined) {
        bytes -= old.byteLength;
        clips.delete(key);
      }
      clips.set(key, clip);
      bytes += clip.byteLength;
      for (const [oldest, value] of clips) {
        if (bytes <= maxBytes) break;
        clips.delete(oldest);
        bytes -= value.byteLength;
      }
    },
  };
}

/** Fixed-window limiter per key (the Caller id). */
export function createMonVoiceRateLimiter(options: { limit?: number; windowMs?: number; now?: () => number } = {}): (key: string) => boolean {
  const limit = options.limit ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();
  return (key) => {
    const t = now();
    const current = windows.get(key);
    if (current === undefined || t - current.start >= windowMs) {
      // Drop stale windows now and then so the map cannot grow without bound.
      if (windows.size > 10_000) for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}

export interface MonVoiceDeps {
  readonly getPayload: () => Promise<Payload>;
  /** ELEVENLABS_API_KEY, read per request; undefined answers 204 `no-key`. */
  readonly apiKey: () => string | undefined;
  readonly fetch: MonVoiceFetch;
  readonly rateLimit: (callerId: string) => boolean;
  readonly cache: ClipCache;
  /** `V1_MCP_SERVICE_KEY` for {@link authenticateCaller}; this route refuses that path anyway. */
  readonly serviceKey?: string;
  /** Browser origins allowed to call with the session cookie (the web app). Native sends no CORS. */
  readonly corsOrigins: () => Promise<readonly string[]>;
  /** The Mon's lingo as Payload publishes it (`language-lexicon` + `mon-voices`), the tables the line is planned with. */
  readonly lingo: (payload: Payload) => Promise<MonLingo>;
}

const EXPOSED_HEADERS = ['x-mon-pitch', 'x-mon-pitch-target', MON_VOICE_REASON_HEADER, 'x-mon-voice-cache'];

function silent(reason: MonVoiceSilenceReason): Response {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', [MON_VOICE_REASON_HEADER]: reason } });
}

function planKey(parts: unknown): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function clipResponse(clip: Uint8Array, key: string, pitchTarget: number, cache: 'hit' | 'miss'): Response {
  return new Response(clip as BodyInit, {
    status: 200,
    headers: {
      'content-type': 'audio/mpeg',
      'content-length': String(clip.byteLength),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      etag: `"${key}"`,
      'x-mon-pitch': '1',
      'x-mon-pitch-target': String(pitchTarget),
      'x-mon-voice-cache': cache,
    },
  });
}

async function readBody(request: Request): Promise<{ ok: true; raw: string } | { ok: false; response: Response }> {
  // JSON only: a text/plain form post from another site skips the CORS preflight.
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return { ok: false, response: v1Error('INVALID_RECORD', 'Send the line as JSON.', 415) };
  }
  if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) {
    return { ok: false, response: v1Error('INVALID_RECORD', 'Line too long to speak.', 413) };
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { ok: false, response: v1Error('INVALID_RECORD', 'Line too long to speak.', 413) };
  return { ok: true, raw };
}

export function createMonVoiceHandler(deps: MonVoiceDeps): (request: Request) => Promise<Response> {
  const speak = speakHandler(deps);
  return async (request) => {
    const origin = request.headers.get('origin');
    const allowed = await deps.corsOrigins().catch(() => [] as readonly string[]);
    if (request.method === 'OPTIONS') return preflight(origin, allowed, 'POST, OPTIONS');
    if (request.method !== 'POST') return v1Error('INVALID_RECORD', 'Method not allowed.', 405);
    return withCors(await speak(request), origin, allowed, EXPOSED_HEADERS);
  };
}

function speakHandler(deps: MonVoiceDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const payload = await deps.getPayload();
      const caller = await authenticateCaller(payload, request, { serviceKey: deps.serviceKey });
      if (caller instanceof Response) return caller;

      const body = await readBody(request);
      if (!body.ok) return body.response;
      let input: z.infer<typeof MonVoiceRequestSchema>;
      try {
        input = MonVoiceRequestSchema.parse(JSON.parse(body.raw));
      } catch {
        return v1Error('INVALID_RECORD', 'Malformed speech request.', 400);
      }

      // Before any lookup or upstream call: a flood costs neither.
      if (!deps.rateLimit(caller.callerId)) return v1Error('INVALID_RECORD', 'Too many lines. Wait a minute.', 429);

      const found = await payload.find({
        collection: MON_INSTANCES_SLUG,
        where: { monInstanceId: { equals: input.monId }, callerId: { equals: caller.callerId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const doc = found.docs[0] as Record<string, unknown> | undefined;
      if (doc === undefined) return v1Error('NOT_FOUND', 'Mon not found.', 404);
      const mon = parseRecord(MonInstanceSchema, toMonInstance(doc), 'mon');

      const ref = monVoiceRef(mon);
      const lingo = await deps.lingo(payload);
      const plan = planMonUtterance(input.text, ref === null ? undefined : { ...ref, ...(input.mood ? { mood: input.mood } : {}) }, lingo);
      if (plan.voice.kind === 'silent') return silent('silent');
      if (plan.voice.kind === 'fallback') return silent('no-voice');
      const apiKey = deps.apiKey();
      if (apiKey === undefined || apiKey === '') return silent('no-key');

      const { voiceId, model, settings, pitchFactor, lineageId } = plan.voice;
      const key = planKey({ voiceId, model, settings, spoken: plan.spoken, format: OUTPUT_FORMAT });
      const cached = deps.cache.get(key);
      if (cached !== undefined) return clipResponse(cached, key, pitchFactor, 'hit');

      let clip: Uint8Array;
      try {
        const res = await deps.fetch(`${ELEVENLABS_URL}/${voiceId}?output_format=${OUTPUT_FORMAT}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
          body: JSON.stringify({ text: plan.spoken, model_id: model, voice_settings: settings }),
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
        });
        if (!res.ok) {
          console.error('[mon-voice] upstream status', res.status, 'voice', lineageId);
          await res.body?.cancel().catch(() => {});
          return v1Error('INTERNAL_ERROR', 'Voice unavailable.', 502);
        }
        clip = new Uint8Array(await res.arrayBuffer());
        if (clip.byteLength === 0 || clip.byteLength > MAX_CLIP_BYTES) throw new Error(`clip size ${clip.byteLength}`);
      } catch (err) {
        console.error('[mon-voice] upstream failed', err instanceof Error ? err.name : 'unknown');
        return v1Error('INTERNAL_ERROR', 'Voice unavailable.', 502);
      }
      deps.cache.set(key, clip);
      return clipResponse(clip, key, pitchFactor, 'miss');
    } catch (error) {
      console.error('[mon-voice] failed', error instanceof Error ? error.name : 'unknown');
      return v1Error('INTERNAL_ERROR', 'Voice unavailable.', 500);
    }
  };
}

async function livePayload(): Promise<Payload> {
  const { default: config } = await import('../../../payload.config.ts');
  return getPayload({ config });
}

/** `POST /v1/mon-voice`, wired to the live Payload and ElevenLabs. */
export const handleMonVoice = createMonVoiceHandler({
  getPayload: livePayload,
  apiKey: () => process.env.ELEVENLABS_API_KEY,
  fetch: (url, init) => fetch(url, init),
  rateLimit: createMonVoiceRateLimiter(),
  cache: createClipCache(),
  // The first-party origins Better Auth already trusts (the product site among them).
  corsOrigins: async () => (await import('../../../auth/options.ts')).PAYLOAD_ORIGINS,
  lingo: (payload) => monLingoReader.read(payload),
});
