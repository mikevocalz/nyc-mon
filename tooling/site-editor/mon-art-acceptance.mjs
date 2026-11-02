/**
 * Mon still art, end to end, against the disposable local stack only: a content
 * editor uploads and approves the stills for #020 Signal Egg and #021 Fye Dot on
 * the console's Models page, and the public site shows them on its next request,
 * with no rebuild. Requires the guarded fixture (seed-browser-fixture.mjs), the
 * admin on :3001 with tooling/site-editor/mock-bunny.mjs preloaded, and the built
 * site on :3000 with PAYLOAD_SITE_API_URL pointing at the admin.
 *
 *   MON_ART_SIGNAL=/path/signal-egg.png MON_ART_FYE=/path/fye-dot.png node tooling/site-editor/mon-art-acceptance.mjs
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

if (process.env.SITE_EDITOR_TEST_CONFIRM !== 'disposable') throw new Error('Run only against the disposable local test environment.');
const admin = 'http://localhost:3001', site = 'http://localhost:3000';
const objects = process.env.SITE_EDITOR_TEST_OBJECT_DIR ?? '/tmp/nycmon-cms-test-objects';
const shots = process.env.MON_ART_SHOTS ?? '/tmp/mon-art-shots';
await mkdir(shots, { recursive: true });
const uploads = [
  { speciesId: 'dex-020', file: process.env.MON_ART_SIGNAL, alt: 'The Signal Egg, a cream speckled egg covered in black dots and a few red-ringed dots, on a sunlit brownstone sidewalk.' },
  { speciesId: 'dex-021', file: process.env.MON_ART_FYE, alt: 'Fye Dot, a glossy black hopper Mon with white polka dots and black-and-white striped antennae, crouched on a sunny brownstone stoop.' },
];
for (const u of uploads) assert.ok(u.file, `set the picture path for ${u.speciesId}`);

const browser = await chromium.launch({ headless: true });
const serveCdn = (ctx) => ctx.route('https://cdn.example.test/**', async (route) => {
  const name = path.basename(new URL(route.request().url()).pathname);
  try {
    await route.fulfill({ status: 200, body: await readFile(path.join(objects, name)), contentType: name.endsWith('.png') ? 'image/png' : name.endsWith('.jpg') ? 'image/jpeg' : 'image/webp' });
  } catch {
    await route.fulfill({ status: 404, body: '' });
  }
});
const pass = (name) => console.log('PASS ' + name);

const editor = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await serveCdn(editor);
const credentials = JSON.parse(await readFile('/tmp/cms-browser-fixture.json', 'utf8'));
const page = await editor.newPage();
await page.goto(admin + '/admin/login', { waitUntil: 'networkidle', timeout: 120000 });
await page.locator('input[type="text"]').fill(credentials.email);
await page.locator('input[type="password"]').fill(credentials.password);
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.waitForURL((url) => url.pathname.startsWith('/admin') && url.pathname !== '/admin/login', { timeout: 60000 });
pass('content editor signs in');

const stillUrls = async () => {
  const response = await fetch(`${admin}/payload-api/mon-art?where[status][equals]=approved&depth=0&limit=200`);
  return Object.fromEntries((await response.json()).docs.map((doc) => [doc.speciesId, doc.url]));
};
const siteImages = async (ctx, route) => {
  const p = await ctx.newPage();
  await p.goto(site + route, { waitUntil: 'networkidle', timeout: 120000 });
  const srcs = await p.evaluate(() => [...document.images].map((img) => img.currentSrc || img.src));
  await p.close();
  return srcs;
};

const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await serveCdn(visitor);
const before = await siteImages(visitor, '/mons/lanternfye');
assert.ok(!before.some((src) => src.includes('cdn.example.test')), 'no console still before the upload');
assert.ok(before.some((src) => src.includes('fye-dot')) && before.some((src) => src.includes('signal-egg')), 'bundled stills before the upload');
pass('before: /mons/lanternfye shows the bundled Signal Egg and Fye Dot stills');

for (const u of uploads) {
  await page.goto(`${admin}/admin/models/${u.speciesId}`, { waitUntil: 'networkidle', timeout: 120000 });
  const panel = page.getByTestId('still-art');
  await panel.waitFor({ timeout: 60000 });
  await panel.locator('input[type="file"]').setInputFiles(u.file);
  await panel.getByText(/Not saved yet/).waitFor({ timeout: 30000 });
  // Saving without alt text is refused in the browser.
  await panel.getByRole('button', { name: 'Save still', exact: true }).click();
  await panel.getByRole('alert').filter({ hasText: 'Describe the picture' }).waitFor({ timeout: 10000 });
  await panel.getByLabel('Alt text').fill(u.alt);
  await panel.getByRole('button', { name: 'Save still', exact: true }).click();
  await panel.getByRole('button', { name: 'Approve for the site and apps', exact: true }).waitFor({ timeout: 60000 });
  await page.screenshot({ path: path.join(shots, `console-${u.speciesId}-in-review.png`), fullPage: true });
  await panel.getByRole('button', { name: 'Approve for the site and apps', exact: true }).click();
  await panel.getByText('Approved. The site and apps show this still.').waitFor({ timeout: 60000 });
  await page.screenshot({ path: path.join(shots, `console-${u.speciesId}-approved.png`), fullPage: true });
  pass(`${u.speciesId}: uploaded, described and approved on the Models page`);
}

const approved = await stillUrls();
for (const u of uploads) assert.match(approved[u.speciesId] ?? '', /^https:\/\/cdn\.example\.test\/mon-art\//, `${u.speciesId} approved with a CDN URL`);
pass('the public REST API lists both approved stills');

const started = Date.now();
let after = [];
for (let attempt = 0; attempt < 20; attempt += 1) {
  after = await siteImages(visitor, '/mons/lanternfye');
  if (uploads.every((u) => after.includes(approved[u.speciesId]))) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
for (const u of uploads) assert.ok(after.includes(approved[u.speciesId]), `${u.speciesId} console still on the page`);
pass(`after: /mons/lanternfye shows both console stills ${Math.round((Date.now() - started) / 1000)} s after approval, no rebuild`);

for (const width of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
  await serveCdn(ctx);
  for (const route of ['/', '/mons', '/mons/lanternfye', '/how-it-works', '/get']) {
    const p = await ctx.newPage();
    await p.goto(site + route, { waitUntil: 'networkidle', timeout: 120000 });
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(600);
    const srcs = await p.evaluate(() => [...document.images].map((img) => ({ src: img.currentSrc || img.src, ok: img.complete && img.naturalWidth > 0 })));
    const cdn = srcs.filter((img) => img.src.includes('cdn.example.test'));
    assert.ok(cdn.every((img) => img.ok), `${route} @${width}: every console still decoded`);
    console.log(`  ${route} @${width}: ${cdn.length} console still(s)`);
    await p.screenshot({ path: path.join(shots, `site-${width}-${route === '/' ? 'home' : route.slice(1).replace(/\//g, '_')}.jpg`), type: 'jpeg', quality: 60, fullPage: true });
    await p.close();
  }
  await ctx.close();
}
pass('screenshots at 390 and 1440');

// Unapprove one: the site falls back to the bundled still.
await page.goto(`${admin}/admin/models/dex-021`, { waitUntil: 'networkidle', timeout: 120000 });
await page.getByTestId('still-art').getByRole('button', { name: 'Move back to review', exact: true }).click();
await page.getByTestId('still-art').getByText(/^In review\. /).waitFor({ timeout: 60000 });
let back = [];
for (let attempt = 0; attempt < 20; attempt += 1) {
  back = await siteImages(visitor, '/mons/lanternfye');
  if (!back.includes(approved['dex-021'])) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.ok(!back.includes(approved['dex-021']) && back.some((src) => src.includes('fye-dot')), 'unapproved: bundled Fye Dot again');
pass('moving Fye Dot back to review restores the bundled still on the site');

// Leave Fye Dot approved for the screenshots record.
await page.goto(`${admin}/admin/models/dex-021`, { waitUntil: 'networkidle', timeout: 120000 });
await page.getByTestId('still-art').getByRole('button', { name: 'Approve for the site and apps', exact: true }).click();
await page.getByTestId('still-art').getByText('Approved. The site and apps show this still.').waitFor({ timeout: 60000 });
await browser.close();
console.log('mon-art acceptance: all checks passed');
