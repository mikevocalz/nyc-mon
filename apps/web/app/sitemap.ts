import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { readPublishedSiteRoutes } from '@acme/content/site-content';
import { monsSlugs } from '../components/mons/starters';
import { buildSitemap } from '../lib/seo';
import { siteUrl } from '../lib/site-url';
import { siteEditorEnabled } from '../lib/site-content';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteEditorEnabled()) return buildSitemap(siteUrl(), monsSlugs());
  await connection();
  const api = process.env.PAYLOAD_SITE_API_URL;
  if (!api) throw new Error('PAYLOAD_SITE_API_URL is required');
  return (await readPublishedSiteRoutes(api)).map(({ route, updatedAt }) => ({
    url: new URL(route, siteUrl()).href,
    ...(updatedAt ? { lastModified: updatedAt } : {}),
    changeFrequency: route.startsWith('/legal/') ? 'yearly' : 'monthly',
    priority: route === '/' ? 1 : route.startsWith('/legal/') ? 0.3 : 0.7,
  }));
}
