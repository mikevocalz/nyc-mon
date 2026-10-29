// Bakes Valdrada's AR33/AR34 area parts that lane C owns, as built on a default load, into streamed cell packages:
//   vk  (city/vk/*: the Manhattan Valley arch, viaduct and 125 St station with stations/irt125.js, the Park Avenue
//        viaduct; the Riverside Drive viaduct lies outside the square)
//   pk  (city/pk/props.js: the surveyed street hardware of 125th Street: lamps, signals, signs, baskets, kiosks, bus
//        stops, racks, hydrants, meters, planters, tree guards, sheds, subway entrances)
//   lk  (city/lk/life.js: the street's life: vendors, carts, two-wheelers, bags, A-frames, cafe seating, sheds)
// pk and lk replace the compiled furniture in their zones (Valdrada drops it there: areas.js dropFurniture), so the
// furniture bake and this one together are what Valdrada draws on 125th.
//
// Source: Valdrada v0.4.0 (2724c79, MIT) run as shipped under Node (valdrada-runtime.mjs, assemble-city.mjs), each part
// built by its own build() on the real call path (world/assemble.js L3038 areaBuild).
//
// What is stored is what Valdrada itself keeps, not its merged output. pk and lk pose one model per surveyed piece
// (`modelFor(kind, p, q)`, q = 1 near, 0 far) and merge the posed copies per material key per cell, the near set only when
// a camera comes within LOD_R (props.js L428-L476, life.js L117-L134). The bake records every piece those builds posed
// (a load hook reports each one from `posed`; the source is otherwise untouched) and keeps each model ONCE as a prototype
// per material key, with one placement per piece; the runtime poses and merges a cell's pieces the same way when the
// cell streams in (cell-package.ts). vk's structure is one-off geometry: its triangles are cut into cells and kept as
// cell-local prototypes placed once; its rivet heads and spike cards (InstancedMeshes, vkKit.js L264/L278) are shared
// prototypes placed at every instance.
//
// Levels: pk and lk ship Valdrada's own far models (q = 0), pk's flattened into one vertex-coloured key the way
// flattenFar (props.js L290) does, lk's keys remapped by FAR_KEY (life.js L56). vk's far level is meshoptimizer's
// simplifier over the near one (as tooling/city/bake-cars.mjs uses it); the rivet heads and spikes are near only.
//
// Heights: a pk or lk piece keeps its height over the Valdrada ground it was posed on (its own groundY: the padYNear
// datum) and stands on ours (walkability.ts groundHeight); vk is one rigid structure per corridor: it keeps its height
// over Valdrada's street at its 125th Street crossing and stands on ours there.
//
// Output (Metro assets, `bin` is in apps/mobile/metro.config.js assetExts):
//   furniture/assets/protos.bin   the shared prototypes (pk, lk, vk instance geometry)
//   furniture/cells/<cx>_<cz>.bin per cell: its vk prototypes and every placement in it
//   furniture/data/structures.ts  the manifest: cells, bounds, vertex counts, prototypes, material descriptors
// Formats: furniture/cell-package.ts.
//
// Run: VD_TOOLS=/path/to/tools node tooling/city/vd-port/bake-structures.mjs
import { registerHooks, createRequire as createRequireNode } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { REPO, THREE, vd } from './valdrada-runtime.mjs';
import { slotTable } from './structure-slots.mjs';

// ---------------------------------------------------------------- the load hook: pk and lk report what they pose
const PATCH = {
  '/client/src/city/pk/props.js': ['pk', 'export { modelFor as __vdModelFor, matFor as __vdMatFor, CAST as __vdCast, FAR_KEEP as __vdFarKeep, farColor as __vdFarColor, LOD_R as __vdLodR };'],
  '/client/src/city/lk/life.js': ['lk', 'export { modelFor as __vdModelFor, CAST as __vdCast, FAR_KEY as __vdFarKey, LOD_R as __vdLodR };'],
};
registerHooks({
  load(url, ctx, next) {
    const r = next(url, ctx);
    const hit = Object.keys(PATCH).find((k) => url.endsWith(k));
    if (!hit) return r;
    const [part, exp] = PATCH[hit];
    const anchor = '      const m = modelFor(it.kind, it.p, q);\n      if (!m) continue;\n';
    let src = String(r.source);
    if (!src.includes(anchor)) throw new Error(`${hit}: posed() changed, the bake hook does not apply`);
    src = src.replace(anchor, `${anchor}      if (globalThis.__vdPosed) globalThis.__vdPosed('${part}', it, q);\n`) + `\n${exp}\n`;
    return { ...r, source: src, shortCircuit: true };
  },
});
const posedItems = { pk: [], lk: [] };
globalThis.__vdPosed = (part, it, q) => { if (q === 0) posedItems[part].push({ ...it }); };

const { assembleCity } = await import('./assemble-city.mjs');
const { valdradaGround, toSceneExact, AFF, EXTENT } = await import('./valdrada-ground.mjs');

const HERE = dirname(fileURLToPath(import.meta.url));
const FURN = join(REPO, 'packages/app/features/game/world/vd-port/furniture');
const CELLS_DIR = join(FURN, 'cells');
// 64 m cells: half Valdrada's 128 m cell (docs/specs/cell-package.md §1) so one cell's near set stays well under the
// iPad's 250k-vertex resident cap where the Manhattan Valley viaduct is densest
const CELL = 64;
const NEAR_M = 60;         // integrator: the near models within ~60 m, the far ones past it
// vk's levels, meshopt simplification by ABSOLUTE error (metres; meshopt takes it relative to the mesh extent): the near
// level only drops what moves no vertex more than VK_NEAR_ABS (coplanar plate splits; attribute seams kept, so a face's
// rivet rows and uv stay); the far level keeps VK_FAR_RATIO of the triangles within VK_FAR_ABS, components under that
// size pruned (a rivet row, a lacing bar is sub-pixel past 60 m)
const VK_NEAR_ABS = +(process.env.VK_NEAR_ABS ?? 0.005);
const VK_FAR_ABS = +(process.env.VK_FAR_ABS ?? 0.12);
const VK_FAR_RATIO = +(process.env.VK_FAR_RATIO ?? 0.1);
const VK_NEAR_SLOPPY = +(process.env.VK_NEAR_SLOPPY ?? 0.015);
const log = (s) => process.stderr.write(s + '\n');

const pnpm = join(REPO, 'node_modules/.pnpm');
const meshoptDir = readdirSync(pnpm).find((d) => d.startsWith('meshoptimizer@'));
const { MeshoptSimplifier } = await import(pathToFileURL(join(pnpm, meshoptDir, 'node_modules/meshoptimizer/meshopt_simplifier.js')).href);
await MeshoptSimplifier.ready;
const { mergeGeometries, mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js');

// our ground: the runtime's ctx.groundY is walkability.ts groundHeight over the bundled tile
const { parseCityDataset } = await import(pathToFileURL(join(REPO, 'packages/app/features/game/city-dataset.ts')).href);
const { createWalkQueries } = await import(pathToFileURL(join(REPO, 'packages/app/features/game/world/walkability.ts')).href);
const dataset = parseCityDataset(JSON.parse(readFileSync(join(REPO, 'packages/app/features/game/data/harlem-apollo.json'), 'utf8')));
const ourGround = createWalkQueries(dataset).groundHeight;

// --ring ring1 (or VD_RING=ring1): assemble the ring's tiles too (VD_TILES, assemble-city.mjs) and keep the pieces
// in its region as well as the square's. --ring ring2 .. --ring ring4: the union bake — home + rings 1..N tiles and
// regions — so the earlier rings' cells are repacked alongside the new ring's rather than dropped. The ring-only
// cells stream: they pack under cells/<ring>/, carry key '<ring>/<cx>_<cz>' (the fetch path
// 'structures/<ring>/<cx>_<cz>'), and stay out of VD_CELL_ASSETS.
const RING = process.argv.includes('--ring') ? process.argv[process.argv.indexOf('--ring') + 1] : process.env.VD_RING ?? null;
let inRegion = null;
let R1S = null, inRing1 = null, inRing2 = null, inRing3 = null;
if (RING === 'ring1' || RING === 'ring2' || RING === 'ring3' || RING === 'ring4') {
  const { RING1_TILES, ring1RectsScene, inRing1Scene, inHomeSquare } = await import('./ring1.mjs');
  const { tileIdsForSquare } = await import('../valdrada/decode.mjs');
  const tiles = [...tileIdsForSquare(), ...RING1_TILES.map((k) => `t_${k}`)];
  const { AFF: R1AFF } = await import('./valdrada-ground.mjs');
  R1S = ring1RectsScene(R1AFF);
  inRing1 = (x, z) => inRing1Scene(x, z, R1S);
  inRegion = (x, z) => inHomeSquare(x, z) || inRing1(x, z);
  if (RING !== 'ring1') {
    const { RING2_TILES, ring2RectsScene, inRing2Scene } = await import('./ring2.mjs');
    for (const k of RING2_TILES) tiles.push(`t_${k}`);
    const R2S = ring2RectsScene(R1AFF);
    inRing2 = (x, z) => inRing2Scene(x, z, R2S);
    const keepR1 = inRegion;
    inRegion = (x, z) => keepR1(x, z) || inRing2(x, z);
    if (RING === 'ring3' || RING === 'ring4') {
      const { RING3_TILES, ring3RectsScene, inRing3Scene } = await import('./ring3.mjs');
      for (const k of RING3_TILES) tiles.push(`t_${k}`);
      const R3S = ring3RectsScene(R1AFF);
      inRing3 = (x, z) => inRing3Scene(x, z, R3S);
      const keepR2 = inRegion;
      inRegion = (x, z) => keepR2(x, z) || inRing3(x, z);
      if (RING === 'ring4') {
        const { RING4_TILES, ring4RectsScene, inRing4Scene } = await import('./ring4.mjs');
        for (const k of RING4_TILES) tiles.push(`t_${k}`);
        const R4S = ring4RectsScene(R1AFF);
        const keepR3 = inRegion;
        inRegion = (x, z) => keepR3(x, z) || inRing4Scene(x, z, R4S);
      }
    }
  }
  process.env.VD_TILES = [...new Set(tiles)].join(',');
} else if (RING) throw new Error(`unknown --ring ${RING}`);
const keep = (x, z) => inRegion ? inRegion(x, z) : Math.abs(x) <= EXTENT && Math.abs(z) <= EXTENT;

const { groups } = await assembleCity(log);
const PK = await vd('city/pk/props.js');
const LK = await vd('city/lk/life.js');
const { lkMat } = await vd('city/lk/lkMats.js');
const { pkFarMat } = await vd('city/pk/pkMats.js');
log(`posed: pk ${posedItems.pk.length}, lk ${posedItems.lk.length}`);

// ---------------------------------------------------------------- material slots
const describers = [];
for (const [file, fn] of [['describe-vk.mjs', 'describeVk'], ['describe-pbr.mjs', 'describePbr']]) {
  if (existsSync(join(HERE, file))) describers.push((await import(pathToFileURL(join(HERE, file)).href))[fn]);
}
const canvases = new Map();   // key -> { canvas, w, h }
const rgb = (c) => (c ? [c.r, c.g, c.b].map((v) => +v.toFixed(5)) : null);
function texRef(t) {
  if (!t || !t.image) return null;
  const img = t.image;
  if (typeof img.getContext !== 'function') return { kind: 'unsupported', name: t.name || '' };
  const key = `tex:${t.uuid}`;
  if (!canvases.has(key)) canvases.set(key, { canvas: img, w: img.width, h: img.height });
  return { kind: 'canvas', key, repeat: [t.repeat.x, t.repeat.y], offset: [t.offset.x, t.offset.y], wrap: [t.wrapS, t.wrapT], srgb: t.colorSpace === THREE.SRGBColorSpace };
}
/** Plain three materials as Valdrada sets them (rebuilt as standard/basic/physical node materials, std-material.ts). */
function describeStd(m) {
  return {
    family: 'std', type: m.type, name: m.name || '',
    color: rgb(m.color), emissive: rgb(m.emissive), emissiveIntensity: m.emissiveIntensity ?? 0,
    roughness: m.roughness ?? null, metalness: m.metalness ?? null, envMapIntensity: m.envMapIntensity ?? null,
    opacity: m.opacity, transparent: m.transparent, alphaTest: m.alphaTest, side: m.side, depthWrite: m.depthWrite,
    vertexColors: m.vertexColors, blending: m.blending, toneMapped: m.toneMapped,
    map: texRef(m.map), emissiveMap: texRef(m.emissiveMap), alphaMap: texRef(m.alphaMap),
    transmission: m.transmission ?? null, thickness: m.thickness ?? null, ior: m.ior ?? null,
    clearcoat: m.clearcoat ?? null, clearcoatRoughness: m.clearcoatRoughness ?? null, sheen: m.sheen ?? null,
  };
}
const slotIndex = new Map();   // material -> slot
const slots = [];
function slotOf(m, part = null, key = null) {
  if (slotIndex.has(m)) return slotIndex.get(m);
  let d = null;
  for (const f of describers) { d = f(m); if (d) break; }
  if (!d) d = describeStd(m);
  // the part's own material key (pk matFor / lk lkMat): what their per-frame ticks address (props.js L202, lkMats.js L121)
  if (part) d = { ...d, part, key };
  const sig = JSON.stringify(d);
  let s = slots.findIndex((x) => x.key === sig);
  if (s < 0) { s = slots.length; slots.push({ key: sig, desc: d, mat: m }); }
  slotIndex.set(m, s);
  return s;
}

// ---------------------------------------------------------------- prototypes
// A prototype: one material slot's geometry in its own space. Shared ones are deduplicated by content.
const protos = [];         // { id, slot, castShadow, geo, hash, shared, cell }
const protoByHash = new Map();
function geoHash(g, slot) {
  const h = createHash('sha256').update(String(slot));
  for (const n of Object.keys(g.attributes).sort()) { const a = g.attributes[n].array; h.update(n).update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
  if (g.index) { const a = g.index.array; h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
  return h.digest('hex').slice(0, 24);
}
// pk and lk models are lathes and sweeps at Valdrada's own segment counts; a prototype is simplified within
// PROTO_ABS metres (seams kept), which only removes collinear and coplanar splits at that tolerance
const PROTO_ABS = +(process.env.PROTO_ABS ?? 0.002);
function addProto(geo, slot, castShadow, shared, cell = null) {
  let g = geo.index ? geo : mergeVertices(geo, 1e-5);
  if (!g.index) { const n = g.attributes.position.count; g.setIndex(Array.from({ length: n }, (_, i) => i)); }
  if (shared && PROTO_ABS > 0 && g.index.count > 300) g = compact(simplify(g, 0, PROTO_ABS, []));
  if (g.index.count < 3) return -1;   // nothing left to draw (a simplified far level of a sliver)
  const hash = geoHash(g, slot);
  if (shared && protoByHash.has(hash)) { const p = protoByHash.get(hash); p.castShadow ||= castShadow; return p.id; }
  const id = protos.length;
  g.computeBoundingBox();
  protos.push({ id, slot, castShadow, geo: g, hash, shared, cell });
  if (shared) protoByHash.set(hash, protos[id]);
  return id;
}

// ---------------------------------------------------------------- placements
// matrix: Valdrada's pose (model -> Valdrada world), then the vd-port transform (x, z affine; y re-grounded by dy)
const placements = new Map();   // cell key -> [{ proto, lod, m: Float32Array(12) }]
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0), _one = new THREE.Vector3(1, 1, 1), _v = new THREE.Vector3();
const affine = (dy) => new THREE.Matrix4().set(AFF.sx, 0, 0, AFF.ox, 0, 1, 0, dy, 0, 0, AFF.sz, AFF.oz, 0, 0, 0, 1);
function place(protoId, lod, worldMatrix, dy, sceneX, sceneZ) {
  if (protoId < 0 || !keep(sceneX, sceneZ)) return false;
  const M = affine(dy).multiply(worldMatrix);
  const e = M.elements;
  const key = `${Math.floor(sceneX / CELL)}_${Math.floor(sceneZ / CELL)}`;
  if (!placements.has(key)) placements.set(key, []);
  // 3 x 4 row-major: the first three rows of the column-major Matrix4
  placements.get(key).push({ proto: protoId, lod, m: Float32Array.from([e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]]) });
  return true;
}

// pk and lk pieces
const stats = { pkPieces: 0, lkPieces: 0, vkInstances: 0 };
// pk's lamp spots (props.js L417-L420): the luminaire on each lamp and lamp-carrying signal, for the night lights
const { lampKind } = await vd('world/night11.js');
const PKK = await vd('city/pk/pkKit.js');
const pkLamps = [];
const FAR_KEEP = PK.__vdFarKeep;
for (const part of ['pk', 'lk']) {
  const mod = part === 'pk' ? PK : LK;
  for (const it of posedItems[part]) {
    const [sx, sz] = toSceneExact(it.x, it.z);
    if (!keep(sx, sz)) continue;
    const dy = ourGround(sx, sz) - valdradaGround(it.x, it.z);
    _m4.compose(_v.set(it.x, it.y, it.z), _q.setFromAxisAngle(_Y, it.yaw), _one);
    if (part === 'pk' && (it.kind === 'lamp' || (it.kind === 'signal' && it.p && it.p.lamp))) {
      const out = it.kind === 'lamp' ? PKK.LAMP.armOut + 0.35 : 2.5, hy = it.kind === 'lamp' ? PKK.LAMP.headY : 8.0;
      const hx = it.x + Math.sin(it.yaw) * out, hz = it.z + Math.cos(it.yaw) * out;
      const [lx, lz] = toSceneExact(hx, hz);
      // [x, y over ground, z, kind, mounting height, yaw], as furniture/data/lamps.ts
      pkLamps.push(+lx.toFixed(3), +(it.y + 0.07 - valdradaGround(it.x, it.z)).toFixed(3), +lz.toFixed(3), lampKind(hx, hz, false), +(hy - 0.07).toFixed(3), +it.yaw.toFixed(4));
    }
    for (const q of [1, 0]) {
      const m = mod.__vdModelFor(it.kind, it.p, q);
      if (!m) continue;
      const lod = q ? 0 : 1;
      if (part === 'pk' && !q) {
        // flattenFar: the far keys that neither glow, animate nor blend become one vertex-coloured key (pkFarMat)
        const flat = [];
        let cast = false;
        for (const [key, g] of Object.entries(m.parts)) {
          if (FAR_KEEP.test(key) || !g.attributes.normal) { place(addProto(g, slotOf(PK.__vdMatFor(key), 'pk', key), PK.__vdCast.has(key), true), lod, _m4, dy, sx, sz); continue; }
          const src = g.index ? g.toNonIndexed() : g, c = PK.__vdFarColor(key), n = src.attributes.position.count;
          const ng = new THREE.BufferGeometry();
          ng.setAttribute('position', src.attributes.position.clone());
          ng.setAttribute('normal', src.attributes.normal.clone());
          const ca = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; }
          ng.setAttribute('color', new THREE.BufferAttribute(ca, 3));
          flat.push(ng);
          cast ||= PK.__vdCast.has(key);
        }
        if (flat.length) place(addProto(mergeGeometries(flat, false), slotOf(pkFarMat(), 'pk', '__far'), cast, true), lod, _m4, dy, sx, sz);
        continue;
      }
      for (const [k0, g] of Object.entries(m.parts)) {
        const key = part === 'lk' && !q ? (LK.__vdFarKey[k0] || k0) : k0;
        const mat = part === 'pk' ? PK.__vdMatFor(key) : lkMat(key);
        const cast = (part === 'pk' ? PK.__vdCast : LK.__vdCast).has(key);
        place(addProto(g, slotOf(mat, part, key), cast, true), lod, _m4, dy, sx, sz);
      }
    }
    stats[`${part}Pieces`]++;
  }
}

// vk: the structure's meshes (one-off: cut by cell) and its instanced rivet heads and spike cards (shared, near only)
const anchors = { mvv: [1088.46, -3623.33] };   // vk/mvv.js L13 MV.C, the arch over W 125th St
{
  const park = await vd('city/vk/park.js');
  const p = park.PP(1187.1, 3449.2, 0);          // vk/viaducts.js L119: Park Avenue at E 125th St
  anchors.park = [p[0], p[2]];
}
const anchorDy = {};
for (const [k, [ax, az]] of Object.entries(anchors)) { const [sx, sz] = toSceneExact(ax, az); anchorDy[k] = { dy: +(ourGround(sx, sz) - valdradaGround(ax, az)).toFixed(4), vdGround: +valdradaGround(ax, az).toFixed(4), scene: [+sx.toFixed(2), +sz.toFixed(2)] }; }
const vkDy = (x, z) => anchorDy[Math.hypot(x - anchors.mvv[0], z - anchors.mvv[1]) < Math.hypot(x - anchors.park[0], z - anchors.park[1]) ? 'mvv' : 'park'].dy;
const isVk = (o) => { let p = o; while (p && !p.userData.vdSrc) p = p.parent; const s = p?.userData.vdSrc || ''; return s.split('<').some((f) => f.startsWith('city/vk/') || f.startsWith('city/stations/')); };
const vkCellGeos = new Map();   // `${cell}|${slot}|${cast}` -> geometries (scene space)
const _w = new THREE.Matrix4();
for (const { group } of groups) {
  group.updateMatrixWorld(true);
  const list = [];
  group.traverse((o) => { if (o.isMesh && isVk(o)) list.push(o); });
  for (const mesh of list) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.length !== 1) throw new Error(`${mesh.name}: a multi-material vk mesh`);
    // a material is only described (and its canvases packed) when the mesh puts something inside the square
    if (mesh.isInstancedMesh) {
      let proto = -2;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, _w);
        _w.premultiply(mesh.matrixWorld);
        _v.setFromMatrixPosition(_w);
        const [sx, sz] = toSceneExact(_v.x, _v.z);
        if (!keep(sx, sz)) continue;
        if (proto === -2) proto = addProto(mesh.geometry.clone(), slotOf(mats[0]), mesh.castShadow, true);
        if (place(proto, 0, _w.clone(), vkDy(_v.x, _v.z), sx, sz)) stats.vkInstances++;
      }
      continue;
    }
    const g0 = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    const pos = g0.attributes.position;
    const dy = vkDy(pos.getX(0), pos.getZ(0));
    const byCell = new Map();
    for (let t = 0; t < pos.count; t += 3) {
      let cx = 0, cz = 0;
      for (let k = 0; k < 3; k++) { cx += pos.getX(t + k) / 3; cz += pos.getZ(t + k) / 3; }
      const [sx, sz] = toSceneExact(cx, cz);
      if (!keep(sx, sz)) continue;
      const key = `${Math.floor(sx / CELL)}_${Math.floor(sz / CELL)}`;
      if (!byCell.has(key)) byCell.set(key, []);
      byCell.get(key).push(t);
    }
    const slot = byCell.size ? slotOf(mats[0]) : -1;
    for (const [key, tris] of byCell) {
      const out = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(g0.attributes)) {
        const arr = new Float32Array(tris.length * 3 * a.itemSize);
        for (let i = 0; i < tris.length; i++) for (let k = 0; k < 3; k++) for (let c = 0; c < a.itemSize; c++) arr[(i * 3 + k) * a.itemSize + c] = a.getComponent(tris[i] + k, c);
        out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
      }
      out.applyMatrix4(affine(dy));   // into scene space: the cell prototype is placed once, at identity
      const ck = `${key}|${slot}|${mesh.castShadow ? 1 : 0}`;
      if (!vkCellGeos.has(ck)) vkCellGeos.set(ck, []);
      vkCellGeos.get(ck).push(out);
    }
  }
}
function sloppy(geo, ratio, absError) {
  const P = Float32Array.from(geo.attributes.position.array), idx = Uint32Array.from(geo.index.array);
  const scale = MeshoptSimplifier.getScale(P, 3) || 1;
  const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3);
  const [out] = MeshoptSimplifier.simplifySloppy(idx, P, 3, null, target, absError / scale);
  const g = geo.clone(); g.setIndex(new THREE.BufferAttribute(out, 1)); return g;
}
function simplify(geo, ratio, absError, flags) {
  const P = Float32Array.from(geo.attributes.position.array), idx = Uint32Array.from(geo.index.array);
  const scale = MeshoptSimplifier.getScale(P, 3) || 1;
  const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3);
  const [out] = MeshoptSimplifier.simplify(idx, P, 3, target, absError / scale, flags);
  const g = geo.clone(); g.setIndex(new THREE.BufferAttribute(out, 1)); return g;
}
/** Drops the vertices an index no longer reaches (after simplification). */
function compact(geo) {
  const idx = geo.index.array, remap = new Int32Array(geo.attributes.position.count).fill(-1);
  let n = 0;
  for (const i of idx) if (remap[i] < 0) remap[i] = n++;
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) {
    const arr = new Float32Array(n * a.itemSize);
    for (let i = 0; i < remap.length; i++) if (remap[i] >= 0) for (let c = 0; c < a.itemSize; c++) arr[remap[i] * a.itemSize + c] = a.getComponent(i, c);
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  out.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx, (i) => remap[i]), 1));
  return out;
}
const unAffine = affine(0).invert();
for (const [ck, list] of vkCellGeos) {
  const [key, slot, cast] = ck.split('|');
  const names = Object.keys(list[0].attributes).filter((n) => list.every((g) => g.attributes[n]));
  for (const g of list) for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
  const merged = mergeVertices(mergeGeometries(list, false), 1e-5);
  // the near level within VK_NEAR_SLOPPY (1.5 cm): the full near set is ~1.6M vertices in the square (~40 MB packed), over
  // the 25 MB package cap; sloppy clustering at 1.5 cm (a pixel at ~20 m on the iPad) brings it to a third
  const near = compact(sloppy(compact(simplify(merged, 0, VK_NEAR_ABS, ['Prune'])), 0, VK_NEAR_SLOPPY));
  const far = compact(sloppy(near, VK_FAR_RATIO, VK_FAR_ABS));
  const [cx, cz] = key.split('_').map(Number);
  const at = (cx + 0.5) * CELL, bt = (cz + 0.5) * CELL;
  // place() composes the vd-port transform onto a Valdrada pose; these prototypes are in scene space already
  place(addProto(near, +slot, cast === '1', false, key), 0, unAffine, 0, at, bt);
  place(addProto(far, +slot, cast === '1', false, key), 1, unAffine, 0, at, bt);
}
log(`prototypes ${protos.length}, slots ${slots.length}, cells ${placements.size}`);

// ---------------------------------------------------------------- pack
const pad4 = (b) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b);
function oct(nx, ny, nz) {
  const l = Math.abs(nx) + Math.abs(ny) + Math.abs(nz) || 1;
  let x = nx / l, y = ny / l;
  if (nz < 0) { const ox = x; x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1); y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1); }
  return [Math.round(Math.max(-1, Math.min(1, x)) * 127), Math.round(Math.max(-1, Math.min(1, y)) * 127)];
}
const toSrgb8 = (v) => { const c = Math.max(0, Math.min(1, v)); return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255); };
const EXTRA = ['aRv', 'aJ'];
const _f32 = new Float32Array(1), _u32 = new Uint32Array(_f32.buffer);
function toHalf(v) {   // round-to-nearest IEEE 754 binary16
  _f32[0] = v; const x = _u32[0];
  const sign = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 127 + 15, m = x & 0x7fffff;
  if (e <= 0) { if (e < -10) return sign; const mm = (m | 0x800000) >> (1 - e); return sign | ((mm + 0x1000) >> 13); }
  if (e >= 31) return sign | 0x7c00 | (((x >>> 23) & 0xff) === 0xff && m ? 0x200 : 0);
  const h = sign | (e << 10) | (m >> 13);
  return (m & 0x1000) ? h + 1 : h;
}
/** One prototype's blocks (cell-package.ts ProtoMeta / decodeProto). */
function packProto(p) {
  const geo = p.geo;
  const n = geo.attributes.position.count;
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, C = geo.attributes.color;
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const box = [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z];
  const q = (v, lo, hi) => (hi - lo < 1e-9 ? 0 : Math.round(((v - lo) / (hi - lo)) * 65535));
  const blocks = [];
  const pb = Buffer.alloc(n * 6);
  for (let i = 0; i < n; i++) { pb.writeUInt16LE(q(P.getX(i), box[0], box[3]), i * 6); pb.writeUInt16LE(q(P.getY(i), box[1], box[4]), i * 6 + 2); pb.writeUInt16LE(q(P.getZ(i), box[2], box[5]), i * 6 + 4); }
  blocks.push(pb);
  const nb = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) { const [a, c] = N ? oct(N.getX(i), N.getY(i), N.getZ(i)) : [0, 127]; nb.writeInt8(a, i * 2); nb.writeInt8(c, i * 2 + 1); }
  blocks.push(nb);
  let uv = null;
  if (U) {
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (let i = 0; i < n; i++) { u0 = Math.min(u0, U.getX(i)); u1 = Math.max(u1, U.getX(i)); v0 = Math.min(v0, U.getY(i)); v1 = Math.max(v1, U.getY(i)); }
    uv = [u0, v0, u1, v1];
    const ub = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) { ub.writeUInt16LE(q(U.getX(i), u0, u1), i * 4); ub.writeUInt16LE(q(U.getY(i), v0, v1), i * 4 + 2); }
    blocks.push(ub);
  }
  if (C) {
    const cb = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) cb.writeUInt8(toSrgb8(C.getComponent(i, k)), i * 4 + k); cb.writeUInt8(255, i * 4 + 3); }
    blocks.push(cb);
  }
  const extras = [];
  for (const name of EXTRA) {
    const a = geo.attributes[name];
    if (!a) continue;
    // half floats: per-face constants in metres (vkKit.js L5-L8: width, rivet rows, pitch, member length) and a seed
    const eb = Buffer.alloc(n * a.itemSize * 2);
    for (let i = 0; i < n; i++) for (let c = 0; c < a.itemSize; c++) eb.writeUInt16LE(toHalf(a.getComponent(i, c)), (i * a.itemSize + c) * 2);
    blocks.push(eb);
    extras.push([name, a.itemSize]);
  }
  const idx = geo.index.array, wide = n > 65535;
  const ib = Buffer.alloc(idx.length * (wide ? 4 : 2));
  for (let i = 0; i < idx.length; i++) (wide ? ib.writeUInt32LE(idx[i], i * 4) : ib.writeUInt16LE(idx[i], i * 2));
  blocks.push(ib);
  const body = Buffer.concat(blocks.map(pad4));
  return { body, meta: { slot: p.slot, castShadow: p.castShadow, vertices: n, indices: idx.length, box: box.map((v) => +v.toFixed(4)), uv: uv && uv.map((v) => +v.toFixed(5)), color: !!C, extras, wide } };
}
rmSync(CELLS_DIR, { recursive: true, force: true });
mkdirSync(CELLS_DIR, { recursive: true });
mkdirSync(join(FURN, 'assets'), { recursive: true });
const sharedBodies = [];
const protoMeta = protos.map(() => null);
let sharedOffset = 0;
for (const p of protos) {
  if (!p.shared) continue;
  const { body, meta } = packProto(p);
  protoMeta[p.id] = { ...meta, file: '', offset: sharedOffset, bytes: body.length };
  sharedBodies.push(body);
  sharedOffset += body.length;
}
writeFileSync(join(FURN, 'assets/protos.bin'), Buffer.concat(sharedBodies));
// a cell file: its own prototypes, then the placements (u32 proto, u32 lod, f32 x 12)
const PLACEMENT_BYTES = 56;
const cellRows = [];
let diskBytes = sharedOffset;
const vertsOf = (pr) => protos[pr].geo.attributes.position.count;
const corner = new THREE.Vector3();
const ringCellKey = (key, list) => {
  if (!RING) return { key, file: `${key}.bin`, bundled: true };
  const [cx, cz] = key.split('_').map(Number);
  const home = cx * CELL < 850 && cx * CELL + CELL > -850 && cz * CELL < 850 && cz * CELL + CELL > -850;
  if (home) return { key, file: `${key}.bin`, bundled: true };
  // a cell inside a ring but not overlapping the square streams: its file lives under cells/<ring>/ and its key
  // carries the ring namespace, so 'structures/<key>' never collides with a home cell's pin. Under the union bake
  // a cell keeps the lowest ring namespace its placements reach: a ring-1 placement pins 'ring1', else a ring-2
  // placement 'ring2', else a ring-3 placement 'ring3', else the cell is new to the latest ring and packs under it.
  // A cell-local prototype's placement is its own cell (the vk corridor pieces' matrix is near identity, which is
  // inside ring 1's rect — it must not namespace the cell), so its ring is the cell's, not its matrix's.
  const at = (x) => { const p = protos[x.proto]; return p && !p.shared && p.cell === key ? [cx * CELL + CELL / 2, cz * CELL + CELL / 2] : [x.m[3], x.m[11]]; };
  const inNs = (inR) => !!inR && list.some((x) => inR(...at(x)));
  const ns = inNs(inRing1) ? 'ring1' : inNs(inRing2) ? 'ring2' : inNs(inRing3) ? 'ring3' : RING;
  return { key: `${ns}/${key}`, file: `${ns}/${key}.bin`, bundled: false };
};
for (const [cellKey, list] of [...placements].sort()) {
  const { key, file: cellFile } = ringCellKey(cellKey, list);
  const own = protos.filter((p) => !p.shared && p.cell === cellKey);
  const bodies = [];
  let off = 0;
  for (const p of own) { const { body, meta } = packProto(p); protoMeta[p.id] = { ...meta, file: key, offset: off, bytes: body.length }; bodies.push(body); off += body.length; }
  const pl = Buffer.alloc(list.length * PLACEMENT_BYTES);
  list.forEach((x, i) => { pl.writeUInt32LE(x.proto, i * PLACEMENT_BYTES); pl.writeUInt32LE(x.lod, i * PLACEMENT_BYTES + 4); for (let k = 0; k < 12; k++) pl.writeFloatLE(x.m[k], i * PLACEMENT_BYTES + 8 + k * 4); });
  const file = Buffer.concat([...bodies, pl]);
  mkdirSync(dirname(join(CELLS_DIR, cellFile)), { recursive: true });
  writeFileSync(join(CELLS_DIR, cellFile), file);
  diskBytes += file.length;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const x of list) {
    const bx = protos[x.proto].geo.boundingBox, m = x.m;
    for (let c = 0; c < 8; c++) {
      corner.set(c & 1 ? bx.max.x : bx.min.x, c & 2 ? bx.max.y : bx.min.y, c & 4 ? bx.max.z : bx.min.z);
      const X = m[0] * corner.x + m[1] * corner.y + m[2] * corner.z + m[3], Y = m[4] * corner.x + m[5] * corner.y + m[6] * corner.z + m[7], Z = m[8] * corner.x + m[9] * corner.y + m[10] * corner.z + m[11];
      x0 = Math.min(x0, X); y0 = Math.min(y0, Y); z0 = Math.min(z0, Z); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); z1 = Math.max(z1, Z);
    }
  }
  cellRows.push({
    key, bounds: [x0, y0, z0, x1, y1, z1].map((v) => +v.toFixed(2)), placements: list.length, placementsOffset: off, bytes: file.length,
    near: list.filter((x) => x.lod === 0).reduce((a, x) => a + vertsOf(x.proto), 0),
    far: list.filter((x) => x.lod === 1).reduce((a, x) => a + vertsOf(x.proto), 0),
    // the cell streamer's packages: [level, slot, cast, vertices, indices, ...] (structure-slots.mjs)
    slots: slotTable(list, protoMeta),
  });
}

// the canvas textures of the std family into ONE 1024 x 704 atlas (rows bottom-up): identical canvases share a slot,
// and every canvas is scaled by one factor, the largest that packs. 2.8 MB of RGBA8, 3.7 MB with mips: with the panel atlas
// (5.3 MB) and the PBR arrays (6.0 MB) lane C's textures stay within +16 MB.
const ATLAS = 1024, ATLAS_H = 704;
function awaitCanvas() { return createRequireTools()('@napi-rs/canvas'); }
function createRequireTools() { return createRequireNode(join(process.env.VD_TOOLS, 'package.json')); }
// a white block first: the rect a slot without a map (or without an emissive map) samples, so every std slot runs one
// graph (std-material.ts)
canvases.set('white', { canvas: (() => { const c = awaitCanvas().createCanvas(8, 8); const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 8, 8); return c; })(), w: 8, h: 8 });
const uniq = new Map();   // pixel hash -> slot key
const alias = new Map();  // canvas key -> slot key
for (const [key, t] of canvases) {
  const d = t.canvas.getContext('2d').getImageData(0, 0, t.w, t.h).data;
  const h = createHash('sha256').update(`${t.w}x${t.h}`).update(Buffer.from(d.buffer, d.byteOffset, d.byteLength)).digest('hex');
  if (!uniq.has(h)) uniq.set(h, key);
  alias.set(key, uniq.get(h));
}
const slotsTex = [...uniq.values()].map((k) => [k, canvases.get(k)]);
function pack(scale) {
  let x = 0, y = 0, rowH = 0;
  const out = [];
  for (const [key, t] of [...slotsTex].sort((p, q) => q[1].h - p[1].h)) {
    const w = key === 'white' ? 8 : Math.max(4, Math.round(t.w * scale)), h = key === 'white' ? 8 : Math.max(4, Math.round(t.h * scale));
    if (w > ATLAS) return null;
    if (x + w > ATLAS) { x = 0; y += rowH + 4; rowH = 0; }
    out.push({ key, ...t, x, y, pw: w, ph: h });
    x += w + 4; rowH = Math.max(rowH, h);
  }
  return y + rowH <= ATLAS_H ? out : null;
}
let texScale = 1, placed = null;
while (!(placed = pack(texScale))) texScale *= 0.95;
const atlasH = ATLAS_H;
const { createCanvas } = (await import('node:module')).createRequire(join(process.env.VD_TOOLS, 'package.json'))('@napi-rs/canvas');
const atlas = createCanvas(ATLAS, atlasH);
const actx = atlas.getContext('2d');
for (const t of placed) actx.drawImage(t.canvas, t.x, t.y, t.pw, t.ph);
const raw = actx.getImageData(0, 0, ATLAS, atlasH).data;
const flipped = Buffer.alloc(ATLAS * atlasH * 4);
for (let y = 0; y < atlasH; y++) Buffer.from(raw.buffer, raw.byteOffset + (atlasH - 1 - y) * ATLAS * 4, ATLAS * 4).copy(flipped, y * ATLAS * 4);
writeFileSync(join(FURN, 'assets/sign-atlas.bin'), flipped);
const rectOf = Object.fromEntries(placed.map((t) => [t.key, [t.x / ATLAS, 1 - (t.y + t.ph) / atlasH, t.pw / ATLAS, t.ph / atlasH].map((v) => +v.toFixed(6))]));
const rects = Object.fromEntries([...alias].map(([k, s2]) => [k, rectOf[s2]]));

const hdr = (what) => `// GENERATED by tooling/city/vd-port/bake-structures.mjs — do not edit. ${what}
// Valdrada v0.4.0 (2724c79, MIT: tooling/city/valdrada/LICENSE.valdrada).
`;
// vk's own canvas textures (netting, fence, spikes, the station signs): pixels as Valdrada painted them, packed whole
// (they tile and carry their own sampler state), rows bottom-up (describe-vk.mjs vkTexturePixels)
const vkTexMeta = [];
{
  const vkMod = existsSync(join(HERE, 'describe-vk.mjs')) ? await import(pathToFileURL(join(HERE, 'describe-vk.mjs')).href) : null;
  const seen = new Set(), bodies = [];
  let off = 0;
  for (const s of slots) {
    if (!vkMod || s.desc.family !== 'vkTex') continue;
    const px = vkMod.vkTexturePixels(s.mat);
    for (const t of Array.isArray(px) ? px : [px]) {
      if (!t || seen.has(t.key)) continue;
      seen.add(t.key);
      const ref = s.desc.texture?.key === t.key ? s.desc.texture : {};
      vkTexMeta.push({ key: t.key, width: t.width, height: t.height, offset: off, colorSpace: ref.colorSpace ?? 'srgb', repeat: ref.repeat ?? [1, 1], wrapS: ref.wrapS ?? 1001, wrapT: ref.wrapT ?? 1001, anisotropy: ref.anisotropy ?? 1 });
      const b = Buffer.from(t.rgba.buffer, t.rgba.byteOffset, t.rgba.byteLength);
      bodies.push(pad4(b)); off += pad4(b).length;
    }
  }
  writeFileSync(join(FURN, 'assets/vk-textures.bin'), bodies.length ? Buffer.concat(bodies) : Buffer.alloc(4));
}
// vkSteel's two world-placed uniforms are in Valdrada's frame (vkMats.js: vkGround the street datum the splash zone and
// the low rust count up from; vkBand (y1, cx, cz, r^2) the disc setRivBand draws the rivet heads as geometry in): moved
// into the scene the way their structure moved (the Park Avenue steel by its anchor, the rest by Manhattan Valley's)
for (const sl of slots) {
  const d = sl.desc;
  if (d.family !== 'vkSteel' || !d.uniforms) continue;
  const a = anchorDy[String(d.name).startsWith('vk-park') ? 'park' : 'mvv'];
  if (typeof d.uniforms.vkGround === 'number') d.uniforms.vkGround = +(d.uniforms.vkGround + a.dy).toFixed(4);
  const b = d.uniforms.vkBand;
  if (Array.isArray(b) && b.length === 4) { const [bx, bz] = toSceneExact(b[1], b[2]); d.uniforms.vkBand = [+(b[0] + a.dy).toFixed(4), +bx.toFixed(3), +bz.toFixed(3), b[3]]; }
}
const manifestJson = JSON.stringify({
  cell: CELL, nearM: NEAR_M, placementBytes: PLACEMENT_BYTES, lamps: pkLamps,
  sign: { width: ATLAS, height: atlasH, rects },
  anchors: anchorDy,
  slots: slots.map((s) => s.desc),
  protos: protoMeta,
  cells: cellRows,
});
if (/"bounds":\[[^\]]*null/.test(manifestJson)) throw new Error('a cell with no bounds');
// a JSON string, parsed once at load: the type checker never sees the literal (it is far past what it can infer)
writeFileSync(join(FURN, 'data/structures.ts'), `${hdr('The streamed cells of vk, pk and lk: prototypes, cells, materials.')}
import type { StructureManifest } from '../cell-package.ts';

export const VD_STRUCTURES: StructureManifest = JSON.parse(${JSON.stringify(manifestJson)}) as StructureManifest;

/** vk's canvas textures in assets/vk-textures.bin: RGBA8, rows bottom-up, with Valdrada's sampler state. */
export const VD_VK_TEXTURES: readonly { key: string; width: number; height: number; offset: number; colorSpace: 'srgb' | 'linear'; repeat: [number, number]; wrapS: number; wrapT: number; anisotropy: number }[] = ${JSON.stringify(vkTexMeta)};
`);
writeFileSync(join(CELLS_DIR, 'index.ts'), `${hdr('Metro asset ids of the cell packages, required on demand.')}
/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles an asset only through a literal require() */
// A function per entry, so a cell's asset module is only required when the streamer asks for it (Node tests read the
// files from disk and never call these).
export const VD_CELL_ASSETS: Readonly<Record<string, () => number>> = {
${cellRows.filter((c) => !c.key.includes('/')).map((c) => `  '${c.key}': () => require('./${c.key}.bin') as number,`).join('\n')}
};

export const VD_PROTOS_ASSET = (): number => require('../assets/protos.bin') as number;
export const VD_SIGN_ATLAS_ASSET = (): number => require('../assets/sign-atlas.bin') as number;
export const VD_PBR_ALBEDO_ASSET = (): number => require('../assets/pbr-albedo.bin') as number;
export const VD_PBR_ORM_ASSET = (): number => require('../assets/pbr-orm.bin') as number;
export const VD_VK_TEXTURES_ASSET = (): number => require('../assets/vk-textures.bin') as number;
`);
const hash = createHash('sha256'); for (const c of cellRows) hash.update(readFileSync(join(CELLS_DIR, `${c.key}.bin`))); hash.update(readFileSync(join(FURN, 'assets/protos.bin')));
console.log(JSON.stringify({
  ...stats, cells: cellRows.length, slots: slots.length, protos: protos.length, sharedProtos: protos.filter((p) => p.shared).length,
  diskMB: +(diskBytes / 1e6).toFixed(2), sharedMB: +(sharedOffset / 1e6).toFixed(2), signAtlas: `${ATLAS}x${atlasH} (${canvases.size} canvases, ${placed.length} distinct, scale ${texScale.toFixed(3)}, ${(flipped.length / 1e6).toFixed(1)} MB)`,
  maxCellNear: Math.max(...cellRows.map((c) => c.near)), maxCellFar: Math.max(...cellRows.map((c) => c.far)),
  nearTotal: cellRows.reduce((a, c) => a + c.near, 0), farTotal: cellRows.reduce((a, c) => a + c.far, 0),
  families: slots.reduce((a, s) => ((a[s.desc.family] = (a[s.desc.family] || 0) + 1), a), {}),
  anchors: anchorDy, hash: hash.digest('hex').slice(0, 16),
}, null, 1));
process.exit(0);
