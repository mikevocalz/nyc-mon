import type { Payload } from 'payload';
import { getPayload } from 'payload';

/**
 * `GET /v1/mon-models/glb/:species` 302s to the approved MonModels row's CDN
 * object (`url` from bunnyMediaAfterRead). Species stay code-only; the file
 * comes from the console's Models page — nothing under /mons/.
 */
async function livePayload(): Promise<Payload> {
  const { default: config } = await import('../../payload.config.ts');
  return getPayload({ config });
}

export async function handleMonModelGlb(request: Request, speciesId: string): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  }
  const species = speciesId.replace(/[^a-z0-9-]/g, '');
  if (!species) return new Response(null, { status: 404 });
  const payload = await livePayload();
  const found = await payload.find({
    collection: 'mon-models',
    where: { and: [{ status: { equals: 'approved' } }, { speciesId: { equals: species } }] },
    limit: 1,
    depth: 0,
  });
  const doc = found.docs[0] as { url?: string; filename?: string } | undefined;
  const url = doc?.url ?? (doc?.filename ? undefined : undefined);
  if (!url) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
  });
}
