import type {} from '@payloadcms/db-postgres';
import { getPayload } from 'payload';
import { authenticateCaller } from './game.ts';
import { createCompanionMemoryHandler } from './companion-memory-handler.ts';
import { PostgresMemoryStore } from './companion-memory-store.ts';

/** The existing admin-vite/Payload backend owns auth, the Neon pool, and durable memory. */
export async function handleCompanionMemory(request: Request): Promise<Response> {
  try {
    const { default: config } = await import('../../../payload.config.ts');
    const payload = await getPayload({ config });
    const store = new PostgresMemoryStore({ query: (text, values) => payload.db.pool.query(text, values) });
    return createCompanionMemoryHandler({
      authenticate: (req) => authenticateCaller(payload, req), store,
    })(request);
  } catch {
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR' } }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
