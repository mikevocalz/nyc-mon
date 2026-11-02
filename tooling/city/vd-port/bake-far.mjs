// The far tier's landmark silhouettes (lod16/landmarks_l6.bin + landmarks.json) baked by Valdrada's own
// tools/lod/bake_landmarks.mjs page (client/src/lod/bake_landmarks.js __BAKE) in headless Chromium over serve.mjs,
// against the pinned tiles in tooling/city/.cache/valdrada (fetch.mjs --far).
//
//   node tooling/city/vd-port/bake-far.mjs --deps tooling/city/.cache/vd-tools [--out tooling/city/.cache/vd-lod16]
//
// Needs --deps (three 0.185.1 as three/, earcut 3 as earcut/) or VD_BAKE_DEPS, and Playwright (VD_PLAYWRIGHT).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };

const valdrada = arg('valdrada', join(homedir(), 'src/valdrada'));
const deps = arg('deps', process.env.VD_BAKE_DEPS);
if (!deps) throw new Error('--deps <dir> (three 0.185.1 as three/, earcut 3 as earcut/) is required, or VD_BAKE_DEPS');
const outDir = arg('out', join(HERE, '..', '.cache', 'vd-lod16'));
const playwright = process.env.VD_PLAYWRIGHT ?? 'playwright';
const { chromium } = await import(playwright);
const { writeTile } = await import(pathToFileURL(join(valdrada, 'client/tools/pipeline/binio.mjs')).href);

const { server, port } = await startServer({ valdrada, cache: join(HERE, '..', '.cache'), deps, overlay: join(HERE, '..', '.cache', 'valdrada-public') });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=8192'] });
let code = 0;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || t.startsWith('[vd-bake]')) console.log(`  page ${m.type()}: ${t.slice(0, 300)}`); });
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  await page.goto(`http://127.0.0.1:${port}/far-bake.html`);
  await page.waitForFunction(() => window.__vd && (window.__vd.ready || window.__vd.error), null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__vd.error);
  if (err) throw new Error(`page: ${err}`);
  await page.waitForFunction('window.__BAKE_READY === true', undefined, { timeout: 300000 });
  const { out, log } = await page.evaluate(() => window.__BAKE());
  for (const l of log) console.log(' ', l);

  const P = [], C = [], U = [], I = [], reg = [];
  for (const L of out) {
    const v0 = P.length / 3, i0 = I.length;
    P.push(...L.P); C.push(...L.C); U.push(...L.U);
    for (let k = 0; k < L.nv; k++) I.push(k);
    const [x0, y0, z0, x1, y1, z1] = L.bbox;
    reg.push({
      key: L.key, name: L.name, kind: L.kind, ...(L.lmId ? { lmId: L.lmId, mode: L.mode, tile: L.tile } : {}), ...(L.feature ? { feature: L.feature } : {}), ...(L.excludeR ? { excludeR: L.excludeR } : {}),
      bin: null, priority: L.priority, ...(L.drawnBy ? { drawnBy: L.drawnBy } : {}), night: L.night,
      center: [+((x0 + x1) / 2).toFixed(1), +((y0 + y1) / 2).toFixed(1), +((z0 + z1) / 2).toFixed(1)],
      radius: +(Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2).toFixed(1), top: +y1.toFixed(1),
      l6: { origin: L.origin.map((v) => +v.toFixed(2)), v0, nv: L.nv, i0, ni: L.nv, tris: L.tris, from: L.tris0, how: L.how, err: +L.err.toFixed(5) },
    });
  }
  await mkdir(outDir, { recursive: true });
  const binRel = 'landmarks_l6.bin';
  writeTile(join(outDir, binRel), { v: 1, scale: 1 / 8, count: reg.length }, [
    { name: 'pos', array: Int16Array.from(P) }, { name: 'col', array: Uint8Array.from(C) },
    { name: 'uv', array: Float32Array.from(U) }, { name: 'idx', array: Uint32Array.from(I) },
  ]);
  const doc = {
    v: 1, built: new Date().toISOString(), file: binRel, levels: ['L6'], limitTris: 2000,
    note: 'Landmark registry, first list. L6 silhouettes from our own builders (city/landmarks.js, city/bridgeKit.js), simplified with meshoptimizer; keyed by landmark id (shared/landmarkSpec.js) or feature. bin: the footprint BIN, to be filled from the records module.',
    landmarks: reg,
  };
  await writeFile(join(outDir, 'landmarks.json'), JSON.stringify(doc, null, 1));
  const { statSync } = await import('node:fs');
  console.log(`landmarks: ${reg.length}, ${I.length / 3} triangles, bin ${(statSync(join(outDir, binRel)).size / 1024).toFixed(0)} KB at ${outDir}`);
} catch (e) {
  console.error(e);
  code = 1;
}
await browser.close();
server.close();
process.exit(code);
