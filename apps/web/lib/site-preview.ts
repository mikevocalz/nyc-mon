import 'server-only';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { PREVIEW_COOKIE, verifyPreview } from '@acme/content/site-preview';
import { parseSitePage, record } from '@acme/content/site-content';
export const activePreview = cache(async () => {
  if (process.env.NYCMON_SITE_EDITOR !== '1') return null;
  const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!token) return null;
  // Expiry must be checked at request time, never during a speculative prerender.
  await connection();
  const grant = verifyPreview(token, process.env.SITE_PREVIEW_SECRET ?? '', process.env.NEXT_PUBLIC_SITE_URL ?? '');
  return grant ? {token, grant} : null;
});
export async function previewDocument(preview: NonNullable<Awaited<ReturnType<typeof activePreview>>>) {
  const base = process.env.PAYLOAD_SITE_API_URL;
  if (!base) throw new Error('Preview API is not configured');
  const response = await fetch(`${base.replace(/\/$/, '')}/site-preview/content`, {
    headers: {Authorization: `Bearer ${preview.token}`}, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Preview access expired or the draft is unavailable');
  const value: unknown = await response.json();
  if (!record(value) || String(value.id) !== preview.grant.id || value.route !== preview.grant.route) throw new Error('Invalid preview document');
  // Published parser remains strict for public reads. Only the authenticated, scoped endpoint reaches this projection.
  const page = parseSitePage({...value, _status: 'published'});
  if (!page) throw new Error('Invalid draft content');
  return {page, stamp: typeof value.updatedAt === 'string' ? value.updatedAt : ''};
}
