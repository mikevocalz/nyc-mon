import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { readSitePage } from '@acme/content/site-content';

export const siteEditorEnabled = () => process.env.NYCMON_SITE_EDITOR === '1';
/** Enabled sites never resurrect bundled content after unpublishing, nor hide a CMS outage as a successful old page. */
export const getSitePage = cache(async (route: string, required = true) => {
  if (!siteEditorEnabled()) return null;
  await connection();
  const base = process.env.PAYLOAD_SITE_API_URL;
  if (!base) throw new Error('PAYLOAD_SITE_API_URL is required when the website editor is enabled.');
  const page = await readSitePage(base, route);
  if (!page && required) notFound();
  return page;
});
export const siteEmbedOrigins = () => (process.env.SITE_EMBED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
