import { spawn, spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { resolveVoice, stageDirectionsToTags, voiceDelivery, voicePitchFactor } from '@acme/content/voices';
import { IdSchema, LifecycleStageSchema, MonMoodSchema } from '@acme/core/schemas';
import { z } from 'zod';
import type { ModelAuthCheck } from './model-auth.ts';

/**
 * POST /api/tts: speaks one reply in the current Mon's own voice.
 *
 * Simulator only. On a real Echo, Alexa reads every reply in its own voice
 * (PLATFORM-DOCS §2.8); the voice lineage exists so the simulator can show how
 * one Mon sounds as it grows up (Bible v11 ¶56).
 *
 * Body: { text, lineageId, stage, mood? }. The lineage picks the ElevenLabs
 * voice from `@acme/content/voices`. The mood picks a leading audio tag and
 * voice settings, and `*stage directions*` become audio tags where one fits.
 * The stage picks a pitch factor, which ffmpeg bakes in without changing
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
 */

export const MAX_TTS_TEXT = 400;
/**
 * Eleven v4 Turbo: reads audio tags like `[laughs]` and acts out the line,
 * where Flash v2.5 reads flat. Measured 2026-10-23 on a 100-character line via
 * /stream: about 0.2 to 0.3 s to first byte, 1.3 s total (Flash was 0.6 s).
 */
export const ELEVENLABS_TTS_MODEL = 'eleven_v4_turbo';
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
}

export function createTtsHandler(deps: TtsHandlerDeps) {
  return async function handle(req: Request, clientKey: string): Promise<Response> {
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const silent = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

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

    const factor = voicePitchFactor(parsed.stage);
    if (deps.apiKey === undefined || factor === null) return silent();
    const voice = resolveVoice(parsed.lineageId);
    if (voice === null) return silent();

    const delivery = voiceDelivery(parsed.mood);
    const line = stageDirectionsToTags(parsed.text);
    const spoken = delivery.tag === undefined ? line : `${delivery.tag} ${line}`;

    let upstream: Response;
    try {
      upstream = await deps.fetch(`${ELEVENLABS_URL}/${voice.elevenLabsVoiceId}/stream?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': deps.apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: spoken, model_id: ELEVENLABS_TTS_MODEL, voice_settings: delivery.settings }),
        signal: req.signal,
      });
    } catch (err) {
      console.error('[web-sim] tts request failed', err instanceof Error ? err.name : 'unknown');
      return json(502, { error: 'Voice unavailable.' });
    }
    if (!upstream.ok || !upstream.body) {
      console.error('[web-sim] tts upstream status', upstream.status, 'voice', voice.lineageId);
      await upstream.body?.cancel().catch(() => {});
      return json(502, { error: 'Voice unavailable.' });
    }

    let body: ReadableStream<Uint8Array> = upstream.body;
    let applied = 1;
    const shifter = deps.pitchShift === undefined ? systemPitchShifter() : deps.pitchShift;
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
