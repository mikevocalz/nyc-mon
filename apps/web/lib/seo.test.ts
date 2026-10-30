import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_SHELL_ROUTES, MARKETING_ROUTES, NOINDEX, buildRobots, buildSitemap } from './seo.ts';
import { FALLBACK_SITE_URL, resolveSiteUrl } from './site-url.ts';

const BASE = 'https://nyc-mon.test';
const SLUGS = ['hood-ratti', 'bodega-cee', 'yotes', 'lanternfye'];

test('resolveSiteUrl: trims the trailing slash and falls back when unset or invalid', () => {
  assert.equal(resolveSiteUrl('https://nyc-mon.test/'), 'https://nyc-mon.test');
  assert.equal(resolveSiteUrl(' https://nyc-mon.test/sub/ '), 'https://nyc-mon.test/sub');
  assert.equal(resolveSiteUrl(undefined), FALLBACK_SITE_URL);
  assert.equal(resolveSiteUrl(''), FALLBACK_SITE_URL);
  assert.equal(resolveSiteUrl('not a url'), FALLBACK_SITE_URL);
  assert.equal(resolveSiteUrl('ftp://nyc-mon.test'), FALLBACK_SITE_URL);
});

test('robots: allows the whole site and points at the sitemap; app shells rely on noindex', () => {
  const robots = buildRobots(BASE);
  assert.ok(!Array.isArray(robots.rules));
  assert.equal(robots.rules.userAgent, '*');
  assert.equal(robots.rules.allow, '/');
  assert.equal(robots.rules.disallow, undefined);
  assert.equal(robots.sitemap, `${BASE}/sitemap.xml`);
});

test('sitemap: lists the marketing routes and each /mons slug, absolute, and no app-shell route', () => {
  const urls = buildSitemap(BASE, SLUGS).map((entry) => entry.url);
  assert.deepEqual(urls, [
    BASE,
    `${BASE}/story`,
    `${BASE}/mons`,
    `${BASE}/city`,
    `${BASE}/how-it-works`,
    `${BASE}/get`,
    `${BASE}/legal/privacy`,
    `${BASE}/legal/terms`,
    `${BASE}/legal/childrens-privacy`,
    `${BASE}/mons/hood-ratti`,
    `${BASE}/mons/bodega-cee`,
    `${BASE}/mons/yotes`,
    `${BASE}/mons/lanternfye`,
  ]);
  for (const route of APP_SHELL_ROUTES) {
    assert.ok(!urls.some((url) => url.startsWith(`${BASE}${route}`)), `${route} must not be in the sitemap`);
  }
});

test('marketing and app-shell routes never overlap', () => {
  const shell = new Set<string>(APP_SHELL_ROUTES);
  assert.ok(MARKETING_ROUTES.every((route) => !shell.has(route)));
});

test('NOINDEX: app-shell metadata opts out of indexing and link following', () => {
  assert.deepEqual(NOINDEX, { index: false, follow: false });
});
