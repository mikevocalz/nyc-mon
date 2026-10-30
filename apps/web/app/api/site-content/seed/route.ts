import { timingSafeEqual } from 'node:crypto';
import { buildHomeSeed } from '../../../../components/home/cms-seed';

/** Temporary, read-only migration export. Disabled unless an operator sets a separate 32+ character token. */
export async function GET(request: Request) {
  const token = process.env.SITE_CONTENT_SEED_TOKEN;
  const expected = Buffer.from(`Bearer ${token ?? ''}`);
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  if (process.env.NYCMON_SITE_EDITOR !== '1' || !token || token.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response(null, { status: 404 });
  return Response.json(buildHomeSeed(new URL(request.url).origin), { headers: { 'Cache-Control': 'no-store' } });
}
