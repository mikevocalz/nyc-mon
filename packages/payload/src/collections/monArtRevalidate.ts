import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload';

/**
 * Tells the website to drop its cached Mon stills, so an approved upload shows
 * on nyc-mon.city within seconds and with no redeploy. The site's route is
 * apps/web/app/api/mon-art/revalidate.
 *
 * MON_ART_REVALIDATE_URL is that route's full URL (comma-separated for more
 * than one site); MON_ART_REVALIDATE_SECRET is shared with the site. Without
 * them the call is skipped and the site picks the change up within a minute
 * (its cache lifetime, apps/web/lib/mon-art.ts). A failed call never fails
 * the save: the upload is already stored.
 */
export async function revalidateMonArt(req: Pick<PayloadRequest, 'payload'>, env: Partial<Record<string, string | undefined>> = process.env, send: typeof fetch = fetch): Promise<number> {
  const urls = (env.MON_ART_REVALIDATE_URL ?? '').split(',').map((url) => url.trim()).filter(Boolean);
  const secret = env.MON_ART_REVALIDATE_SECRET ?? '';
  if (!urls.length || !secret) return 0;
  const results = await Promise.allSettled(urls.map(async (url) => {
    const response = await send(url, { method: 'POST', headers: { 'x-revalidate-secret': secret }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  }));
  let sent = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') sent += 1;
    else req.payload.logger.warn({ msg: '[mon-art] site revalidation failed; the site refreshes within a minute', err: result.reason });
  }
  return sent;
}

/**
 * After the Bunny hook has stored the file and written its URL. The URL write
 * is a nested update flagged `skipBunnyMedia`; it carries the same doc, so
 * only the outer save revalidates.
 */
export const monArtAfterChange: CollectionAfterChangeHook = async ({ doc, req, context }) => {
  if (!context?.skipBunnyMedia) await revalidateMonArt(req);
  return doc;
};

export const monArtAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await revalidateMonArt(req);
  return doc;
};
