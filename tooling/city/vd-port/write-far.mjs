// Packs Valdrada's persistent-tier bake (tools/lod/build_persistent.mjs, the L6 and L4 CTL1 chunks) and the landmark
// silhouettes (bake-far.mjs) into packages/app/features/game/world/vd-port/far-tier/data/, with the manifest the
// runtime part (far-tier/index.ts) streams and the Metro asset registrations (assets.ts) for the bundled home subset.
//
// The chunks stream through the cell source (world/cell-source): only the home subset — chunks whose bounds meet the
// bundled tile's square (EXTENT_METERS about the tile origin, mirroring how the lane-A home cells are bundled) — is
// copied into data/chunks and registered as Metro assets; every other chunk stays in tooling/city/.cache/vd-lod16 and
// is hash-pinned in the cell manifest (write-cells-manifest.mjs) for the host to serve. landmarks_l6.bin is a single
// pinned fetch, never bundled.
//
//   node tooling/city/vd-port/write-far.mjs [--in tooling/city/.cache/vd-lod16]
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTENT_METERS, ORIGIN } from '../valdrada/decode.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const IN = arg('in', join(HERE, '..', '.cache', 'vd-lod16'));
const OUT = join(ROOT, 'packages/app/features/game/world/vd-port/far-tier/data');

const DEG = Math.PI / 180, R_M = 6_371_008.8, LAT0 = 40.7831, LON0 = -73.9712;
const M_LAT = 111132.0, M_LON = 111320.0 * Math.cos(LAT0 * DEG);
const kx = DEG * R_M * Math.cos(ORIGIN.latitude * DEG), kz = DEG * R_M;
const AFFINE = { sx: kx / M_LON, ox: (LON0 - ORIGIN.longitude) * kx, sz: kz / M_LAT, oz: -(LAT0 - ORIGIN.latitude) * kz };

const index = JSON.parse(await readFile(join(IN, 'index.json'), 'utf8'));
let lmReg = null;
try {
  const doc = JSON.parse(await readFile(join(IN, 'landmarks.json'), 'utf8'));
  lmReg = doc.landmarks?.length ? { file: doc.file, entries: doc.landmarks } : null;
} catch { /* no landmark bake yet */ }

await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'chunks'), { recursive: true });

// The bundled home subset: chunks whose bounds (Valdrada metres, [x0, z0, x1, z1, y0, y1]) meet the bundled tile's
// square about the scene origin, mapped back through the same affine toScene applies.
const HOME = {
  x0: (-EXTENT_METERS - AFFINE.ox) / AFFINE.sx, x1: (EXTENT_METERS - AFFINE.ox) / AFFINE.sx,
  z0: (-EXTENT_METERS - AFFINE.oz) / AFFINE.sz, z1: (EXTENT_METERS - AFFINE.oz) / AFFINE.sz,
};
const isHome = (b) => b[2] >= HOME.x0 && b[0] <= HOME.x1 && b[3] >= HOME.z0 && b[1] <= HOME.z1;

const chunks = [];
let maxVertices = 3;
for (const lv of Object.keys(index.chunks).sort()) {
  for (const [ck, e] of Object.entries(index.chunks[lv]).sort()) {
    if (!e.f) continue;
    const fbuf = await readFile(join(IN, e.f));
    const hdr = JSON.parse(fbuf.subarray(8, 8 + fbuf.readUInt32LE(4)).toString('utf8'));
    const sec = Object.fromEntries(hdr.sections.map((s) => [s.name, s]));
    const nv = sec.pos ? sec.pos.length / 3 : 0, gnv = sec.gpos ? sec.gpos.length / 3 : 0;
    if (nv > maxVertices) maxVertices = nv;
    if (gnv > maxVertices) maxVertices = gnv;
    const home = isHome(e.b);
    chunks.push({
      f: e.f, lv: +lv, ci: hdr.ci, cj: hdr.cj, origin: hdr.origin, scale: hdr.scale,
      tris: e.t | 0, gtris: e.g | 0, towers: e.tw | 0, bytes: e.bytes, bounds: e.b,
      nv, gnv, ...(home ? { home: true } : {}),
    });
    if (home) await copyFile(join(IN, e.f), join(OUT, 'chunks', e.f));
  }
}

let landmarks = null;
if (lmReg) {
  const lmBuf = await readFile(join(IN, lmReg.file));
  const hdr = JSON.parse(lmBuf.subarray(8, 8 + lmBuf.readUInt32LE(4)).toString('utf8'));
  const entries = [];
  for (const L of lmReg.entries) {
    if (!L.l6) continue;
    if (L.l6.nv > maxVertices) maxVertices = L.l6.nv;
    entries.push({ key: L.key, name: L.name, kind: L.kind, lmId: L.lmId, feature: L.feature, drawnBy: L.drawnBy ?? null, center: L.center, radius: L.radius, l6: L.l6 });
  }
  landmarks = { f: 'landmarks_l6.bin', scale: hdr.scale, count: hdr.count, entries };
  // landmarks_l6.bin is not copied into the app: it is one pinned fetch through the cell source.
}

const manifest = {
  source: 'github.com/mkturkcan/valdrada @ 2724c79 (MIT); tiles+data: huggingface.co/datasets/mehmetkeremturkcan/valdrada rev 09b5836 (ODbL 1.0)',
  built: index.built, curb: 0.14, padY: 3.52, affine: AFFINE, maxVertices,
  groundColor: [88, 87, 85, 0],
  chunks, landmarks,
  totals: {
    chunks: chunks.length, l4: chunks.filter((c) => c.lv === 4).length, l6: chunks.filter((c) => c.lv === 6).length,
    tris: chunks.reduce((a, c) => a + c.tris, 0), gtris: chunks.reduce((a, c) => a + c.gtris, 0),
    fileBytes: chunks.reduce((a, c) => a + c.bytes, 0),
    landmarks: landmarks ? landmarks.entries.length : 0,
    landmarkTris: landmarks ? landmarks.entries.reduce((a, l) => a + (l.l6.tris | 0), 0) : 0,
  },
};

const ts = [
  '// Generated by tooling/city/vd-port/write-far.mjs. Do not edit.',
  `// Valdrada's persistent far tier (L4/L6 chunks + landmark silhouettes): ${manifest.source}.`,
  `export const VD_FAR = ${JSON.stringify(manifest)} as const;`,
  '',
].join('\n');
await writeFile(join(OUT, 'manifest.ts'), ts);

const bundled = chunks.filter((c) => c.home);
await writeFile(join(OUT, 'assets.ts'), [
  '// Generated by tooling/city/vd-port/write-far.mjs. Metro registers .bin as an asset (apps/mobile/metro.config.js), so',
  '// require() gives an asset id that @acme/ui/three/asset-bytes resolves and reads (vd-port/far-tier/load.ts). Only the',
  '// home subset (manifest `home`) is bundled; the rest stream through the cell source on demand.',
  '/* eslint-disable @typescript-eslint/no-require-imports */',
  'export const VD_FAR_ASSETS: Readonly<Record<string, number>> = {',
  ...bundled.map((c) => `  '${c.f}': require('./chunks/${c.f}'),`),
  '};',
  '',
].join('\n'));

console.log(`wrote ${manifest.totals.chunks} chunks (L4 ${manifest.totals.l4}, L6 ${manifest.totals.l6}), ${manifest.totals.tris} + ${manifest.totals.gtris} ground triangles, ${(manifest.totals.fileBytes / 1e6).toFixed(1)} MB, ${manifest.totals.landmarks} landmarks (${manifest.totals.landmarkTris} triangles); bundled home ${bundled.length} (${(bundled.reduce((a, c) => a + c.bytes, 0) / 1e6).toFixed(1)} MB) to ${OUT}`);
