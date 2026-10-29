// The vd-port bake (lane A): runs Valdrada's own assembly for the tiles over the bundled tile (page.mjs, harness.js),
// collects every landmark, the lane's area parts and every facade-kit spec, one structure at a time (harvest.js), and
// keeps those whose box overlaps the bundled tile's playable square.
//
//   node tooling/city/vd-port/bake.mjs --measure [--near-err 0.01]   counts only, to tooling/city/vd-port/measure.json
//   node tooling/city/vd-port/bake.mjs [--near-err 0.01]              writes the structure packs (write.mjs)
//
// Needs --deps (three 0.185.1 and earcut 3) or VD_BAKE_DEPS, and Playwright (VD_PLAYWRIGHT, the module path).
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBake, TILE_KEYS } from './page.mjs';
import { toScene, EXTENT_METERS } from '../valdrada/decode.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };

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
    for (const key of TILE_KEYS) {
      const t0 = Date.now();
      const list = await page.evaluate(async ({ k, opts }) => {
        const data = await window.__vd.assemble(k);
        return window.__vdH.tileStructures(k, data.group, opts);
      }, { k: key, opts: { parts: LANE_A_PARTS, fk: true, data: !measure, nearErrM, heroErrM, heroes: HEROES } });
      let kept = 0;
      for (const s of list) {
        // a spec or landmark reached from two tiles is built once (its primary tile wins: the first seen)
        if (seen.has(s.id)) continue;
        const [ax, az] = toScene(s.box[0], s.box[2]), [bx, bz] = toScene(s.box[3], s.box[5]);
        const inside = Math.max(ax, bx) >= -EXTENT_METERS && Math.min(ax, bx) <= EXTENT_METERS && Math.max(az, bz) >= -EXTENT_METERS && Math.min(az, bz) <= EXTENT_METERS;
        if (!inside) continue;
        seen.add(s.id);
        s.tile = key;
        out.push(s);
        kept++;
      }
      console.log(`${key}: ${list.length} structures, ${kept} in bounds (${Date.now() - t0} ms)`);
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
    await writeFile(join(HERE, '..', '.cache', 'vd-port', 'structures.json'), JSON.stringify({ nearErrM, heroErrM, structures: out }));
    const { writePacks } = await import('./write.mjs');
    await writePacks(out, { nearErrM, heroErrM });
  }
}
