import assert from 'node:assert/strict';
import test from 'node:test';
import { siteHref } from './site-href.ts';

const BASE_PATH = '/nyc-mon';

test('siteHref: plain anchors remain inside the GitHub Pages project', () => {
  for (const href of ['/get', '/mons', '/mons/hood-ratti/', '/legal/privacy', '/legal/childrens-privacy']) {
    assert.equal(siteHref(href, BASE_PATH), `${BASE_PATH}${href}`);
  }
});

test('siteHref: the home link keeps its trailing slash and optional suffix', () => {
  assert.equal(siteHref('/', BASE_PATH), '/nyc-mon/');
  assert.equal(siteHref('/?source=footer#top', BASE_PATH), '/nyc-mon/?source=footer#top');
});

test('siteHref: query strings and fragments are preserved exactly', () => {
  for (const href of ['/get?source=story', '/mons#starters', '/get?next=%2Fmons#waitlist', '/mons#section?part=1']) {
    assert.equal(siteHref(href, BASE_PATH), `${BASE_PATH}${href}`);
  }
});

test('siteHref: already-prefixed URLs are not prefixed twice', () => {
  for (const href of ['/nyc-mon', '/nyc-mon/', '/nyc-mon/mons', '/nyc-mon?source=footer', '/nyc-mon#top', '/nyc-mon/get?source=hero#waitlist']) {
    assert.equal(siteHref(href, BASE_PATH), href);
    assert.equal(siteHref(siteHref(href, BASE_PATH), BASE_PATH), href);
  }
});

test('siteHref: the prefix must match a complete path segment', () => {
  assert.equal(siteHref('/nyc-monsters', BASE_PATH), '/nyc-mon/nyc-monsters');
  assert.equal(siteHref('/nyc-mon-extra?source=story', BASE_PATH), '/nyc-mon/nyc-mon-extra?source=story');
});

test('siteHref: absolute and protocol-relative external links are unchanged', () => {
  for (const href of ['https://example.com/mons?source=story#top', 'http://example.com', '//example.com/mons', 'mailto:hello@example.com', 'tel:+12125550100']) {
    assert.equal(siteHref(href, BASE_PATH), href);
  }
});

test('siteHref: relative, query-only, fragment-only and empty links stay local to the current page', () => {
  for (const href of ['', 'mons', './mons', '../mons', '?source=story', '#waitlist']) {
    assert.equal(siteHref(href, BASE_PATH), href);
  }
});

test('siteHref: root deployments preserve all URLs', () => {
  for (const basePath of ['', '/']) {
    for (const href of ['/', '/mons', '/get?source=hero#waitlist', '//example.com']) {
      assert.equal(siteHref(href, basePath), href);
    }
  }
});

test('siteHref: tolerates a trailing slash and supports a nested deployment prefix', () => {
  assert.equal(siteHref('/mons', '/nyc-mon/'), '/nyc-mon/mons');
  assert.equal(siteHref('/mons', '/preview/nyc-mon'), '/preview/nyc-mon/mons');
  assert.equal(siteHref('/preview/nyc-mon?source=footer', '/preview/nyc-mon/'), '/preview/nyc-mon?source=footer');
});

test('siteHref: defaults to the public build-time base path', (t) => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  t.after(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = original;
  });

  process.env.NEXT_PUBLIC_BASE_PATH = BASE_PATH;
  assert.equal(siteHref('/mons'), '/nyc-mon/mons');
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  assert.equal(siteHref('/mons'), '/mons');
});
