import type { MetadataRoute } from 'next';
import { monsSlugs } from '../components/mons/starters';
import { buildSitemap } from '../lib/seo';
import { siteUrl } from '../lib/site-url';

// The /mons/[slug] entries come from the same roster as that route's generateStaticParams.
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(siteUrl(), monsSlugs());
}
