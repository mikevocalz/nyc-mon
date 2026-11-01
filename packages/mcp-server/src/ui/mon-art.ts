/**
 * The approved console still for a Mon form (Payload `mon-art`), resolved on
 * the server so the view gets a ready URL in the tool result. The view tries
 * it first, then its bundled still, then Coming Soon (view/MonView.tsx).
 *
 * The view's CSP allows images from one origin besides `data:`
 * (NYC_MON_ART_ORIGIN, the Bunny CDN). A still served from anywhere else
 * would be blocked, so it is dropped here and the bundled still shows. With
 * the origin unset the source never fetches.
 */
import { monArtUrl, parseMonArt, type AdminStill } from '@acme/app/features/mons/mon-art-docs.ts';

/** What the view needs to draw a console still. */
export interface MonStill {
  readonly url: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export interface MonArtSource {
  /** The approved still for a species id, or undefined (none, or the read failed). Never throws. */
  stillFor(speciesId: string): Promise<MonStill | undefined>;
}

export interface MonArtOptions {
  /** The Payload origin whose `/payload-api/mon-art` lists approved stills (admin-vite, V1_BASE_URL). */
  readonly payloadOrigin: string;
  /** The CDN origin the view's CSP allows; stills elsewhere are dropped. Null turns the source off. */
  readonly artOrigin: string | null;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  /** How long a list is reused before the next call refreshes it. */
  readonly ttlMs?: number;
  /** Budget for the first read. Alexa's whole round trip is 500 ms, so this stays small. */
  readonly timeoutMs?: number;
}

export const MON_ART_TTL_MS = 5 * 60 * 1000;
const FIRST_READ_TIMEOUT_MS = 250;

const NONE: MonArtSource = { stillFor: async () => undefined };

/** The CDN origin from NYC_MON_ART_ORIGIN, or null when unset or not an https URL. */
export function artOriginFrom(env: Record<string, string | undefined>): string | null {
  const raw = env.NYC_MON_ART_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export const MON_ART_ORIGIN = artOriginFrom(process.env);

/**
 * A cached reader over the approved stills. The first call waits up to
 * `timeoutMs`; later calls answer from the cache at once and refresh it in the
 * background once it is older than `ttlMs`. A failed read keeps the last list.
 */
export function createMonArtSource(options: MonArtOptions): MonArtSource {
  const { payloadOrigin, artOrigin } = options;
  if (artOrigin === null || !payloadOrigin) return NONE;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? MON_ART_TTL_MS;
  const timeoutMs = options.timeoutMs ?? FIRST_READ_TIMEOUT_MS;

  let stills: ReadonlyMap<string, AdminStill> | null = null;
  let loadedAt = 0;
  let inflight: Promise<void> | null = null;

  const refresh = (): Promise<void> => {
    inflight ??= (async () => {
      try {
        const response = await fetchImpl(monArtUrl(payloadOrigin), { signal: AbortSignal.timeout(timeoutMs * 4) });
        if (response.ok) {
          const usable = parseMonArt(await response.json()).filter((s) => new URL(s.url).origin === artOrigin);
          stills = new Map(usable.map((s) => [s.speciesId, s]));
        }
      } catch {
        // Unreachable or a bad body: keep the last list (or none).
      }
      loadedAt = now();
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  };

  return {
    async stillFor(speciesId) {
      if (stills === null && loadedAt === 0) {
        await Promise.race([refresh(), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
      } else if (now() - loadedAt >= ttlMs) {
        void refresh();
      }
      const still = stills?.get(speciesId);
      return still === undefined ? undefined : { url: still.url, alt: still.alt, width: still.width, height: still.height };
    },
  };
}
