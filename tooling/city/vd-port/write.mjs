// Writes the vd-port block packs (lane A) from bake.mjs's structures into packages/app/features/game/world/vd-port/blocks/data/.
//
// Every number comes from Valdrada's own builders (the bake runs them); this file only moves them into the scene frame
// and packages them:
//   * x, z: Valdrada world metres to scene metres (decode.mjs's toScene, unrounded: the affine below);
//   * y: Valdrada's height datum less the structure's own pavement (assemble.js padYNear at the structure), plus the
//     curb: Valdrada stands on terrain, the bundled tile is flat (road 0, sidewalk CURB_HEIGHT 0.14);
//   * near/<cx>_<cz>.bin, one per 128 m streamer cell (cells/cell-rules.ts CELL, a triangle goes to the cell of its plan
//     centroid, as splitByCell): the near level, indexed, meshopt-coded (Valdrada's cell-package codec,
//     docs/specs/cell-package.md: lossless byte codecs, no filters) as int16x4 positions at 1/128 m about the cell centre
//     plus RGBA8 colour (sRGB albedo; alpha the emission's day share, lo / 4) plus RGBA8 emission (linear / 4 as sRGB; alpha
//     the night share, hi / 4: emission x mix(lo, hi, night), harvest.js nightMix), stride 16;
//   * shell.bin: every structure's shell in Valdrada's persistent-tier format (bake_landmarks.js pack: int16 at 1/8 m,
//     RGBA8 colour with the lit share in alpha, its FW14 uv), regrouped by the same 128 m cells, meshopt-coded: int16x4
//     position, RGBA8, int16x2 uv at 1/1024 relative to the face's first vertex's whole tile; stride 16;
//   * manifest.ts: the structures, the cells, the bundled tile's buildings each replaces, the FW14 window grid.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGIN } from '../valdrada/decode.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const OUT = join(ROOT, 'packages/app/features/game/world/vd-port/blocks/data');
const TILE = join(ROOT, 'packages/app/features/game/data/harlem-apollo.json');
const CELL = 128;
const CURB = 0.14;
const NEAR_Q = 128;

const meshoptPath = process.env.VD_MESHOPT ?? '/Users/mikevocalz/nyc-mon/node_modules/.pnpm/meshoptimizer@1.1.1/node_modules/meshoptimizer/index.js';
const sharpPath = process.env.VD_SHARP ?? '/Users/mikevocalz/nyc-mon/node_modules/.pnpm/sharp@0.35.5_@types+node@26.6.5/node_modules/sharp/dist/index.mjs';

// shared/geo.js and packages/core/world/transform.ts, as world/vd-port/transform.ts
const DEG = Math.PI / 180, R_M = 6_371_008.8, LAT0 = 40.7831, LON0 = -73.9712;
const M_LAT = 111132.0, M_LON = 111320.0 * Math.cos(LAT0 * DEG);
const kx = DEG * R_M * Math.cos(ORIGIN.latitude * DEG), kz = DEG * R_M;
export const AFFINE = { sx: kx / M_LON, ox: (LON0 - ORIGIN.longitude) * kx, sz: kz / M_LAT, oz: -(LAT0 - ORIGIN.latitude) * kz };
const toScene = (x, z) => [x * AFFINE.sx + AFFINE.ox, z * AFFINE.sz + AFFINE.oz];

const fromB64 = (s, Ctor) => { const b = Buffer.from(s, 'base64'); return new Ctor(b.buffer, b.byteOffset, b.byteLength / Ctor.BYTES_PER_ELEMENT); };
const r3 = (v) => Math.round(v * 1000) / 1000;
const inRing = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };

export async function writePacks(structures, { nearErrM, heroErrM }) {
  const { MeshoptEncoder } = await import(meshoptPath);
  await MeshoptEncoder.ready;
  const tile = JSON.parse(await readFile(TILE, 'utf8'));
  const ours = tile.buildings.map((b) => { const ring = []; for (let i = 0; i + 1 < b.p.length; i += 2) ring.push([b.p[i], b.p[i + 1]]); let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } return { id: b.id, ring, c: [cx / ring.length, cz / ring.length] }; });
  const ourAt = (x, z) => ours.find((b) => inRing(b.ring, x, z))?.id ?? null;

  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, 'near'), { recursive: true });

  const cells = new Map();   // key -> { cx, cz, pos: [], col: [], emi: [], idx: [], bounds }
  const shellCells = new Map();
  const cellOf = (key, cx, cz, map) => {
    let c = map.get(key);
    if (!c) map.set(key, (c = { cx, cz, pos: [], col: [], emi: [], nmix: [], idx: [], ranges: [], tris: 0, bounds: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], structures: new Set() }));
    return c;
  };
  const grow = (b, x, y, z) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z; if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y; if (z > b[5]) b[5] = z; };
  const out = [];
  const hide = new Set();

  for (const s of structures) {
    const dy = CURB - s.base;
    const T = (x, y, z) => { const [sx, sz] = toScene(x, z); return [sx, y + dy, sz]; };
    // ---- the near level
    const P = fromB64(s.near.pos, Float32Array), C = fromB64(s.near.col, Uint8Array), E = fromB64(s.near.emi, Uint8Array), NM = fromB64(s.near.nmix, Uint8Array), I = fromB64(s.near.idx, Uint32Array);
    const V = new Float64Array(P.length);
    for (let i = 0; i < P.length; i += 3) { const [x, y, z] = T(P[i], P[i + 1], P[i + 2]); V[i] = x; V[i + 1] = y; V[i + 2] = z; }
    const remap = new Map();   // cellKey -> Int32Array(vertex -> cell vertex)
    const sBox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      const mx = (V[a * 3] + V[b * 3] + V[c * 3]) / 3, mz = (V[a * 3 + 2] + V[b * 3 + 2] + V[c * 3 + 2]) / 3;
      const cx = Math.floor(mx / CELL), cz = Math.floor(mz / CELL), key = `${cx}_${cz}`;
      const cell = cellOf(key, cx, cz, cells);
      cell.structures.add(s.id);
      // each structure's triangles are contiguous in a cell: [id, first index, index count]
      const last = cell.ranges[cell.ranges.length - 1];
      if (last && last[0] === s.id) last[2] += 3; else cell.ranges.push([s.id, cell.idx.length, 3]);
      let rm2 = remap.get(key);
      if (!rm2) remap.set(key, (rm2 = new Int32Array(P.length / 3).fill(-1)));
      for (const v of [a, b, c]) {
        if (rm2[v] < 0) {
          rm2[v] = cell.pos.length / 3;
          cell.pos.push(V[v * 3], V[v * 3 + 1], V[v * 3 + 2]);
          cell.col.push(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]);
          cell.emi.push(E[v * 3], E[v * 3 + 1], E[v * 3 + 2]);
          cell.nmix.push(NM[v * 2], NM[v * 2 + 1]);
          grow(cell.bounds, V[v * 3], V[v * 3 + 1], V[v * 3 + 2]);
          grow(sBox, V[v * 3], V[v * 3 + 1], V[v * 3 + 2]);
        }
        cell.idx.push(rm2[v]);
      }
      cell.tris++;
    }
    // ---- the shell (pack's per-face vertices, 1/8 m about its origin, in Valdrada world)
    const SP = fromB64(s.shell.P, Int16Array), SC = fromB64(s.shell.C, Uint8Array), o = s.shell.origin;
    for (let f = 0; f < SP.length; f += 9) {
      const VW = [0, 1, 2].map((k) => [SP[f + k * 3] / 8 + o[0], SP[f + k * 3 + 1] / 8 + o[1], SP[f + k * 3 + 2] / 8 + o[2]]);
      const W = VW.map(([x, y, z]) => T(x, y, z));
      // pack()'s FW14 uv, in Valdrada's frame (its world x, z and height), face-relative so int16 keeps it
      const ux = VW[1][0] - VW[0][0], uy = VW[1][1] - VW[0][1], uz = VW[1][2] - VW[0][2], vx = VW[2][0] - VW[0][0], vy = VW[2][1] - VW[0][1], vz = VW[2][2] - VW[0][2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      const UV = VW.map(([x, y, z]) => { if (Math.abs(ny) > 0.7) return [0.06, 0.24]; const tl = Math.hypot(nx, nz) || 1, tx = -nz / tl, tz = nx / tl; return [(x * tx + z * tz) / 12, y / 15.2]; });
      const u0 = Math.floor(UV[0][0]), v0 = Math.floor(UV[0][1]);
      const cx = Math.floor((W[0][0] + W[1][0] + W[2][0]) / 3 / CELL), cz = Math.floor((W[0][2] + W[1][2] + W[2][2]) / 3 / CELL);
      const cell = cellOf(`${cx}_${cz}`, cx, cz, shellCells);
      cell.structures.add(s.id);
      for (let k = 0; k < 3; k++) {
        cell.pos.push(...W[k]);
        const ci = (f / 3 + k) * 4;
        cell.col.push(SC[ci], SC[ci + 1], SC[ci + 2], SC[ci + 3]);
        cell.emi.push(UV[k][0] - u0, UV[k][1] - v0);
        grow(cell.bounds, ...W[k]);
      }
      cell.tris++;
    }
    // ---- the bundled tile's buildings this structure replaces (the kit's rings unless it keeps the compiled massing; a
    // replace-mode landmark's footprint). Decorate landmarks add to the building and replace nothing.
    const replaced = [];
    if (s.fk && !s.fk.keepCompiled) {
      // a building of ours under one of the spec's points (Valdrada's own match: fk/facades.js apply), and every building
      // of ours whose centroid lies inside one of the kit's rings (OSM splits a lot the compile kept whole)
      for (const p of [s.fk.at, ...(s.fk.also || [])]) { if (!Array.isArray(p)) continue; const [x, z] = toScene(p[0], p[1]); const id = ourAt(x, z); if (id) replaced.push(id); }
      for (const r of s.fk.rings) {
        const ring = r.ring.map(([x, z]) => toScene(x, z));
        for (const b of ours) if (inRing(ring, b.c[0], b.c[1])) replaced.push(b.id);
      }
    }
    if (s.landmark && s.landmarkMode === 'replace') { const [x, z] = toScene(s.landmark.cx, s.landmark.cz); const id = ourAt(x, z); if (id) replaced.push(id); }
    for (const id of replaced) hide.add(id);
    // the footprints lane A draws whole (scene metres, 0.01 m): another lane's storefront inside one would be drawn twice
    const owned = s.fk && !s.fk.keepCompiled ? s.fk.rings.map((r) => r.ring.map(([x, z]) => toScene(x, z).map((v) => Math.round(v * 100) / 100))) : [];
    out.push({
      id: s.id, kind: s.kind, name: s.fk?.name ?? s.landmark?.key ?? null, addr: s.fk?.addr ?? null, tile: s.tile,
      trisExact: s.tris0, trisNear: s.near.tris, nearErrM: r3(s.near.err), trisShell: s.shell.tris, shellHow: s.shell.how,
      // Valdrada world box of the exact geometry, and the scene box of the near level (the tests compare the two)
      vbox: s.box, box: sBox.map(r3), base: r3(s.base), replaces: [...new Set(replaced)], owned,
    });
  }

  // ---- encode the cells
  const nearCells = [];
  let nearFileBytes = 0;
  for (const [key, c] of [...cells].sort()) {
    const ox = c.cx * CELL + CELL / 2, oz = c.cz * CELL + CELL / 2;
    const n = c.pos.length / 3;
    const vb = new Uint8Array(n * 16), dv = new DataView(vb.buffer);
    for (let i = 0; i < n; i++) {
      const q = [(c.pos[i * 3] - ox) * NEAR_Q, c.pos[i * 3 + 1] * NEAR_Q, (c.pos[i * 3 + 2] - oz) * NEAR_Q].map(Math.round);
      for (const v of q) if (v < -32768 || v > 32767) throw new Error(`near cell ${key}: a vertex lies ${v / NEAR_Q} m from the cell centre`);
      dv.setInt16(i * 16, q[0], true); dv.setInt16(i * 16 + 2, q[1], true); dv.setInt16(i * 16 + 4, q[2], true);
      vb[i * 16 + 8] = c.col[i * 3]; vb[i * 16 + 9] = c.col[i * 3 + 1]; vb[i * 16 + 10] = c.col[i * 3 + 2]; vb[i * 16 + 11] = c.nmix[i * 2];
      vb[i * 16 + 12] = c.emi[i * 3]; vb[i * 16 + 13] = c.emi[i * 3 + 1]; vb[i * 16 + 14] = c.emi[i * 3 + 2]; vb[i * 16 + 15] = c.nmix[i * 2 + 1];
    }
    const wide = n > 65535;
    const ib = wide ? Uint32Array.from(c.idx) : Uint16Array.from(c.idx);
    const ev = MeshoptEncoder.encodeVertexBuffer(vb, n, 16);
    const ei = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(ib.buffer), ib.length, wide ? 4 : 2);
    const head = Buffer.alloc(16);
    head.write('VDN1', 0, 'latin1'); head.writeUInt32LE(n, 4); head.writeUInt32LE(ib.length, 8); head.writeUInt32LE(ev.length + (wide ? 0x80000000 : 0), 12);
    const file = Buffer.concat([head, Buffer.from(ev), Buffer.from(ei)]);
    await writeFile(join(OUT, 'near', `${key}.bin`), file);
    nearFileBytes += file.length;
    nearCells.push({ key, cx: c.cx, cz: c.cz, vertices: n, triangles: c.tris, wide, bounds: c.bounds.map(r3),
      // GPU bytes: float32x3 position + unorm8x4 colour + unorm8x4 emissive, and the index
      bytes: n * 20 + ib.length * (wide ? 4 : 2), fileBytes: file.length, ranges: c.ranges });
  }
  // the shell: one file, its cells one after another
  const shellParts = [], shellCellsOut = [];
  let at = 0;
  for (const [key, c] of [...shellCells].sort()) {
    const ox = c.cx * CELL + CELL / 2, oz = c.cz * CELL + CELL / 2;
    const n = c.pos.length / 3;
    const vb = new Uint8Array(n * 16), dv = new DataView(vb.buffer);
    for (let i = 0; i < n; i++) {
      const q = [(c.pos[i * 3] - ox) * 8, c.pos[i * 3 + 1] * 8, (c.pos[i * 3 + 2] - oz) * 8].map(Math.round);
      dv.setInt16(i * 16, q[0], true); dv.setInt16(i * 16 + 2, q[1], true); dv.setInt16(i * 16 + 4, q[2], true);
      vb.set(c.col.slice(i * 4, i * 4 + 4), i * 16 + 8);
      const uq = [c.emi[i * 2] * 1024, c.emi[i * 2 + 1] * 1024].map(Math.round);
      for (const v of uq) if (v < -32768 || v > 32767) throw new Error(`shell cell ${key}: a face spans ${v / 1024} window-grid tiles`);
      dv.setInt16(i * 16 + 12, uq[0], true); dv.setInt16(i * 16 + 14, uq[1], true);
    }
    const ev = Buffer.from(MeshoptEncoder.encodeVertexBuffer(vb, n, 16));
    shellParts.push(ev);
    shellCellsOut.push({ key, cx: c.cx, cz: c.cz, vertices: n, triangles: c.tris, offset: at, length: ev.length, bounds: c.bounds.map(r3), structures: [...c.structures] });
    at += ev.length;
  }
  await writeFile(join(OUT, 'shell.bin'), Buffer.concat(shellParts));

  // ---- FW14 (textures/far_windows_fw14.png, Content/textures in the dataset): RGBA bytes for a DataTexture
  const sharp = (await import(sharpPath)).default;
  const fw = await sharp(join(ROOT, 'tooling/city/.cache/valdrada-textures/far_windows_fw14.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const manifest = {
    source: 'github.com/mkturkcan/valdrada @ 2724c79 (MIT); tiles: huggingface.co/datasets/mehmetkeremturkcan/valdrada v0.4.0 (ODbL 1.0)',
    nearErrM, heroErrM, cell: CELL, nearQ: NEAR_Q, curb: CURB, affine: AFFINE,
    structures: out, hide: [...hide].sort(), near: nearCells, shell: shellCellsOut,
    totals: {
      structures: out.length, trisExact: out.reduce((a, s) => a + s.trisExact, 0), trisNear: nearCells.reduce((a, c) => a + c.triangles, 0),
      trisShell: shellCellsOut.reduce((a, c) => a + c.triangles, 0), nearFileBytes, shellFileBytes: at,
    },
  };
  const ts = [
    '// Generated by tooling/city/vd-port/bake.mjs (write.mjs). Do not edit.',
    `// Valdrada's 125th Street blocks and landmarks in bounds: ${manifest.source}.`,
    `export const VD_BLOCKS = ${JSON.stringify(manifest)} as const;`,
    `export const VD_FW14 = { width: ${fw.info.width}, height: ${fw.info.height}, rgba: '${fw.data.toString('base64')}' } as const;`,
    '',
  ].join('\n');
  await writeFile(join(OUT, 'manifest.ts'), ts);
  const keys = nearCells.map((c) => c.key);
  await writeFile(join(OUT, 'assets.ts'), [
    '// Generated by tooling/city/vd-port/write.mjs. Metro registers .bin as an asset (apps/mobile/metro.config.js), so',
    '// require() gives an asset id that @acme/ui/three/asset-bytes resolves and reads (vd-port/blocks/load.ts).',
    '/* eslint-disable @typescript-eslint/no-require-imports */',
    'export const VD_SHELL_ASSET: number = require(\'./shell.bin\');',
    'export const VD_NEAR_ASSETS: Readonly<Record<string, number>> = {',
    ...keys.map((k) => `  '${k}': require('./near/${k}.bin'),`),
    '};',
    '',
  ].join('\n'));
  console.log(`wrote ${out.length} structures, ${nearCells.length} near cells (${(nearFileBytes / 1e6).toFixed(1)} MB, ${manifest.totals.trisNear} triangles), ${shellCellsOut.length} shell cells (${(at / 1e6).toFixed(1)} MB, ${manifest.totals.trisShell} triangles), ${hide.size} buildings replaced`);
}

// `node write.mjs` re-writes the packs from the bake's cache (tooling/city/.cache/vd-port/structures.json) without
// re-running the page
if (import.meta.url === `file://${process.argv[1]}`) {
  const cache = JSON.parse(await readFile(join(ROOT, 'tooling/city/.cache/vd-port/structures.json'), 'utf8'));
  await writePacks(cache.structures, { nearErrM: cache.nearErrM, heroErrM: cache.heroErrM });
}
