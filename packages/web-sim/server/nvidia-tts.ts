import type { ModelAuthCheck } from './model-auth.ts';
import { createRateLimiter } from './model.ts';
import type { NvidiaEnv } from './nvidia-env.ts';
import { createFfmpegPitchShifter, createTtsHandler, findFfmpeg, type PitchShifter, type TtsFetch } from './tts.ts';

/**
 * The Mon's voice on the NVIDIA companion: the same /api/tts handler the
 * simulator mounts (server/main.ts), behind the same sign-in as /api/model and
 * /api/memory. Kept apart from nvidia-main.ts, which starts a server on import.
 */

/** The page CSP. `media-src blob:` is for the /api/tts clip, which plays from a blob: URL. */
export function nvidiaCsp(env: NvidiaEnv): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    `connect-src 'self' ${new URL(env.SIM_MCP_URL).origin} ${new URL(env.AUTH_ISSUER).origin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * FFMPEG_PATH, when set, is the binary for the stage pitch shift; null when it
 * does not run (the clip keeps the voice's own pitch). Unset: undefined, so
 * tts.ts looks for `ffmpeg` on PATH on first use.
 */
export function nvidiaPitchShift(env: NvidiaEnv, find: (candidate?: string) => string | null = findFfmpeg): PitchShifter | null | undefined {
  if (env.FFMPEG_PATH === undefined) return undefined;
  const binary = find(env.FFMPEG_PATH);
  if (binary === null) console.warn('[nvidia] FFMPEG_PATH does not run; Mon voices play at their natural pitch');
  return binary === null ? null : createFfmpegPitchShifter(binary);
}

export interface NvidiaTtsDeps {
  readonly auth: ModelAuthCheck;
  readonly fetch: TtsFetch;
  /** Overrides nvidiaPitchShift(env); tests pass null. */
  readonly pitchShift?: PitchShifter | null;
  /** Speech requests per minute per signed-in Caller. Default 30, like /api/model here. */
  readonly perMinute?: number;
}

/**
 * POST /api/tts and GET /api/tts/face/:id. Same origin only (SIM_PUBLIC_ORIGIN),
 * signed in, and rate-limited per Caller: behind Render's proxy every request
 * shares one socket address, so the Caller id from the token is the key, as
 * /api/model does in nvidia-main.ts. No ELEVENLABS_API_KEY: 204.
 *
 * No Audio2Face renderer here (this entry has no NVIDIA_API_KEY), so the face
 * path answers 204 and the Mon lip-syncs from character timing. Adding one
 * means building the handler once, since it keeps pending faces in memory.
 */
export function createNvidiaTts(env: NvidiaEnv, deps: NvidiaTtsDeps): (req: Request, clientKey: string) => Promise<Response> {
  const limit = createRateLimiter(deps.perMinute ?? 30, { globalPerMinute: 120 });
  const pitchShift = 'pitchShift' in deps ? deps.pitchShift : nvidiaPitchShift(env);
  const allowedOrigin = new URL(env.SIM_PUBLIC_ORIGIN).origin;
  return (req, clientKey) => {
    // Request-local, like /api/model: the handler checks auth before the rate limit.
    let owner: string | undefined;
    const handle = createTtsHandler({
      allowedOrigin,
      apiKey: env.ELEVENLABS_API_KEY,
      fetch: deps.fetch,
      auth: async (authorization) => {
        const actor = await deps.auth(authorization);
        owner = actor.callerId;
        return actor;
      },
      rateLimit: () => limit(owner ?? `unauthenticated:${clientKey}`),
      ...(pitchShift === undefined ? {} : { pitchShift }),
    });
    return handle(req, clientKey);
  };
}
