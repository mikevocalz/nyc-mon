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
  // Accept the dex key (dex-002) or the old file stem (squeaklet): /mons/*.glb
  // links keep working while every client moves to the dex key.
  const STEM_TO_DEX: Readonly<Record<string, string>> = {
    'metro-egg': 'dex-001',
    squeaklet: 'dex-002',
    'lil-ratti': 'dex-003',
  };
  const cleaned = speciesId.replace(/[^a-z0-9-]/g, '');
  const species = cleaned.startsWith('dex-') ? cleaned : STEM_TO_DEX[cleaned];
  if (species === undefined || !/^dex-\d+$/.test(species)) return new Response(null, { status: 404 });
  const payload = await livePayload();
  const found = await payload.find({
    collection: 'mon-models',
    where: { and: [{ status: { equals: 'approved' } }, { speciesId: { equals: species } }] },
    limit: 1,
    depth: 0,
  });
  const doc = found.docs[0] as { url?: string; filename?: string } | undefined;
  const raw = doc?.url;
  if (raw === undefined) return new Response(null, { status: 404 });
  // `url` is a relative /payload-api/mon-models/file/... path: the caller's
  // origin here is the admin host, so serve the file through it.
  const origin = new URL(request.url).origin;
  const url = raw.startsWith('/') ? `${origin}${raw}` : raw;
  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
  });
}
