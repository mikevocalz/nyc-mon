import { createHash } from 'node:crypto';
import {
  DEFAULT_LINGO_LOCALE,
  LEXICON_ENTRY_TYPES,
  type LexiconRow,
  MON_LINGO_CATEGORIES,
  type MonLingo,
  monLingoFromRows,
  type MonVoicesDoc,
} from '@acme/content/lingo';
import { LIFECYCLE_STAGES, MON_MOODS } from '@acme/core';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import { z } from 'zod';
import { LANGUAGE_LEXICON_SLUG } from '../../../collections/LanguageLexicon.ts';
import { MON_VOICES_SLUG } from '../../../globals/MonVoices.ts';
import { preflight, withCors } from './cors.ts';
import { authenticateCaller, v1Error } from './game.ts';
import { monLingoGeneration } from './mon-lingo-cache.ts';

/**
 * `GET /v1/mon-lingo`: the Mon's lines and lingo as Payload publishes them,
 * for every surface that voices or writes for a Mon (the app, the web
 * simulator, the MCP server for Alexa+).
 *
 * Source: published (canon), active `language-lexicon` rows in the voice
 * categories (`mon-line`, `pronunciation`, `stage-direction`, `word-palette`,
 * `voice-rule`) plus the `mon-voices` global, turned into one `MonLingo` by
 * `monLingoFromRows`, the function the offline fallback also uses.
 *
 * Signed-in Callers and the MCP server's service key (on behalf of a Caller)
 * may read it, like the other `/v1` routes. `?locale=` picks the rows'
 * locale (default en-US).
 *
 * Answers 200 `{ ok: true, data: MonLingo }` with a strong ETag (sha256 of the
 * body) and `cache-control: private, no-cache`, so clients revalidate with
 * `If-None-Match` and get 304 while nothing changed; 400 bad locale; 401/403
 * as the other `/v1` routes; 503 when Payload has no usable `mon-voices` yet
 * (clients keep the lingo they have).
 */

export class MonLingoUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MonLingoUnavailable';
  }
}

const numberish = z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number().finite());
const optionalNumber = z.preprocess((v) => (v === undefined || v === '' ? null : typeof v === 'string' ? Number(v) : v), z.number().finite().nullable());

const MonVoicesDocSchema = z.object({
  provider: z.literal('elevenlabs'),
  model: z.string().min(1),
  lineages: z.array(z.object({ lineageId: z.string().min(1), voiceId: z.string().min(1), name: z.string(), style: numberish, speed: numberish })),
  stagePitch: z.object({ egg: optionalNumber, baby: optionalNumber, small: optionalNumber, mid: optionalNumber, max: optionalNumber }),
  moods: z.array(z.object({ mood: z.enum(MON_MOODS), tag: z.string().nullish(), stability: numberish, similarityBoost: numberish })),
  defaultDelivery: z.object({ tag: z.string().nullish(), stability: numberish, similarityBoost: numberish }),
  lowEnergy: z.object({ moods: z.array(z.enum(MON_MOODS)).nullish().transform((m) => m ?? []), styleFactor: numberish, maxSpeed: numberish }),
});

const nullableText = z.string().nullish();
const LexiconDocSchema = z.object({
  key: z.string(),
  entryType: z.enum(LEXICON_ENTRY_TYPES),
  canonicalText: z.string(),
  spokenForm: nullableText,
  meaning: z.string(),
  category: z.string(),
  subcategory: nullableText,
  triggerText: nullableText,
  responseText: nullableText,
  activationPolicy: z.string(),
  active: z.boolean(),
  speciesId: nullableText,
  bloodlineId: nullableText,
  stage: z.enum(LIFECYCLE_STAGES).nullish(),
  mood: z.enum(MON_MOODS).nullish(),
  variants: nullableText,
  spokenPlural: nullableText,
  sortOrder: optionalNumber.optional(),
  locale: nullableText,
  _status: z.enum(['draft', 'published']).nullish(),
});

/** Payload's `language-lexicon` documents as rows; one malformed row is skipped and logged, not fatal. */
export function lexiconRowsFromDocs(docs: readonly unknown[]): LexiconRow[] {
  const rows: LexiconRow[] = [];
  for (const doc of docs) {
    const parsed = LexiconDocSchema.safeParse(doc);
    if (parsed.success) rows.push(parsed.data as LexiconRow);
    else console.error('[mon-lingo] skipped a malformed lexicon row', (doc as { key?: unknown } | null)?.key ?? '(no key)');
  }
  return rows;
}

/** The `mon-voices` global as the voice reads it; throws {@link MonLingoUnavailable} when it was never seeded or is incomplete. */
export function monVoicesFromDoc(doc: unknown): MonVoicesDoc {
  const parsed = MonVoicesDocSchema.safeParse(doc);
  if (!parsed.success) throw new MonLingoUnavailable('mon-voices is not set up; run the Payload migrations');
  return parsed.data;
}

/** Reads the published lingo straight from Payload (no cache). */
export async function readMonLingoFromPayload(payload: Payload, locale: string = DEFAULT_LINGO_LOCALE): Promise<MonLingo> {
  const [lexicon, voices] = await Promise.all([
    payload.find({
      collection: LANGUAGE_LEXICON_SLUG,
      where: {
        and: [
          { category: { in: [...MON_LINGO_CATEGORIES] } },
          { active: { equals: true } },
          { _status: { equals: 'published' } },
          { locale: { equals: locale } },
        ],
      },
      limit: 0,
      pagination: false,
      depth: 0,
      draft: false,
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: MON_VOICES_SLUG, depth: 0, draft: false, overrideAccess: true }),
  ]);
  return monLingoFromRows(lexiconRowsFromDocs(lexicon.docs), monVoicesFromDoc(voices), locale);
}

export interface ServedMonLingo {
  readonly lingo: MonLingo;
  /** The response body's `data`, serialized once. */
  readonly body: string;
  /** Strong ETag, quoted. */
  readonly etag: string;
}

export interface MonLingoReader {
  read(payload: Payload, locale?: string): Promise<MonLingo>;
  serve(payload: Payload, locale?: string): Promise<ServedMonLingo>;
}

/**
 * Caches the lingo per locale for `ttlMs`, and drops it at once when this
 * process saw a lexicon or `mon-voices` write (mon-lingo-cache.ts).
 */
export function createMonLingoReader(options: {
  ttlMs?: number;
  now?: () => number;
  load?: (payload: Payload, locale: string) => Promise<MonLingo>;
  generation?: () => number;
} = {}): MonLingoReader {
  const ttlMs = options.ttlMs ?? 30_000;
  const now = options.now ?? Date.now;
  const load = options.load ?? readMonLingoFromPayload;
  const generation = options.generation ?? monLingoGeneration;
  const cache = new Map<string, { served: ServedMonLingo; at: number; generation: number }>();
  const serve = async (payload: Payload, locale = DEFAULT_LINGO_LOCALE): Promise<ServedMonLingo> => {
    const hit = cache.get(locale);
    if (hit !== undefined && hit.generation === generation() && now() - hit.at < ttlMs) return hit.served;
    const gen = generation();
    const lingo = await load(payload, locale);
    const body = JSON.stringify({ ok: true, data: lingo });
    const served = { lingo, body, etag: `"${createHash('sha256').update(body).digest('hex')}"` };
    cache.set(locale, { served, at: now(), generation: gen });
    return served;
  };
  return { serve, read: async (payload, locale) => (await serve(payload, locale)).lingo };
}

/** The one reader `/v1/mon-lingo` and `/v1/mon-voice` share in this process. */
export const monLingoReader = createMonLingoReader();

const LOCALE = /^[a-z]{2,3}(-[A-Z]{2})?$/;

/** True when `If-None-Match` names `etag` (a list, weak form, or `*`). */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (ifNoneMatch === null) return false;
  return ifNoneMatch.split(',').some((tag) => {
    const t = tag.trim();
    return t === '*' || t === etag || t === `W/${etag}`;
  });
}

export interface MonLingoDeps {
  readonly getPayload: () => Promise<Payload>;
  readonly reader: MonLingoReader;
  readonly serviceKey?: string;
  readonly now?: () => number;
  readonly corsOrigins: () => Promise<readonly string[]>;
}

const EXPOSED = ['etag'];

export function createMonLingoHandler(deps: MonLingoDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const origin = request.headers.get('origin');
    const allowed = await deps.corsOrigins().catch(() => [] as readonly string[]);
    if (request.method === 'OPTIONS') return preflight(origin, allowed, 'GET, OPTIONS', 'content-type, authorization, if-none-match');
    if (request.method !== 'GET') return v1Error('INVALID_RECORD', 'Method not allowed.', 405);
    return withCors(await answer(request), origin, allowed, EXPOSED);
  };

  async function answer(request: Request): Promise<Response> {
    try {
      const payload = await deps.getPayload();
      const caller = await authenticateCaller(payload, request, { serviceKey: deps.serviceKey, ...(deps.now ? { nowMs: deps.now() } : {}) });
      if (caller instanceof Response) return caller;
      const locale = new URL(request.url).searchParams.get('locale') ?? DEFAULT_LINGO_LOCALE;
      if (!LOCALE.test(locale)) return v1Error('INVALID_RECORD', 'Unknown locale.', 400);

      const served = await deps.reader.serve(payload, locale);
      const headers = { etag: served.etag, 'cache-control': 'private, no-cache', vary: 'Cookie, Authorization' };
      if (etagMatches(request.headers.get('if-none-match'), served.etag)) return new Response(null, { status: 304, headers });
      return new Response(served.body, { status: 200, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
    } catch (error) {
      if (error instanceof MonLingoUnavailable) {
        console.error('[mon-lingo]', error.message);
        return v1Error('INTERNAL_ERROR', 'Lingo unavailable.', 503);
      }
      console.error('[mon-lingo] failed', error instanceof Error ? error.name : 'unknown');
      return v1Error('INTERNAL_ERROR', 'Lingo unavailable.', 500);
    }
  }
}

async function livePayload(): Promise<Payload> {
  const { default: config } = await import('../../../payload.config.ts');
  return getPayload({ config });
}

/** `GET /v1/mon-lingo`, wired to the live Payload. */
export const handleMonLingo = createMonLingoHandler({
  getPayload: livePayload,
  reader: monLingoReader,
  corsOrigins: async () => (await import('../../../auth/options.ts')).PAYLOAD_ORIGINS,
});
