// Read-only HTML/asset contract for a locally served GitHub Pages build.
// No browser, mutation, form submission, snapshot publication or deployment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3611';
const PREFIX = process.env.BASE_PATH ?? '/nyc-mon';
const ROUTES = ['/', '/mons', '/mons/hood-ratti', '/mons/bodega-cee', '/mons/yotes', '/mons/lanternfye', '/city', '/how-it-works', '/story', '/get', '/legal/privacy', '/legal/terms', '/legal/childrens-privacy'];
const report = { base: BASE, prefix: PREFIX, checks: [], visual: 'NOT RUN', browserNavigation: 'NOT RUN' };
const attrs = (text, key) => new RegExp(`\\b${key}="([^"]*)"`).exec(text)?.[1];
const plain = (text) => text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const anchors = (html) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, text]) => ({ href: attrs(attributes, 'href'), label: attrs(attributes, 'aria-label'), text: plain(text) }));
const images = new Set();
for (const route of ROUTES) {
  try {
    const response = await fetch(BASE + PREFIX + (route === '/' ? '' : route));
    assert.equal(response.status, 200, `${route}: status`);
    const html = await response.text();
    const links = anchors(html);
    for (const link of links) {
      if (!link.href?.startsWith('/') || link.href.startsWith('//')) continue;
      assert.ok(link.href === PREFIX || link.href.startsWith(`${PREFIX}/`) || link.href.startsWith(`${PREFIX}#`), `${route}: unprefixed anchor ${JSON.stringify(link)}`);
    }
    if (route.startsWith('/mons/')) {
      assert.equal(links.find((link) => link.text === 'Back to the Mons')?.href, `${PREFIX}/mons`);
    }
    if (route === '/how-it-works' || route === '/story' || route === '/') {
      assert.ok(links.some((link) => link.text === 'Join the waitlist' && link.href === `${PREFIX}/get`));
    }
    if (route === '/city') {
      let position = -1;
      for (const district of ['downtown', 'midtown', 'harlem', 'megacity']) {
        const next = html.indexOf(`id="w03-${district}-title"`);
        assert.ok(next > position, `district server reading order: ${district}`);
        position = next;
      }
      for (const district of ['downtown', 'midtown', 'harlem']) assert.ok(html.includes(`id="w03-photo-${district}"`));
      assert.ok(!html.includes('id="w03-photo-megacity"'));
      assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
      // Global CSS includes the homepage selector on every route. Check element
      // classes instead; finding the selector text is not evidence it is armed.
      const classes = [...html.matchAll(/<[a-z][^>]*\bclass="([^"]*)"/g)].flatMap(([, value]) => value.split(/\s+/));
      assert.ok(!classes.includes('motion-armed'), 'City must not arm homepage CSS');
      const photoImages = [...html.matchAll(/<img\b([^>]*)>/g)].map(([, attributes]) => ({
        src: attrs(attributes, 'src'), alt: attrs(attributes, 'alt'),
      }));
      for (const id of ['downtown-one-wtc', 'midtown-chrysler-spire', 'harlem-lenox-rowhouses']) {
        const matches = photoImages.filter((image) => image.src?.includes(`${id}.`));
        assert.equal(matches.length, 1, `${id}: expected one photo image`);
        const photo = matches[0];
        assert.ok(photo.alt?.trim(), `${id}: expected descriptive alternative text`);
        assert.ok(photo.src.startsWith(`${PREFIX}/_next/static/media/${id}.`), `${id}: expected a base-prefixed local photo`);
        images.add(photo.src);
      }
    }
    report.checks.push({ name: route, status: 'PASSED' });
  } catch (error) {
    report.checks.push({ name: route, status: 'FAILED', error: String(error) });
  }
}
for (const src of images) {
  try {
    const response = await fetch(BASE + src);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type')?.startsWith('image/'), `${src}: expected an image`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${src}: empty image`);
    report.checks.push({ name: `asset:${src}`, status: 'PASSED', httpStatus: response.status });
  } catch (error) {
    report.checks.push({ name: `asset:${src}`, status: 'FAILED', error: String(error) });
  }
}
const destination = path.resolve('tooling/site-qa/out/pages-contract.json');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.checks.some((check) => check.status === 'FAILED')) process.exitCode = 1;
