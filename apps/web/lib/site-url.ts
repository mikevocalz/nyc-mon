/**
 * The site's public origin, for metadataBase, canonicals, robots.txt and the
 * sitemap. Reads NEXT_PUBLIC_SITE_URL (apps/web/.env.example); no production
 * domain is recorded in the repo yet, so the fallback is the local dev server.
 */
export const FALLBACK_SITE_URL = 'http://localhost:3000';

/** Normalizes `raw` to an origin-plus-path with no trailing slash; falls back when unset or invalid. */
export function resolveSiteUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return FALLBACK_SITE_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return FALLBACK_SITE_URL;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return FALLBACK_SITE_URL;
  }
}

/** The site's public base URL, e.g. `https://example.com` (no trailing slash). */
export function siteUrl(): string {
  const url = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.NODE_ENV === 'production' && url === FALLBACK_SITE_URL && !warnedFallback) {
    warnedFallback = true;
    // Canonicals, og:image, robots.txt and the sitemap would all point at localhost.
    console.warn('[site-url] NEXT_PUBLIC_SITE_URL is unset or invalid in a production build; using ' + FALLBACK_SITE_URL + '.');
  }
  return url;
}

let warnedFallback = false;
