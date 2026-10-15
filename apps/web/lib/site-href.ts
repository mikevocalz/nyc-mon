/**
 * Resolve root-relative URLs for plain anchors in the web app. Next/Solito
 * links already apply basePath; the universal UI kit's anchors do not.
 * next.config.ts supplies this build-time prefix for the GitHub Pages snapshot.
 */
export function siteHref(href: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''): string {
  if (!basePath || !href.startsWith('/') || href.startsWith('//')) return href;

  const prefix = basePath.replace(/\/+$/, '');
  if (!prefix) return href;

  // Compare the path alone so an already-prefixed query or fragment stays intact.
  const pathname = href.split(/[?#]/, 1)[0];
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return href;

  return `${prefix}${href}`;
}
