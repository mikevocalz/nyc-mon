import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { provideAdminStills, type AdminStill } from '../components/mons/still-art';
import { parseMonArt } from './mon-art-parse';

/** The cache tag the console's revalidation call clears (app/api/mon-art/revalidate). */
export const MON_ART_TAG = 'mon-art';

/**
 * The approved stills from Payload. Cached under MON_ART_TAG for at most a
 * minute: an approve in the console clears the tag at once, and the minute is
 * the ceiling when that call cannot reach the site. Any failure reads as no
 * console art, so the bundled stills show.
 */
export async function getMonArt(): Promise<AdminStill[]> {
  'use cache';
  cacheTag(MON_ART_TAG);
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  const base = process.env.PAYLOAD_SITE_API_URL;
  if (!base) return [];
  try {
    const url = `${base.replace(/\/$/, '')}/mon-art?where[status][equals]=approved&depth=0&limit=200`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    return parseMonArt(await response.json());
  } catch {
    return [];
  }
}

/** Read the console stills and hand them to this request's art maps. Await it before rendering a page with Mon art. */
export async function loadMonArt(): Promise<void> {
  provideAdminStills(await getMonArt());
}
