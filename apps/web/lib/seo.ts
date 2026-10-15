import type { Metadata, MetadataRoute } from 'next';

/**
 * Crawl policy for the site. Marketing routes are public and listed in the
 * sitemap; the app-shell routes (no nav link, no working auth yet) stay out of
 * search through NOINDEX metadata. robots.txt does not disallow them: a
 * crawler that is barred from a page never reads its noindex, so an already
 * indexed URL would linger.
 */

/** Static marketing routes, in sitemap order. /mons/[slug] pages are added from the roster. */
export const MARKETING_ROUTES = [
  '/',
  '/story',
  '/mons',
  '/city',
  '/how-it-works',
  '/get',
  '/legal/privacy',
  '/legal/terms',
  '/legal/childrens-privacy',
] as const;

/** App-shell routes kept out of search until the app ships behind auth. */
export const APP_SHELL_ROUTES = [
  '/explore',
  '/profile',
  '/settings',
  '/schedule',
  '/notifications',
  '/sign-in',
  '/spatial',
] as const;

/** `robots` metadata for an app-shell route. */
export const NOINDEX: NonNullable<Metadata['robots']> = { index: false, follow: false };

export function buildRobots(baseUrl: string): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

export function buildSitemap(baseUrl: string, monsSlugs: readonly string[]): MetadataRoute.Sitemap {
  const paths = [...MARKETING_ROUTES, ...monsSlugs.map((slug) => `/mons/${slug}`)];
  return paths.map((path) => ({
    url: path === '/' ? baseUrl : `${baseUrl}${path}`,
    changeFrequency: path.startsWith('/legal/') ? 'yearly' : 'monthly',
    priority: path === '/' ? 1 : path.startsWith('/legal/') ? 0.3 : 0.7,
  }));
}
