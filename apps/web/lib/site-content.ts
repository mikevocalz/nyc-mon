import 'server-only';
import { cache } from 'react';
import { readSitePage } from '@acme/content/site-content';

/** No auth cookies or secrets cross from the marketing site into this anonymous REST read. */
export const getSitePage = cache(async (route: string) => {
  if (process.env.NYCMON_SITE_EDITOR !== '1' || !process.env.PAYLOAD_SITE_API_URL) return null;
  try { return await readSitePage(process.env.PAYLOAD_SITE_API_URL, route); }
  catch (error) {
    console.error('[site-content] Published content unavailable; retaining the shipped page.', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
});
export const siteEmbedOrigins = () => (process.env.SITE_EMBED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
