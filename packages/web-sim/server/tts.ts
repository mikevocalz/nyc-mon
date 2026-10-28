import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { MAX_SPOKEN_TEXT, planMonUtterance, type MonLingo } from '@acme/content/voice';
import { IdSchema, LifecycleStageSchema, MonMoodSchema } from '@acme/core/schemas';
import { z } from 'zod';
import type { CharacterAlignment, FaceTrack } from '@acme/ui/three/mon/lipsync';
import type { FaceRenderer } from './a2f.ts';
import type { ModelAuthCheck } from './model-auth.ts';

/**
 * POST /api/tts: speaks one reply in the current Mon's own voice.
 *
 * Simulator only. On a real Echo, Alexa reads every reply in its own voice
 * (PLATFORM-DOCS §2.8); the voice lineage exists so the simulator can show how
 * one Mon sounds as it grows up (Bible v11 ¶56).
 *
 * Body: { text, lineageId, stage, mood? } (`monSpeechRequest`). The server
 * re-plans the line with `planMonUtterance` from `@acme/content/voice`, the
 * same plan every surface uses: lineage -> ElevenLabs voice, mood -> lead tag
 * and settings, `*stage directions*` -> audio tags. The stage picks a pitch factor, which ffmpeg bakes in without changing
 * duration, so the browser plays the clip at rate 1. An Egg is silent.
 *
 * The pitch shift streams (ffmpeg reads mp3 on stdin and writes mp3 on
 * stdout), so it adds encoder latency, not a full-clip buffer. Without an
 * ffmpeg binary (FFMPEG_PATH, else `ffmpeg` on PATH) the clip is served at the
 * voice's own pitch and the server logs that once.
 *
 * 204 means "no voice for this": no API key, an Egg, or a lineage whose pool is
 * empty. The client then falls back to Web Speech. The API key and the text are
 * never logged.
 *
 * Lip-sync: a client that sends `Accept: application/json` gets one JSON body
 * instead of streamed mp3: `{ audio (base64 mp3), audioContentType, pitch,
 * alignment?, faceId? }`. `alignment` is ElevenLabs' per-character timing
 * (`/with-timestamps`); the pitch shift keeps duration, so it still fits the
 * shifted clip. The answer never waits for Audio2Face-3D (1.5 to 3 s): with an
 * NVIDIA key it carries `faceId`, and GET /api/tts/face/:id answers
 * `{ face }` once the frames from that same shifted clip are ready, or 204 if
 * they never come. The browser plays on the character timing and swaps the
 * face in mid-line. Either field may be missing; the clip always plays.
 */

/** Same limit as every other surface (`@acme/content/voice`). */
export const MAX_TTS_TEXT = MAX_SPOKEN_TEXT;
const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const SAMPLE_RATE = 44_100;
const MAX_BODY_BYTES = 4_096;

export const TtsRequestSchema = z.strictObject({
  text: z.string().trim().min(1).max(MAX_TTS_TEXT),
  lineageId: IdSchema,
  stage: LifecycleStageSchema,
  mood: MonMoodSchema.optional(),
});

/**
 * The ffmpeg filter that moves pitch by `factor` and keeps duration:
 * `asetrate` relabels the sample rate (pitch and speed both move by the
 * factor), `aresample` returns to 44.1 kHz, and `atempo` stretches time back
 * by the inverse. The relabelled rate is rounded to a whole Hz and `atempo`
 * uses the exact inverse of that rounded rate, so the length comes out even.
 */
export function pitchFilter(factor: number): string {
  if (!(factor > 0)) throw new RangeError(`pitch factor must be positive, got ${factor}`);
  const shiftedRate = Math.round(SAMPLE_RATE * factor);
  const tempo = SAMPLE_RATE / shiftedRate;
  // atempo takes 0.5 to 100 per instance; the stage table stays inside that.
  if (tempo < 0.5 || tempo > 100) throw new RangeError(`pitch factor ${factor} is outside what atempo can undo`);
  return `asetrate=${shiftedRate},aresample=${SAMPLE_RATE},atempo=${tempo.toFixed(6)}`;
}

/** ffmpeg arguments for a streaming mp3-in, mp3-out pitch shift. */
export function pitchShiftArgs(factor: number): string[] {
  return ['-hide_banner', '-loglevel', 'error', '-f', 'mp3', '-i', 'pipe:0', '-af', pitchFilter(factor), '-f', 'mp3', '-b:a', '128k', 'pipe:1'];
}

/**
 * Shifts an mp3 stream's pitch by `factor` and returns the new mp3 stream.
 * Throws synchronously when it cannot shift at all, so the caller can serve
 * the original instead.
 */
export type PitchShifter = (audio: ReadableStream<Uint8Array>, factor: number, signal: AbortSignal) => ReadableStream<Uint8Array>;

/** The ffmpeg binary to use: FFMPEG_PATH, else `ffmpeg` on PATH; null when neither runs. */
export function findFfmpeg(candidate = process.env.FFMPEG_PATH ?? 'ffmpeg'): string | null {
  const probe = spawnSync(candidate, ['-version'], { stdio: 'ignore', timeout: 5_000 });
  return probe.status === 0 ? candidate : null;
}

export function createFfmpegPitchShifter(binary: string): PitchShifter {
  return (audio, factor, signal) => {
    const child = spawn(binary, pitchShiftArgs(factor), { stdio: ['pipe', 'pipe', 'ignore'], signal });
    child.on('error', () => {}); // surfaced through stdout below; abort also lands here
    child.stdin.on('error', () => {}); // EPIPE when ffmpeg exits early
    Readable.fromWeb(audio as import('node:stream/web').ReadableStream<Uint8Array>).pipe(child.stdin);
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) child.stdout.destroy(new Error(`ffmpeg exited ${code}`));
    });
    return Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
  };
}

let defaultShifter: PitchShifter | null | undefined;
function systemPitchShifter(): PitchShifter | null {
  if (defaultShifter === undefined) {
    const binary = findFfmpeg();
    defaultShifter = binary === null ? null : createFfmpegPitchShifter(binary);
    if (binary === null) console.warn('[web-sim] ffmpeg not found; Mon voices play at their natural pitch');
  }
  return defaultShifter;
}

/** The one call /api/tts makes; `fetch` satisfies it, tests pass a fake. */
export type TtsFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface TtsHandlerDeps {
  readonly allowedOrigin: string;
  readonly rateLimit: (key: string) => boolean;
  /** ELEVENLABS_API_KEY; undefined turns the route into a 204 fallback. */
  readonly apiKey: string | undefined;
  readonly fetch: TtsFetch;
  /** OAuth mode: the person's MCP bearer token, same check as /api/model. */
  readonly auth?: ModelAuthCheck;
  /**
   * Bakes the stage pitch into the clip. Omitted: system ffmpeg, found once on
   * first use. Null: never shift (the clip keeps the voice's own pitch).
   */
  readonly pitchShift?: PitchShifter | null;
  /** Audio2Face-3D for the JSON answer. Omitted: no face, character timing only. */
  readonly face?: FaceRenderer;
  /**
   * The Mon's lingo as Payload serves it (`GET /v1/mon-lingo`): voice table,
   * pronunciations, stage directions. Called once per line after sign-in.
   * Omitted: the bundled FALLBACK_MON_LINGO.
   */
  readonly lingo?: () => Promise<MonLingo>;
}

/** ElevenLabs `/with-timestamps` body. */
interface TimestampedAudio {
  readonly audio_base64: string;
  readonly alignment?: CharacterAlignment | null;
}

function readAlignment(a: unknown): CharacterAlignment | undefined {
  if (typeof a !== 'object' || a === null) return undefined;
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = a as Record<string, unknown>;
  if (!Array.isArray(characters) || !Array.isArray(starts) || !Array.isArray(ends)) return undefined;
  if (characters.length !== starts.length || starts.length !== ends.length || characters.length > 4 * MAX_TTS_TEXT) return undefined;
  if (!characters.every((c) => typeof c === 'string') || ![...starts, ...ends].every((t) => typeof t === 'number' && Number.isFinite(t))) return undefined;
  return { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } as CharacterAlignment;
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** How long a deferred face waits to be collected before it is dropped. */
export const FACE_TTL_MS = 60_000;
const FACE_PATH = /^\/api\/tts\/face\/([0-9a-f-]{36})$/;

export function createTtsHandler(deps: TtsHandlerDeps) {
  /**
   * Audio2Face takes 1.5 to 3 s per clip. The JSON answer goes out as soon as
   * the clip and its character timing exist; the face is rendered after, keyed
   * by a random id the browser collects from GET /api/tts/face/:id and swaps
   * in mid-line. Each face is handed out once and forgotten after FACE_TTL_MS.
   */
  const faces = new Map<string, { readonly face: Promise<FaceTrack | null>; readonly timer: ReturnType<typeof setTimeout> }>();
  const forget = (id: string) => {
    const job = faces.get(id);
    if (!job) return;
    clearTimeout(job.timer);
    faces.delete(id);
  };
  const startFace = (render: FaceRenderer, audio: Uint8Array, mood: z.infer<typeof MonMoodSchema> | undefined): string => {
    const id = randomUUID();
    const face = render({ audio, signal: AbortSignal.timeout(FACE_TTL_MS), ...(mood === undefined ? {} : { mood }) }).catch(() => null);
    const timer = setTimeout(() => faces.delete(id), FACE_TTL_MS);
    (timer as { unref?: () => void }).unref?.();
    faces.set(id, { face, timer });
    return id;
  };

  return async function handle(req: Request, clientKey: string): Promise<Response> {
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const silent = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

    const facePath = FACE_PATH.exec(new URL(req.url).pathname);
    if (facePath) {
      if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
      // Browsers leave Origin off a same-origin GET; Sec-Fetch-Site says the same thing.
      const origin = req.headers.get('origin');
      const sameOrigin = origin === deps.allowedOrigin || (origin === null && req.headers.get('sec-fetch-site') === 'same-origin');
      if (!sameOrigin) return json(403, { error: 'forbidden_origin' });
      if (deps.auth) {
        try {
          await deps.auth(req.headers.get('authorization'));
        } catch {
          return json(401, { error: 'Sign in again to keep talking.' });
        }
      }
      const id = facePath[1]!;
      const job = faces.get(id);
      if (!job) return silent();
      forget(id);
      const face = await job.face;
      return face ? json(200, { face }) : silent();
    }

    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    // Same-origin only: another site can't spend this server's ElevenLabs credits.
    if (req.headers.get('origin') !== deps.allowedOrigin) return json(403, { error: 'forbidden_origin' });
    if (deps.auth) {
      try {
        await deps.auth(req.headers.get('authorization'));
      } catch {
        return json(401, { error: 'Sign in again to keep talking.' });
      }
    }
    if (Number(req.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) return json(413, { error: 'Reply too long to speak.' });
    if (!deps.rateLimit(clientKey)) return json(429, { error: 'Too many requests. Wait a minute and try again.' });

    let parsed: z.infer<typeof TtsRequestSchema>;
    try {
      const raw = await req.text();
      if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Reply too long to speak.' });
      parsed = TtsRequestSchema.parse(JSON.parse(raw));
    } catch {
      return json(400, { error: 'Malformed speech request.' });
    }

    const plan = planMonUtterance(parsed.text, parsed, deps.lingo ? await deps.lingo() : undefined);
    if (deps.apiKey === undefined || plan.voice.kind !== 'lineage') return silent();
    // The mood's stability and similarity plus the voice's own style and speed.
    // Checked live 2026-10-23: eleven_v4_turbo answers 200 with all four fields.
    const { voiceId, model, settings, pitchFactor: factor, lineageId } = plan.voice;
    const spoken = plan.spoken;
    const shifter = deps.pitchShift === undefined ? systemPitchShifter() : deps.pitchShift;

    if ((req.headers.get('accept') ?? '').includes('application/json')) {
      let timed: TimestampedAudio;
      try {
        const res = await deps.fetch(`${ELEVENLABS_URL}/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
          method: 'POST',
          headers: { 'xi-api-key': deps.apiKey, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ text: spoken, model_id: model, voice_settings: settings }),
          signal: req.signal,
        });
        if (!res.ok) {
          console.error('[web-sim] tts upstream status', res.status, 'voice', lineageId);
          await res.body?.cancel().catch(() => {});
          return json(502, { error: 'Voice unavailable.' });
        }
        timed = (await res.json()) as TimestampedAudio;
        if (typeof timed.audio_base64 !== 'string' || timed.audio_base64 === '') throw new Error('no audio');
      } catch (err) {
        console.error('[web-sim] tts request failed', err instanceof Error ? err.name : 'unknown');
        return json(502, { error: 'Voice unavailable.' });
      }
      let audio: Uint8Array = new Uint8Array(Buffer.from(timed.audio_base64, 'base64'));
      let applied = 1;
      if (factor !== 1 && shifter !== null) {
        try {
          audio = await collect(shifter(streamOf(audio), factor, req.signal));
          applied = factor;
        } catch (err) {
          console.error('[web-sim] pitch shift unavailable', err instanceof Error ? err.message : 'unknown');
        }
      }
      const alignment = readAlignment(timed.alignment);
      // The face comes from the bytes the browser will play, after the shift; it
      // renders while the clip already plays (see `faces` above).
      const faceId = deps.face ? startFace(deps.face, audio, parsed.mood) : undefined;
      return new Response(
        JSON.stringify({
          audio: Buffer.from(audio).toString('base64'),
          audioContentType: 'audio/mpeg',
          pitch: applied,
          ...(alignment ? { alignment } : {}),
          ...(faceId ? { faceId } : {}),
        }),
        { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-mon-pitch': String(applied) } },
      );
    }

    let upstream: Response;
    try {
      upstream = await deps.fetch(`${ELEVENLABS_URL}/${voiceId}/stream?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': deps.apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: spoken, model_id: model, voice_settings: settings }),
        signal: req.signal,
      });
    } catch (err) {
      console.error('[web-sim] tts request failed', err instanceof Error ? err.name : 'unknown');
      return json(502, { error: 'Voice unavailable.' });
    }
    if (!upstream.ok || !upstream.body) {
      console.error('[web-sim] tts upstream status', upstream.status, 'voice', lineageId);
      await upstream.body?.cancel().catch(() => {});
      return json(502, { error: 'Voice unavailable.' });
    }

    let body: ReadableStream<Uint8Array> = upstream.body;
    let applied = 1;
    if (factor !== 1 && shifter !== null) {
      try {
        body = shifter(upstream.body, factor, req.signal);
        applied = factor;
      } catch (err) {
        console.error('[web-sim] pitch shift unavailable', err instanceof Error ? err.message : 'unknown');
      }
    }
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        // The pitch factor baked into this clip; 1 when no shift ran.
        'x-mon-pitch': String(applied),
      },
    });
  };
}
