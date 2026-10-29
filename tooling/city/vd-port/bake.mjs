// The vd-port bake (lane A): runs Valdrada's own assembly for the tiles over the bundled tile (page.mjs, harness.js),
// collects every landmark, the lane's area parts and every facade-kit spec, one structure at a time (harvest.js), and
// keeps those whose box overlaps the bundled tile's playable square.
//
//   node tooling/city/vd-port/bake.mjs --measure [--near-err 0.01]   counts only, to tooling/city/vd-port/measure.json
//   node tooling/city/vd-port/bake.mjs [--near-err 0.01]              writes the structure packs (write.mjs)
//   node tooling/city/vd-port/bake.mjs --ring ring1                   the ring's tiles and bounds (ring1.mjs): packs to
//                                                                   blocks/data-ring1/, structures already in
//                                                                   VD_BLOCKS skipped
//   node tooling/city/vd-port/bake.mjs --ring ring2                   ring 2 (ring2.mjs): packs to blocks/data-ring2/,
//                                                                   structures already in VD_BLOCKS or
//                                                                   VD_BLOCKS_RING1 skipped
//   node tooling/city/vd-port/bake.mjs --ring ring4                   ring 4 (ring4.mjs): packs to blocks/data-ring4/,
//                                                                   structures already in VD_BLOCKS or
//                                                                   VD_BLOCKS_RING1..3 skipped
//   node tooling/city/vd-port/bake.mjs --ring ring5                   ring 5 (ring5.mjs): packs to blocks/data-ring5/,
//                                                                   structures already in VD_BLOCKS or
//                                                                   VD_BLOCKS_RING1..4 skipped
//   node tooling/city/vd-port/bake.mjs --ring ring6                   ring 6 (ring6.mjs): packs to blocks/data-ring6/,
//                                                                   structures already in VD_BLOCKS or
//                                                                   VD_BLOCKS_RING1..5 skipped
//   node tooling/city/vd-port/bake.mjs --ring ring7                   ring 7 (ring7.mjs): packs to blocks/data-ring7/,
//                                                                   structures already in VD_BLOCKS or
//                                                                   VD_BLOCKS_RING1..6 skipped; the district yields
//                                                                   no landmark/fk/part structure, so the pack is
//                                                                   the ring's bridges (ring7.mjs RING7_BRIDGES,
//                                                                   harvest.js bridgeStructures)
//
// Needs --deps (three 0.185.1 and earcut 3) or VD_BAKE_DEPS, and Playwright (VD_PLAYWRIGHT, the module path).
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBake, TILE_KEYS } from './page.mjs';
import { toScene, EXTENT_METERS } from '../valdrada/decode.mjs';
import { RING1_TILES, inRing1Vd, bakedBlockIds } from './ring1.mjs';
import { RING2_TILES, inRing2Vd, bakedRing2Ids } from './ring2.mjs';
import { RING3_TILES, inRing3Vd, bakedRing3Ids } from './ring3.mjs';
import { RING4_TILES, inRing4Vd, bakedRing4Ids } from './ring4.mjs';
import { RING5_TILES, inRing5Vd, bakedRing5Ids } from './ring5.mjs';
import { RING6_TILES, inRing6Vd, bakedRing6Ids } from './ring6.mjs';
import { RING7_TILES, RING7_BRIDGES, inRing7Vd, bakedRing7Ids } from './ring7.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };

/** The --ring argument: 'ring1' .. 'ring6' (the ring module's tile list, region and dedupe), or none for the square. */
const RING = val('ring', null);
if (RING && RING !== 'ring1' && RING !== 'ring2' && RING !== 'ring3' && RING !== 'ring4' && RING !== 'ring5' && RING !== 'ring6' && RING !== 'ring7') throw new Error(`unknown --ring ${RING}`);
const TILE_LIST = RING === 'ring1' ? RING1_TILES : RING === 'ring2' ? RING2_TILES : RING === 'ring3' ? RING3_TILES : RING === 'ring4' ? RING4_TILES : RING === 'ring5' ? RING5_TILES : RING === 'ring6' ? RING6_TILES : RING === 'ring7' ? RING7_TILES : TILE_KEYS;
const SKIP = RING === 'ring1' ? bakedBlockIds() : RING === 'ring2' ? bakedRing2Ids() : RING === 'ring3' ? bakedRing3Ids() : RING === 'ring4' ? bakedRing4Ids() : RING === 'ring5' ? bakedRing5Ids() : RING === 'ring6' ? bakedRing6Ids() : RING === 'ring7' ? bakedRing7Ids() : new Set();
/** A structure's Valdrada world box inside the bake's region (the bundled square for the home bake, the ring's two
 * rects for a ring; s.box is Valdrada world metres, so the home test transforms first). */
const inRegion = (s) => {
  if (RING === 'ring1') return inRing1Vd(s.box);
  if (RING === 'ring2') return inRing2Vd(s.box);
  if (RING === 'ring3') return inRing3Vd(s.box);
  if (RING === 'ring4') return inRing4Vd(s.box);
  if (RING === 'ring5') return inRing5Vd(s.box);
  if (RING === 'ring6') return inRing6Vd(s.box);
  if (RING === 'ring7') return inRing7Vd(s.box);
  const [ax, az] = toScene(s.box[0], s.box[2]), [bx, bz] = toScene(s.box[3], s.box[5]);
  return Math.max(ax, bx) >= -EXTENT_METERS && Math.min(ax, bx) <= EXTENT_METERS && Math.max(az, bz) >= -EXTENT_METERS && Math.min(az, bz) <= EXTENT_METERS;
};

/** The area parts lane A ports (city/areas.js names). w125c builds nothing while the facade kit owns the Apollo. */
export const LANE_A_PARTS = ['w125c', 'w125cb', 'w125w', 'w125e'];
export { HEROES } from './heroes.mjs';
import { HEROES } from './heroes.mjs';

export async function bakeStructures({ measure, nearErrM, heroErrM }) {
  const { page, close } = await openBake(argv);
  const seen = new Set();
  const out = [];
  try {
    await page.addScriptTag({ type: 'module', content: "import * as H from '/harvest.js'; window.__vdH = H;" });
    await page.waitForFunction(() => !!window.__vdH);
    for (const key of TILE_LIST) {
      const t0 = Date.now();
      const list = await page.evaluate(async ({ k, opts }) => {
        const data = await window.__vd.assemble(k);
        return window.__vdH.tileStructures(k, data.group, opts);
      }, { k: key, opts: { parts: LANE_A_PARTS, fk: true, data: !measure, nearErrM, heroErrM, heroes: HEROES } });
      let kept = 0;
      for (const s of list) {
        // a spec or landmark reached from two tiles is built once (its primary tile wins: the first seen)
        if (seen.has(s.id)) continue;
        if (SKIP.has(s.id)) { seen.add(s.id); continue; }   // lane A baked it already (the home pack owns it)
        if (!inRegion(s)) continue;
        seen.add(s.id);
        s.tile = key;
        out.push(s);
        kept++;
      }
      console.log(`${key}: ${list.length} structures, ${kept} in bounds (${Date.now() - t0} ms)`);
    }
    // Ring 7: Valdrada builds its bridges at boot (main.js buildBridges over tiles/bridges.json), never inside a
    // tile, so no tile's harvest reaches them; the ring's own call bakes them here, once each.
    if (RING === 'ring7' && RING7_BRIDGES.length) {
      const list = await page.evaluate(async ({ keys, opts }) => window.__vdH.bridgeStructures(keys, opts), { keys: RING7_BRIDGES, opts: { parts: LANE_A_PARTS, fk: true, data: !measure, nearErrM, heroErrM, heroes: HEROES } });
      let kept = 0;
      for (const s of list) {
        if (seen.has(s.id)) continue;
        if (SKIP.has(s.id)) { seen.add(s.id); continue; }
        if (!inRegion(s)) continue;
        seen.add(s.id);
        out.push(s);
        kept++;
      }
      console.log(`bridges: ${list.length} built, ${kept} in bounds`);
    }
  } finally {
    await close();
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const measure = flag('measure');
  const nearErrM = +val('near-err', '0.02');
  const heroErrM = +val('hero-err', '0.005');
  const out = await bakeStructures({ measure, nearErrM, heroErrM });
  const sum = (f) => out.reduce((a, s) => a + f(s), 0);
  console.log(`in bounds: ${out.length} structures; triangles exact ${sum((s) => s.tris0)}, near (${nearErrM} m) ${sum((s) => s.near.tris)}, shell ${sum((s) => s.shell.tris)}`);
  for (const kind of [...new Set(out.map((s) => s.kind))]) {
    const k = out.filter((s) => s.kind === kind);
    console.log(`  ${kind}: ${k.length}; exact ${k.reduce((a, s) => a + s.tris0, 0)}, near ${k.reduce((a, s) => a + s.near.tris, 0)}, shell ${k.reduce((a, s) => a + s.shell.tris, 0)}`);
  }
  if (measure) await writeFile(join(HERE, `measure-${nearErrM}.json`), JSON.stringify(out.map(({ near, shell, ...r }) => ({ ...r, near: { ...near, P: undefined, C: undefined }, shell: { ...shell, P: undefined, C: undefined } }))));
  else {
    const { mkdir: mk } = await import('node:fs/promises');
    await mk(join(HERE, '..', '.cache', 'vd-port'), { recursive: true });
    const cacheName = RING ? `structures-${RING}.json` : 'structures.json';
    await writeFile(join(HERE, '..', '.cache', 'vd-port', cacheName), JSON.stringify({ nearErrM, heroErrM, ring: RING, structures: out }));
    const { writePacks } = await import('./write.mjs');
    const writer = RING === 'ring1' ? (await import('./write-ring1.mjs')).writeRing1Packs
      : RING === 'ring2' ? (await import('./write-ring2.mjs')).writeRing2Packs
      : RING === 'ring3' ? (await import('./write-ring3.mjs')).writeRing3Packs
      : RING === 'ring4' ? (await import('./write-ring4.mjs')).writeRing4Packs
      : RING === 'ring5' ? (await import('./write-ring5.mjs')).writeRing5Packs
      : RING === 'ring6' ? (await import('./write-ring6.mjs')).writeRing6Packs
      : RING === 'ring7' ? (await import('./write-ring7.mjs')).writeRing7Packs : null;
    if (writer) await writer(out, { nearErrM, heroErrM });
    else await writePacks(out, { nearErrM, heroErrM });
  }
}
