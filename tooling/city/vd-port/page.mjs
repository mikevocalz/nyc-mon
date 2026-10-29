// Opens the bake page: starts serve.mjs and a headless Chromium (Playwright, from the workspace's node_modules) on
// harness.html, and waits for Valdrada's modules to load.
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/** The Valdrada tiles over the bundled tile (tooling/city/valdrada/pins.json): x 1..5, z -8..-5. */
export const TILE_KEYS = [];
for (let x = 1; x <= 5; x++) for (let z = -8; z <= -5; z++) TILE_KEYS.push(`${x}_${z}`);

const arg = (argv, name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };

export async function openBake(argv = []) {
  const valdrada = arg(argv, 'valdrada', join(homedir(), 'src/valdrada'));
  const deps = arg(argv, 'deps', process.env.VD_BAKE_DEPS);
  if (!deps) throw new Error('--deps <dir> (three 0.185.1 as three/, earcut 3 as earcut/) is required, or VD_BAKE_DEPS');
  const playwright = process.env.VD_PLAYWRIGHT ?? 'playwright';
  const { chromium } = await import(playwright);
  const { server, port } = await startServer({ valdrada, cache: join(HERE, '..', '.cache'), deps });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=8192'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  const quiet = process.env.VD_BAKE_LOG !== '1';
  page.on('console', (m) => { const t = m.text(); if (!quiet || t.startsWith('[vd-bake]') || m.type() === 'error') console.log(`  page ${m.type()}: ${t.slice(0, 300)}`); });
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  if (process.env.VD_BAKE_404 === '1') page.on('response', (r) => { if (r.status() === 404) console.log('  404', r.url()); });
  await page.goto(`http://127.0.0.1:${port}/harness.html`);
  await page.waitForFunction(() => window.__vd && (window.__vd.ready || window.__vd.error), null, { timeout: 600000 });
  const err = await page.evaluate(() => window.__vd.error);
  if (err) throw new Error(`harness: ${err}`);
  return { page, browser, close: async () => { await browser.close(); server.close(); } };
}
