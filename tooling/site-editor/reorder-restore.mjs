/** Local acceptance: reorder page sections and restore a revision through the admin UI. Disposable stack only. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
if (process.env.SITE_EDITOR_TEST_CONFIRM !== 'disposable') throw new Error('Run only against the disposable local test environment.');
const admin = 'http://localhost:3001', site = 'http://localhost:3000';
const shots = process.env.SITE_EDITOR_SHOTS ?? '/tmp/cms-evidence';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const credentials = JSON.parse(await readFile('/tmp/cms-browser-fixture.json', 'utf8'));
const page = await context.newPage();
await page.goto(admin + '/admin/login', { waitUntil: 'networkidle', timeout: 60000 });
await page.locator('input[type="text"]').fill(credentials.email);
await page.locator('input[type="password"]').fill(credentials.password);
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.waitForURL((url) => url.pathname === '/admin/collections/site-pages', { timeout: 30000 });
const api = async (method, route, data) => {
  const response = await context.request.fetch(admin + route, { method, data, headers: { Origin: admin } });
  assert.ok(response.ok(), `${method} ${route}: ${response.status()}`); return response.json();
};
const home = (await api('GET', '/payload-api/site-pages?where[route][equals]=/&draft=true&depth=0')).docs[0];
const original = structuredClone(home);
const keys = (doc) => doc.sections.map((s) => s.sectionKey);
const visitor = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const pub = await visitor.newPage();
const order = async () => { await pub.goto(site + '/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await pub.locator('h1').waitFor({ timeout: 30000 });
  return pub.evaluate(() => [...document.querySelectorAll('[data-section]')].map((el) => el.getAttribute('data-section'))); };
const results = [];
try {
  const before = keys(home);
  await page.goto(`${admin}/admin/collections/site-pages/${home.id}`, { waitUntil: 'networkidle', timeout: 60000 });
  // Move the second section above the first with the array row's own action menu.
  const row = page.locator('#sections-row-1');
  await row.scrollIntoViewIfNeeded();
  await row.getByRole('button', { name: /^More options: Section 02$/ }).click();
  await row.locator('button.array-actions__move-up').first().click();
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === `/payload-api/site-pages/${home.id}` && r.request().method() === 'PATCH' && r.ok(), { timeout: 30000 });
  await page.getByRole('button', { name: /^Publish changes/ }).click(); await saved;
  const after = keys(await api('GET', `/payload-api/site-pages/${home.id}?depth=0`));
  assert.deepEqual(after, [before[1], before[0], ...before.slice(2)]);
  const rendered = await order();
  if (rendered.length) assert.equal(rendered[0], before[1]);
  results.push('reorder: Move up in the admin swaps the first two sections and the published page follows');
  console.log('PASS ' + results.at(-1), JSON.stringify({ before: before.slice(0, 3), after: after.slice(0, 3), rendered: rendered.slice(0, 3) }));
  // Restore the revision published before the reorder.
  await page.goto(`${admin}/admin/collections/site-pages/${home.id}/versions`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: `${shots}/admin-versions-1440.png`, fullPage: false });
  const versions = await api('GET', `/payload-api/site-pages/versions?where[parent][equals]=${home.id}&sort=-updatedAt&depth=0&limit=10`);
  const target = versions.docs.find((v) => v.version._status === 'published' && keys(v.version).join() === before.join());
  assert.ok(target, 'a published revision with the original order exists');
  await page.goto(`${admin}/admin/collections/site-pages/${home.id}/versions/${target.id}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByRole('button', { name: /restore/i }).first().click();
  const restored = page.waitForResponse((r) => r.url().includes('/versions/') && r.request().method() === 'POST' && r.ok(), { timeout: 30000 });
  await page.getByRole('button', { name: /^(confirm|restore)$/i }).last().click(); await restored;
  const now = await api('GET', `/payload-api/site-pages/${home.id}?draft=true&depth=0`);
  assert.deepEqual(keys(now), before);
  results.push('restore: Restore this version in the admin brings back the original section order');
  console.log('PASS ' + results.at(-1));
} finally {
  const { title, route, seo, sections } = original;
  await api('PATCH', `/payload-api/site-pages/${home.id}`, { title, route, seo, sections, _status: 'published' }).catch((e) => console.error('Fixture restore failed', e.message));
  console.log(`REORDER/RESTORE RESULT: ${results.length} passed`);
  await browser.close();
}
