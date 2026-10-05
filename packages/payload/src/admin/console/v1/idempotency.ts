import { getPayload } from 'payload';
import type { Payload } from 'payload';
import { IDEMPOTENCY_RECORDS_SLUG } from '../../../collections/IdempotencyRecords.ts';

/**
 * ADR 0001 (docs/adr/0001-auth-and-identity.md): "Every mutating `/v1` call
 * sends an Idempotency-Key header so a retried request returns the first
 * response." The header name and the `Idempotent-Replayed` marker follow
 * draft-ietf-httpapi-idempotency-key
 * (https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/).
 */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** Sent on a stored-response replay (draft §2.5). */
const REPLAYED_HEADER = 'Idempotent-Replayed';

export type V1Handler<Args extends unknown[] = unknown[]> = (
  request: Request,
  ...args: Args
) => Promise<Response>;

/**
 * Who an Idempotency-Key belongs to: `callerId` for a signed-in Caller,
 * `null` for an anonymous request (`POST /v1/guardian-consents`, which runs
 * before any account exists and is therefore scoped by key + path only).
 */
export interface IdempotencyScope {
  callerId: string | number | null;
}

export interface WithIdempotencyOptions {
  /**
   * `caller` (default) resolves the signed-in user through `payload.auth` and
   * scopes the key to them; `anonymous` scopes by key + path only.
   */
  scope?: 'caller' | 'anonymous';
  /** Test seam — real callers leave this unset and get the live Payload. */
  payload?: Payload;
}

async function getPayloadInstance(): Promise<Payload> {
  const { default: config } = await import('../../../payload.config.ts');
  return getPayload({ config });
}

function readIdempotencyKey(request: Request): string | null {
  const key = request.headers.get(IDEMPOTENCY_KEY_HEADER);
  if (key === null) return null;
  const trimmed = key.trim();
  return trimmed === '' ? null : trimmed;
}

function endpointPath(request: Request): string {
  try {
    return `${request.method} ${new URL(request.url).pathname}`;
  } catch {
    return request.method;
  }
}

/** `caller:41|POST /v1/eggs|abc-123`, or `anonymous|…` with no account. */
function scopedKey(scope: IdempotencyScope, path: string, rawKey: string): string {
  const owner = scope.callerId === null ? 'anonymous' : `caller:${String(scope.callerId)}`;
  return `${owner}|${path}|${rawKey}`;
}

async function findRecord(payload: Payload, key: string): Promise<Record<string, unknown> | undefined> {
  const stored = await payload.find({
    collection: IDEMPOTENCY_RECORDS_SLUG,
    where: { key: { equals: key } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc: unknown = stored.docs[0];
  return typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>) : undefined;
}

/** Rebuilds the stored response byte-identically in status, body and content-type. */
function replayResponse(doc: Record<string, unknown>): Response | undefined {
  const { status, body, contentType } = doc;
  if (typeof status !== 'number' || typeof body !== 'string') return undefined;
  return new Response(body, {
    status,
    headers: {
      'Content-Type': typeof contentType === 'string' ? contentType : 'application/json',
      [REPLAYED_HEADER]: 'true',
    },
  });
}

/**
 * Runs `run` once per `(scope, path, Idempotency-Key)`. On a stored hit it
 * replays the first response without calling `run`; on a miss it calls `run`,
 * persists any non-5xx response (a 5xx may differ on retry, so it never
 * caches), and returns it. No `Idempotency-Key` header → `run` passes through.
 *
 * The read and the write both use `overrideAccess: true`: the collection is
 * `access: nobody` to every request. The write happens after the handler's own
 * transaction has already committed, so it cannot join it.
 */
export async function runIdempotent(
  payload: Payload,
  scope: IdempotencyScope,
  request: Request,
  run: () => Promise<Response>,
): Promise<Response> {
  const rawKey = readIdempotencyKey(request);
  if (rawKey === null) return run();

  const path = endpointPath(request);
  const key = scopedKey(scope, path, rawKey);

  const hit = await findRecord(payload, key);
  if (hit !== undefined) {
    const replayed = replayResponse(hit);
    if (replayed !== undefined) return replayed;
  }

  const response = await run();
  if (response.status >= 500) return response;

  const body = await response.text();
  const record = {
    key,
    path,
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'application/json',
    body,
  };
  try {
    await payload.create({
      collection: IDEMPOTENCY_RECORDS_SLUG,
      data: record,
      depth: 0,
      overrideAccess: true,
    });
  } catch (error) {
    // A concurrent retry with the same key won the unique-index race: replay
    // what it stored. Any other write failure is logged and the response this
    // request produced is still returned.
    payload.logger.warn({ err: error }, '[v1] idempotency record was not stored');
    const raced = await findRecord(payload, key);
    const replayed = raced === undefined ? undefined : replayResponse(raced);
    if (replayed !== undefined) return replayed;
  }
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Wrap-at-export form for handlers that don't already resolve the caller.
 * `scope: 'caller'` (default) runs one `payload.auth` read to key the record
 * to the account; `scope: 'anonymous'` is for `POST /v1/guardian-consents`,
 * which runs before any account exists.
 *
 * Handlers built on `buildContext` (the v1 game handlers) call
 * {@link runIdempotent} after it instead — `callerId` is already resolved
 * there, so no second auth read is needed.
 */
export function withIdempotency<Args extends unknown[]>(
  handler: V1Handler<Args>,
  options: WithIdempotencyOptions = {},
): V1Handler<Args> {
  const scope = options.scope ?? 'caller';
  return async (request, ...args) => {
    if (readIdempotencyKey(request) === null) return handler(request, ...args);
    const payload = options.payload ?? (await getPayloadInstance());
    let callerId: string | number | null = null;
    if (scope === 'caller') {
      try {
        const { user } = await payload.auth({ headers: request.headers });
        const id = (user as { id?: string | number } | null)?.id;
        callerId = id ?? null;
      } catch {
        callerId = null;
      }
    }
    return runIdempotent(payload, { callerId }, request, () => handler(request, ...args));
  };
}
