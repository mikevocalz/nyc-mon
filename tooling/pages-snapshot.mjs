// Static snapshot of apps/web for the GitHub Pages preview
// (.github/workflows/pages.yml). Pages can't run Next's server, so this saves
// the server-rendered HTML of every public route from a running `next start`
// built with NEXT_BASE_PATH, then copies the build's static chunks and
// apps/web/public beside it. Server actions (the waitlist form) and client-side
// RSC navigation have no server here: links fall back to full page loads, and
// the form shows its own error state.
//
// The preview must stay out of search, or it competes with the real site as a
// duplicate. Every saved page gets `<meta name="robots" content="noindex,
// nofollow">`, replacing whatever robots meta the route rendered. A robots.txt
// Disallow can't do this job: crawlers read robots.txt only at the host root
// (https://<owner>.github.io/robots.txt, which this repo doesn't control), and
// a crawler that is barred from a page never sees its noindex. So the snapshot
// publishes a permissive robots.txt with no sitemap line, and no sitemap.xml.
//
// Usage: BASE=http://localhost:3600 BASE_PATH=/nyc-mon DIST=apps/web/.next-pages \
//        OUT=pages-out node tooling/pages-snapshot.mjs
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.BASE ?? 'http://localhost:3600').replace(/\/$/, '');
const BASE_PATH = process.env.BASE_PATH ?? '/nyc-mon';
const DIST = path.resolve(process.env.DIST ?? 'apps/web/.next-pages');
const PUBLIC = path.resolve('apps/web/public');
const OUT = path.resolve(process.env.OUT ?? 'pages-out');

const ROUTES = [
  '/', '/story', '/mons', '/city', '/how-it-works', '/get', '/spatial',
  '/legal/privacy', '/legal/terms', '/legal/childrens-privacy',
];
// Non-HTML routes saved under their own names. robots.txt and sitemap.xml are
// left out on purpose; see the header.
const FILES = ['/favicon.ico', '/icon.png', '/apple-icon.png'];

const NOINDEX_META = '<meta name="robots" content="noindex, nofollow"/>';
const ROBOTS_META = /<meta\s+name="robots"[^>]*>/gi;

/** Drops every robots meta the page rendered and puts one noindex meta first in <head>. */
function noindex(html) {
  const stripped = html.replace(ROBOTS_META, '');
  if (!/<head(\s[^>]*)?>/i.test(stripped)) throw new Error('page has no <head>');
  const out = stripped.replace(/<head(\s[^>]*)?>/i, (head) => head + NOINDEX_META);
  const metas = out.match(ROBOTS_META) ?? [];
  if (metas.length !== 1 || metas[0] !== NOINDEX_META) throw new Error('noindex meta was not applied');
  return out;
}

async function get(route) {
  const res = await fetch(BASE + BASE_PATH + (route === '/' ? '' : route), { redirect: 'manual' });
  return res;
}

function write(rel, data) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// The /mons/[slug] pages, read from the sitemap so new Bloodlines are included.
const sitemap = await (await get('/sitemap.xml')).text();
for (const [, loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const route = new URL(loc).pathname.replace(BASE_PATH, '') || '/';
  if (!ROUTES.includes(route)) ROUTES.push(route);
}

const failures = [];
for (const route of ROUTES) {
  const res = await get(route);
  if (res.status !== 200) { failures.push(`${route} → ${res.status}`); continue; }
  const html = await res.text();
  write(path.join(route, 'index.html'), noindex(html));
  // Open Graph images live at hashed URLs; save each one the page points at.
  for (const [, url] of html.matchAll(/property="og:image" content="([^"]+)"/g)) {
    const p = new URL(url).pathname.replace(BASE_PATH, '');
    const img = await get(p.split('?')[0]);
    if (img.status === 200) write(p.split('?')[0], Buffer.from(await img.arrayBuffer()));
  }
  console.log(`page ${route}`);
}
for (const route of FILES) {
  const res = await get(route);
  if (res.status !== 200) { failures.push(`${route} → ${res.status}`); continue; }
  write(route, Buffer.from(await res.arrayBuffer()));
}

// GitHub Pages serves 404.html for unknown paths.
const missing = await get('/__pages-snapshot-404');
write('404.html', noindex(await missing.text()));
// Lets any crawler that does read it reach the pages and their noindex.
write('robots.txt', 'User-agent: *\nAllow: /\n');

fs.cpSync(path.join(DIST, 'static'), path.join(OUT, '_next', 'static'), { recursive: true });
fs.cpSync(PUBLIC, OUT, { recursive: true });
// Don't let Pages run Jekyll: it drops `_next`.
write('.nojekyll', '');

if (failures.length) {
  console.error(`pages-snapshot: ${failures.length} route(s) failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`pages-snapshot: ${ROUTES.length} pages → ${OUT}`);
