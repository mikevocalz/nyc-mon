// Assembles every Valdrada tile that covers the bundled square with Valdrada's own world/assemble.js assembleTile, the
// way the browser does on a default load (main.js: one Instancer for the city, tiles assembled into it, area parts
// building into each tile's group), and returns what the vd-port bakes read:
//
//   instancer   Valdrada's live Instancer (city/instancer.js): every pool's slots hold the exact claim, i.e. the matrix
//               (position, yaw, scale incl. the U10 street variance) and the instance colour (U10 tint / caller colour)
//   roofOf      slot -> the buildRoof env that claimed it (roof plant only), for the roof-contact datum
//   groups      the tile groups, every child tagged with the client/src file that added it (valdrada-runtime.mjs)
//   geos        furnitureKit.buildFurnitureGeos() as the Instancer built its pools from (one call, shared)
//
// Tiles are assembled in tileIdsForSquare() order. Pool caps are ceilings Valdrada raises past any one city's count
// (instancer.js CAPS); the bake asserts none was hit, so the order cannot change a claim.
import { registerHooks } from 'node:module';
import { THREE, vd, tileBytes } from './valdrada-runtime.mjs';
import { tileIdsForSquare } from '../valdrada/decode.mjs';

// buildRoof's env is the only place the roof contact datum (env.roofY) and the deck's building (env.h) are known; the
// claim lambda assemble.js passes it drops both. A load hook wraps the export so claims made inside it can be traced to
// their env. Source otherwise untouched.
registerHooks({
  load(url, ctx, next) {
    const r = next(url, ctx);
    if (!url.endsWith('/client/src/city/roofEngine.js')) return r;
    const src = String(r.source).replace('export function buildRoof(env) {',
      'export function buildRoof(env) { globalThis.__vdRoofEnv = env; try { return buildRoof__vd(env); } finally { globalThis.__vdRoofEnv = null; } }\nfunction buildRoof__vd(env) {');
    return { ...r, source: src, shortCircuit: true };
  },
});

export async function assembleCity(log = () => {}) {
  const { assembleTile } = await vd('world/assemble.js');
  const { Instancer } = await vd('city/instancer.js');
  const scene = new THREE.Scene();
  const instancer = new Instancer(scene);
  const roofOf = new Map(); // `${pool}:${slot}` -> { roofY, h, ring }
  const claim = instancer.claim.bind(instancer);
  const recOf = new WeakMap();   // one record per buildRoof env (per building deck)
  instancer.claim = (...a) => {
    const slot = claim(...a);
    const env = globalThis.__vdRoofEnv;
    if (slot >= 0 && env) {
      let rec = recOf.get(env);
      if (!rec) recOf.set(env, (rec = { roofY: env.roofY, h: env.h, ring: env.ring }));
      roofOf.set(`${a[0]}:${slot}`, rec);
    }
    return slot;
  };
  const mat = new THREE.MeshStandardMaterial();
  const ctx = { scene, instancer, signalReg: [], landmarks: null, facadeMat: mat, groundMat: mat, makeFacadeMat: () => mat };
  const groups = [];
  for (const id of tileIdsForSquare()) {
    const t0 = Date.now();
    const res = await assembleTile(id.replace(/^t_/, ''), tileBytes(id), ctx);
    groups.push({ id, group: res.group });
    log(`${id} ${Date.now() - t0} ms`);
  }
  for (const p of instancer.pools.values()) {
    if (p.top >= p.cap) throw new Error(`pool ${p.name} hit its cap ${p.cap}: claims past it were dropped`);
  }
  return { scene, instancer, roofOf, groups, signalReg: ctx.signalReg };
}
