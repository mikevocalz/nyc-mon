import { z } from 'zod';
import { isLinkableAdult } from '../../../auth/oauth/adult.ts';
import { MemoryConflict, MemoryDeleteSchema, MemoryWriteSchema, type MemoryStore } from './companion-memory-store.ts';

export interface MemoryCaller { readonly callerId: string; readonly user: Record<string, unknown> }
export interface MemoryHandlerDependencies {
  authenticate(request: Request): Promise<MemoryCaller | Response>;
  readonly store: MemoryStore;
  readonly now?: () => number;
}
const Headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
function json(body: unknown, status = 200): Response { return Response.json(body, { status, headers: Headers }); }
function failure(code: string, status: number): Response { return json({ ok: false, error: { code } }, status); }
async function bodyOf(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('content-type');
  if (!request.body) throw new Error('empty');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) { const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength; if (bytes > 8192) { await reader.cancel(); throw new Error('size'); }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}

/** Identity comes exclusively from existing Better Auth / verified on-behalf-of authentication. */
export function createCompanionMemoryHandler(deps: MemoryHandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    if (!['GET', 'PUT', 'DELETE'].includes(request.method)) return failure('METHOD_NOT_ALLOWED', 405);
    try {
      const caller = await deps.authenticate(request);
      if (caller instanceof Response) return caller;
      if (!isLinkableAdult(caller.user, deps.now?.() ?? Date.now()) || caller.user.deletionScheduledFor) return failure('ADULT_REQUIRED', 403);
      // A service header is trusted only after authenticate() has verified its key AND route scope.
      if (request.method !== 'GET' && !request.headers.has('X-NYC-MON-Service-Key') &&
          request.headers.get('origin') !== new URL(request.url).origin) return failure('ORIGIN_REQUIRED', 403);
      if (request.method === 'GET') return json({ ok: true, data: await deps.store.read(caller.callerId) });
      let body: unknown;
      try { body = await bodyOf(request); } catch { return failure('INVALID_RECORD', 400); }
      if (request.method === 'PUT') {
        const input = MemoryWriteSchema.safeParse(body);
        if (!input.success) return failure('INVALID_RECORD', 400);
        return json({ ok: true, data: await deps.store.write(caller.callerId, input.data) });
      }
      const input = MemoryDeleteSchema.safeParse(body);
      if (!input.success) return failure('INVALID_RECORD', 400);
      return json({ ok: true, data: await deps.store.forget(caller.callerId, input.data.expectedRevision) });
    } catch (error) {
      if (error instanceof MemoryConflict) return failure('REVISION_CONFLICT', 409);
      if (error instanceof z.ZodError) return failure('INVALID_RECORD', 400);
      // No raw SQL, personal preference, service key, or provider error is returned.
      return failure('INTERNAL_ERROR', 503);
    }
  };
}
