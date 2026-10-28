import { createRequire } from 'node:module';
import type { ModelAuthCheck } from './model-auth.ts';
import { createRateLimiter } from './model.ts';
import type { NvidiaEnv } from './nvidia-env.ts';
import { createFfmpegPitchShifter, createTtsHandler, findFfmpeg, type PitchShifter, type TtsFetch } from './tts.ts';

/**
 * The Mon's voice on the NVIDIA companion: the same /api/tts handler the
 * simulator mounts (server/main.ts), behind the same sign-in as /api/model and
 * /api/memory. Kept apart from nvidia-main.ts, which starts a server on import.
 */

function socketOrigin(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`;
}

/** The page CSP. `media-src blob:` is for the /api/tts clip, which plays from a blob: URL. */
export function nvidiaCsp(env: NvidiaEnv): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    // /api/asr is a WebSocket on this origin; older engines don't match ws(s): against 'self'.
    `connect-src 'self' ${socketOrigin(env.SIM_PUBLIC_ORIGIN)} ${new URL(env.SIM_MCP_URL).origin} ${new URL(env.AUTH_ISSUER).origin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * The ffmpeg binary from the pinned `ffmpeg-static` package, downloaded for
 * the build host at install time. Render's native Node runtime has no ffmpeg,
 * so this is what runs there. Null when the package has no binary for this
 * platform or is missing.
 */
export function bundledFfmpeg(): string | null {
  try {
    const path = createRequire(import.meta.url)('ffmpeg-static') as string | null;
    return typeof path === 'string' && path ? path : null;
  } catch {
    return null;
  }
}

/**
 * The stage pitch shift. FFMPEG_PATH, when set, is the binary; null when it
 * does not run (the clip keeps the voice's own pitch). Unset: the bundled
 * ffmpeg-static binary when it runs, else undefined, so tts.ts looks for
 * `ffmpeg` on PATH on first use.
 */
export function nvidiaPitchShift(
  env: NvidiaEnv,
  find: (candidate?: string) => string | null = findFfmpeg,
  bundled: string | null = bundledFfmpeg(),
): PitchShifter | null | undefined {
  if (env.FFMPEG_PATH === undefined) {
    const binary = bundled === null ? null : find(bundled);
    if (binary === null) return undefined;
    console.info('[nvidia] stage pitch shift: bundled ffmpeg-static');
    return createFfmpegPitchShifter(binary);
  }
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
  /** One line per request: method, status, lineage, stage, applied pitch, time. Never the text. Default console.info. */
  readonly log?: (line: string) => void;
}

const LINEAGE = /^[a-z0-9-]+\/[a-z]+\/\d+$/;
const STAGE = /^[A-Za-z]+$/;

/** Lineage and stage from a /api/tts body, only when they look like ids; nothing else is read. */
async function voiceOf(req: Request): Promise<{ lineage: string; stage: string }> {
  try {
    const body = JSON.parse(await req.text()) as { lineageId?: unknown; stage?: unknown };
    const lineage = typeof body.lineageId === 'string' && LINEAGE.test(body.lineageId) ? body.lineageId : '-';
    const stage = typeof body.stage === 'string' && STAGE.test(body.stage) ? body.stage : '-';
    return { lineage, stage };
  } catch {
    return { lineage: '-', stage: '-' };
  }
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
  const log = deps.log ?? ((line: string) => console.info(line));
  return async (req, clientKey) => {
    const started = performance.now();
    const voice = req.method === 'POST' ? voiceOf(req.clone()) : Promise.resolve({ lineage: '-', stage: '-' });
    const res = await handle(req, clientKey);
    const { lineage, stage } = await voice;
    log(`[nvidia-tts] ${req.method} ${res.status} lineage=${lineage} stage=${stage} pitch=${res.headers.get('x-mon-pitch') ?? '-'} ms=${Math.round(performance.now() - started)}`);
    return res;
  };
  function handle(req: Request, clientKey: string): Promise<Response> {
    // Request-local, like /api/model: the handler checks auth before the rate limit.
    let owner: string | undefined;
    const handleOne = createTtsHandler({
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
    return handleOne(req, clientKey);
  }
}
