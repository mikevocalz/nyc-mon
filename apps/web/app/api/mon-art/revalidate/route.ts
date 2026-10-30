import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { MON_ART_TAG } from '../../../../lib/mon-art';

const NO_STORE = { 'Cache-Control': 'no-store' };

function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Called by Payload's `mon-art` afterChange and afterDelete hooks
 * (packages/payload/src/collections/monArtRevalidate.ts) so a still approved
 * in the console shows on the site within seconds, with no redeploy.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.MON_ART_REVALIDATE_SECRET ?? '';
  const given = request.headers.get('x-revalidate-secret') ?? '';
  if (!expected || !secretMatches(given, expected)) return NextResponse.json({ revalidated: false }, { status: 401, headers: NO_STORE });
  revalidateTag(MON_ART_TAG, { expire: 0 });
  return NextResponse.json({ revalidated: true, tag: MON_ART_TAG }, { headers: NO_STORE });
}
