import { previewOrigin } from '@acme/content/site-preview';
import { timingSafeEqual } from 'node:crypto';
import { buildWebsiteSeed } from '../../../../components/cms/website-seed';

/** Temporary, read-only migration export. Disabled unless an operator sets a separate 32+ character token. */
export async function GET(request: Request) {
  const token = process.env.SITE_CONTENT_SEED_TOKEN;
  const expected = Buffer.from(`Bearer ${token ?? ''}`);
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  if (!token || token.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response(null, { status: 404 });
  const source = process.env.SITE_SEED_SOURCE_ORIGIN ?? process.env.SITE_PUBLIC_URL;
  if (!source) return Response.json({ error: 'Configure the explicit site seed origin first.' }, { status: 503 });
  return Response.json(buildWebsiteSeed(previewOrigin(source)), { headers: { 'Cache-Control': 'no-store' } });
}
