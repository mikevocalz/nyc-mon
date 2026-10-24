import { resolveVoice, voicePlaybackRate } from '@acme/content/voices';
import { IdSchema, LifecycleStageSchema } from '@acme/core/schemas';
import { z } from 'zod';
import type { ModelAuthCheck } from './model-auth.ts';

/**
 * POST /api/tts: speaks one reply in the current Mon's own voice.
 *
 * Simulator only. On a real Echo, Alexa reads every reply in its own voice
 * (PLATFORM-DOCS §2.8); the voice lineage exists so the simulator can show how
 * one Mon sounds as it grows up (Bible v11 ¶56).
 *
 * Body: { text, lineageId, stage }. The lineage picks the ElevenLabs voice from
 * `@acme/content/voices`; the stage only gates silence here (an Egg does not
 * speak), and the browser applies the stage's pitch on playback.
 *
 * 204 means "no voice for this": no API key, an Egg, or a lineage whose pool is
 * empty. The client then falls back to Web Speech. The API key and the text are
 * never logged.
 */

export const MAX_TTS_TEXT = 400;
/** Lowest-latency ElevenLabs model; replies are short and spoken right away. */
export const ELEVENLABS_TTS_MODEL = 'eleven_flash_v2_5';
const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const MAX_BODY_BYTES = 4_096;

export const TtsRequestSchema = z.strictObject({
  text: z.string().trim().min(1).max(MAX_TTS_TEXT),
  lineageId: IdSchema,
  stage: LifecycleStageSchema,
});

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

    if (deps.apiKey === undefined || voicePlaybackRate(parsed.stage) === null) return silent();
    const voice = resolveVoice(parsed.lineageId);
    if (voice === null) return silent();

    let upstream: Response;
    try {
      upstream = await deps.fetch(`${ELEVENLABS_URL}/${voice.elevenLabsVoiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': deps.apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
        // The skill writes stage directions as *short huff*; strip the asterisks before speaking.
        body: JSON.stringify({ text: parsed.text.replace(/\*/g, ''), model_id: ELEVENLABS_TTS_MODEL }),
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
    return new Response(upstream.body, {
      status: 200,
      headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  };
}
