// Bakes Valdrada's street furniture and roof plant for the bundled square into
// packages/app/features/game/world/vd-port/furniture/data/ (lane C of the vd port).
//
// Source: Valdrada v0.4.0 (2724c79, MIT; tooling/city/valdrada/LICENSE.valdrada) run as shipped under Node
// (valdrada-runtime.mjs, assemble-city.mjs). Nothing is re-derived here:
//   * every pool's geometry is city/furnitureKit.js buildFurnitureGeos(), exactly what city/instancer.js draws;
//   * every instance is a slot of Valdrada's own Instancer after world/assemble.js assembleTile ran over the tiles that
//     cover the square: the compiled furniture records with assemble.js's ground snap, kerb nudge, signal aim and reach,
//     sign-pole one-way pick, scaffold/pier scale, hydrant and news-box colours, area-part drops (pk, vk, w125*), the
//     roof engine (city/roofEngine.js) per building, and city/streetNYC.js curb ramps; Instancer.claim then adds the
//     U10 street variance (scale, weathering tint) and nextTint's roof tints;
//   * the shared panel atlas is city/panelArt.js painted by its own canvas code.
// The lamp light spots are city/props.js L296/L300's formula over the claimed poles (world/night11.js lampKind).
//
// Coordinates: Valdrada world metres -> scene metres with the vd-port transform (decode.mjs's toScene, unrounded).
// Heights: Valdrada's compiled stack is flat over the square (terrain 3.240, asphalt 3.385, pavement 3.520 on every
// tile, checked below). A street piece keeps its height over the Valdrada surface it stands on (pavement 3.52 or
// roadway 3.385, whichever is nearer its foot) and the runtime adds ctx.groundY. A roof piece keeps its height over the
// deck Valdrada stood it on (buildRoof env.roofY) and stands on our building under it: its walls run from 0 to
// heightMeters (city-mesh.ts), so y = heightMeters - (env.h - (y - 3.52)) for a full-height deck.
//
// Pools left to the other lanes (not baked here): tree trunks and crowns (trees), stoop, awning, fireEscape3/4/5,
// standpipe, marquee (frontage, lanes A/B).
//
// Run (VD_TOOLS: a directory with @napi-rs/canvas and earcut installed, outside the repo):
//   VD_TOOLS=/path/to/tools node tooling/city/vd-port/bake-furniture.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { REPO, THREE, vd } from './valdrada-runtime.mjs';
import { assembleCity } from './assemble-city.mjs';
import { EXTENT_METERS } from '../valdrada/decode.mjs';
import { AFF, toSceneExact, valdradaGround } from './valdrada-ground.mjs';
import { packLampSpots } from './lamp-pack.mjs';

const OUT = join(REPO, 'packages/app/features/game/world/vd-port/furniture/data');
const TILE = join(REPO, 'packages/app/features/game/data/harlem-apollo.json');

const toScene = toSceneExact;
const groundVd = valdradaGround;
const log = (s) => process.stderr.write(s + '\n');
// --ring ring1 (or VD_RING=ring1): assemble the ring's tiles too (VD_TILES, assemble-city.mjs) and keep the pieces
// in its region as well as the square's. --ring ring2 .. --ring ring10: the union bake — home + rings 1..N tiles and
// regions — so the earlier rings' pieces are regenerated alongside the new ring's rather than dropped. Furniture
// pools are resident, self-culling draws, so the rings' instances join the same pools and assets (pools.bin,
// lamps.ts) rather than streaming.
const RING = process.argv.includes('--ring') ? process.argv[process.argv.indexOf('--ring') + 1] : process.env.VD_RING ?? null;
let inRegion = null;
if (RING === 'ring1' || RING === 'ring2' || RING === 'ring3' || RING === 'ring4' || RING === 'ring5' || RING === 'ring6' || RING === 'ring7' || RING === 'ring8' || RING === 'ring9' || RING === 'ring10') {
  const { RING1_TILES, ring1RectsScene, inRing1Scene, inHomeSquare } = await import('./ring1.mjs');
  const { tileIdsForSquare } = await import('../valdrada/decode.mjs');
  const tiles = [...tileIdsForSquare(), ...RING1_TILES.map((k) => `t_${k}`)];
  const R1S = ring1RectsScene(AFF);
  inRegion = (x, z) => inHomeSquare(x, z) || inRing1Scene(x, z, R1S);
  if (RING !== 'ring1') {
    const { RING2_TILES, ring2RectsScene, inRing2Scene } = await import('./ring2.mjs');
    for (const k of RING2_TILES) tiles.push(`t_${k}`);
    const R2S = ring2RectsScene(AFF);
    const keepR1 = inRegion;
    inRegion = (x, z) => keepR1(x, z) || inRing2Scene(x, z, R2S);
    if (RING === 'ring3' || RING === 'ring4' || RING === 'ring5' || RING === 'ring6' || RING === 'ring7' || RING === 'ring8' || RING === 'ring9' || RING === 'ring10') {
      const { RING3_TILES, ring3RectsScene, inRing3Scene } = await import('./ring3.mjs');
      for (const k of RING3_TILES) tiles.push(`t_${k}`);
      const R3S = ring3RectsScene(AFF);
      const keepR2 = inRegion;
      inRegion = (x, z) => keepR2(x, z) || inRing3Scene(x, z, R3S);
      if (RING === 'ring4' || RING === 'ring5' || RING === 'ring6' || RING === 'ring7' || RING === 'ring8' || RING === 'ring9' || RING === 'ring10') {
        const { RING4_TILES, ring4RectsScene, inRing4Scene } = await import('./ring4.mjs');
        for (const k of RING4_TILES) tiles.push(`t_${k}`);
        const R4S = ring4RectsScene(AFF);
        const keepR3 = inRegion;
        inRegion = (x, z) => keepR3(x, z) || inRing4Scene(x, z, R4S);
        if (RING === 'ring5' || RING === 'ring6' || RING === 'ring7' || RING === 'ring8' || RING === 'ring9' || RING === 'ring10') {
          const { RING5_TILES, ring5RectsScene, inRing5Scene } = await import('./ring5.mjs');
          for (const k of RING5_TILES) tiles.push(`t_${k}`);
          const R5S = ring5RectsScene(AFF);
          const keepR4 = inRegion;
          inRegion = (x, z) => keepR4(x, z) || inRing5Scene(x, z, R5S);
          if (RING === 'ring6' || RING === 'ring7' || RING === 'ring8' || RING === 'ring9' || RING === 'ring10') {
            const { RING6_TILES, ring6RectsScene, inRing6Scene } = await import('./ring6.mjs');
            for (const k of RING6_TILES) tiles.push(`t_${k}`);
            const R6S = ring6RectsScene(AFF);
            const keepR5 = inRegion;
            inRegion = (x, z) => keepR5(x, z) || inRing6Scene(x, z, R6S);
            if (RING === 'ring7' || RING === 'ring8' || RING === 'ring9' || RING === 'ring10') {
              const { RING7_TILES, ring7RectsScene, inRing7Scene } = await import('./ring7.mjs');
              for (const k of RING7_TILES) tiles.push(`t_${k}`);
              const R7S = ring7RectsScene(AFF);
              const keepR6 = inRegion;
              inRegion = (x, z) => keepR6(x, z) || inRing7Scene(x, z, R7S);
              // rings 8-10 (western Queens, the South Bronx, Staten Island's North Shore), each joining the union
              for (const n of [8, 9, 10]) {
                if (+RING.slice(4) < n) break;
                const m = await import(`./ring${n}.mjs`);
                for (const k of m[`RING${n}_TILES`]) tiles.push(`t_${k}`);
                const RS = m[`ring${n}RectsScene`](AFF), inR = m[`inRing${n}Scene`];
                const keep = inRegion;
                inRegion = (x, z) => keep(x, z) || inR(x, z, RS);
              }
            }
          }
        }
      }
    }
  }
  process.env.VD_TILES = [...new Set(tiles)].join(',');
} else if (RING) throw new Error(`unknown --ring ${RING}`);
const keep = (x, z) => inRegion ? inRegion(x, z) : Math.abs(x) <= EXTENT_METERS && Math.abs(z) <= EXTENT_METERS;

const { instancer, roofOf, signalReg } = await assembleCity(log);
// sim/signals.js SignalController: which lit lens or pedestrian head each slot is, and the axis it serves. Code in the
// instance flags (pool-data.ts): bits 1-3 the lamp (1 sigR, 2 sigA, 3 sigG, 4 pedHand, 5 pedMan), bit 4 serves E-W.
const LAMP_CODE = { sigR: 1, sigA: 2, sigG: 3, pedHand: 4, pedMan: 5 };
const signalCode = new Map();   // `${pool}:${slot}` -> flags bits
for (const e of signalReg) {
  if (e.heads) {
    for (const lp of ['sigR', 'sigA', 'sigG']) for (const id of e.ids[lp] || []) if (id >= 0) signalCode.set(`${lp}:${id}`, (LAMP_CODE[lp] << 1) | (e.servesEW ? 16 : 0));
    continue;
  }
  // a pedestrian head (and the pre-SG13 single-head mast): the axis from its own bearing (signals.js L49-L51)
  const ew = Math.abs(Math.sin(e.rot)) > Math.abs(Math.cos(e.rot));
  for (const lp of Object.keys(e.ids)) if (LAMP_CODE[lp] && e.ids[lp] >= 0) signalCode.set(`${lp}:${e.ids[lp]}`, (LAMP_CODE[lp] << 1) | (ew ? 16 : 0));
}
const K = await vd('city/furnitureKit.js');
const { lampKind } = await vd('world/night11.js');

// ---------------------------------------------------------------- which pools this lane bakes
const OTHER_LANES = (n) => /^tree.*(Trunk|Crown)$/.test(n) || ['stoop', 'awning', 'fireEscape3', 'fireEscape4', 'fireEscape5', 'standpipe', 'marquee', 'marqueeGlow', 'roofBillboard'].includes(n);
// instancer.js L433-439: the material each pool draws with
const GLOW_NAMES = new Set(['lampCobraGlow', 'lampCrookGlow', 'signalMastGlow', 'signalPedGlow', 'subwayGlow', 'linknycGlow', 'busShelterGlow', 'marqueeGlow']);
// instancer.js L105-125 (ROOF_LOW) and L127 (NO_SHADOW)
const ROOF_LOW = new Set(['ventPipe', 'gooseneck', 'pipeRun', 'roofAC', 'mushroomFan', 'upblastFan', 'ductRun', 'skylight',
  'roofHatch', 'dunnage', 'sedumTray', 'cableTray', 'solarPanel', 'roofChair', 'roofTable', 'roofPlanter', 'roofUmbrella',
  'cellCabinet', 'cellSled', 'dishCluster', 'roofDish', 'microwaveDrum', 'davit', 'roofPlenum', 'roofPad', 'roofWalk']);
const NO_SHADOW = new Set(['roofPad', 'roofWalk']);

const geos = K.buildFurnitureGeos();
// our buildings, for the roof contact
const tile = JSON.parse(readFileSync(TILE, 'utf8'));
const B = tile.buildings.map((b) => {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < b.p.length; i += 2) { x0 = Math.min(x0, b.p[i]); x1 = Math.max(x1, b.p[i]); z0 = Math.min(z0, b.p[i + 1]); z1 = Math.max(z1, b.p[i + 1]); }
  return { p: b.p, h: b.h, box: [x0, z0, x1, z1] };
});
const BCELL = 32, bgrid = new Map();
for (const b of B) for (let i = Math.floor(b.box[0] / BCELL); i <= Math.floor(b.box[2] / BCELL); i++) for (let j = Math.floor(b.box[1] / BCELL); j <= Math.floor(b.box[3] / BCELL); j++) {
  const k = `${i}_${j}`; if (!bgrid.has(k)) bgrid.set(k, []); bgrid.get(k).push(b);
}
const inRing = (p, x, z) => {
  let inside = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const ourBuildingAt = (x, z) => (bgrid.get(`${Math.floor(x / BCELL)}_${Math.floor(z / BCELL)}`) || []).find((b) => inRing(b.p, x, z)) || null;

// ---------------------------------------------------------------- instances
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const pools = [];
const stats = { roofNoBuilding: 0, outside: 0, dupClaim: 0 };
const lamps = [];
for (const [name, p] of instancer.pools) {
  if (OTHER_LANES(name) || !p.pos || !geos[name]) continue;
  const def = geos[name];
  const rows = [];
  // one compiled record claims once: a tile can carry the same record twice (tile 0_17's sign pole at (410.04,
  // 8925.33) is emitted twice upstream), and the instancer claims it twice — furniture.test.ts's double-claim
  // check. A row identical on every field is the same record; two poles sharing a corner differ somewhere
  // (~0.25 m apart, opposite yaws), so nothing real is dropped.
  const seen = new Set();
  for (let slot = 0; slot < p.top; slot++) {
    if (!p.alive[slot]) continue;
    _m.fromArray(p.mats, slot * 16).decompose(_p, _q, _s);
    { // a yaw about +Y only (only trees lean, instancer.js L593): no Y in the X/Z columns, no X/Z in the Y column
      const e = _m.elements;
      if (Math.abs(e[1]) + Math.abs(e[9]) > 1e-4 * (_s.x + _s.z) || Math.abs(e[4]) + Math.abs(e[6]) > 1e-4 * _s.y) throw new Error(`${name}: a non-yaw rotation`);
    }
    const [x, z] = toScene(_p.x, _p.z);
    if (!keep(x, z)) { stats.outside++; continue; }
    const roof = roofOf.get(`${name}:${slot}`);
    let y, ground;
    if (roof) {
      const ours = ourBuildingAt(x, z);
      if (!ours) { stats.roofNoBuilding++; continue; }   // no nyc-mon roof under it: nothing to stand on
      // height above Valdrada's pavement, re-based from Valdrada's building height to ours
      // the building's base datum: the median ground round its roof ring (assemble.js L2073-2081 asks the pavement
      // round the footprint the same way, padUnderRing), so a setback tower's deck keeps its height over the street
      if (!roof.y0) { const g = roof.ring.map(([rx, rz]) => groundVd(rx, rz)).filter((v) => v !== null).sort((a, b) => a - b); roof.y0 = g[g.length >> 1]; }
      y = (_p.y - roof.y0) + (ours.h - roof.h);
      ground = 0;
    } else {
      // the surface it stands on; a piece far above it (a viaduct pier's cap) keeps its height over that surface too
      y = _p.y - groundVd(_p.x, _p.z);
      ground = 1;
    }
    const yaw = Math.atan2(_m.elements[8], _m.elements[10]);
    // a lit lens is claimed at scale 1 (red) or 0.001 (assemble.js L2926): the signal clock sets it from now on, so the
    // record carries the lamp at full scale and the shader collapses it when its lamp is off
    const sig = signalCode.get(`${name}:${slot}`) ?? 0;
    if (sig) { const k = 1 / Math.max(_s.x, 1e-6); _s.multiplyScalar(k); }
    const row = { x, y, z, yaw, sx: _s.x, sy: _s.y, sz: _s.z, r: p.cols[slot * 3], g: p.cols[slot * 3 + 1], b: p.cols[slot * 3 + 2], ground: ground | sig, vx: _p.x, vy: _p.y, vz: _p.z };
    const dupKey = `${row.x.toFixed(3)}|${row.y.toFixed(3)}|${row.z.toFixed(3)}|${row.yaw.toFixed(4)}|${row.sx.toFixed(3)}|${row.sy.toFixed(3)}|${row.sz.toFixed(3)}|${row.r}|${row.g}|${row.b}|${row.ground}`;
    if (seen.has(dupKey)) { stats.dupClaim++; continue; }
    seen.add(dupKey);
    rows.push(row);
    // city/props.js L296 / L300: the light a pole throws (N11 fixture kind, head height, arm yaw)
    if (name === 'lampCobra' || name === 'lampCrook') {
      const crook = name === 'lampCrook', out = crook ? 1.7 : 3.4;
      const [hx, hz] = toScene(_p.x + Math.sin(yaw) * out, _p.z + Math.cos(yaw) * out);
      lamps.push({ x: hx, y: y + 0.07, z: hz, kind: lampKind(_p.x, _p.z, crook), head: crook ? 5.9 : 8.2, yaw: crook ? null : yaw });
    }
  }
  if (!rows.length) continue;
  const glow = !!def.glow || GLOW_NAMES.has(name);
  const material = def.tex ? (glow ? 'glowTex' : 'tex') : glow ? 'glow' : name === 'signalLens' ? 'lens' : 'base';
  pools.push({ name, def, rows, material, shadow: !glow && !NO_SHADOW.has(name), roofLow: ROOF_LOW.has(name) });
}

// ---------------------------------------------------------------- packing
// instance record, 24 bytes (furniture/pool-data.ts INSTANCE_BYTES): f32 x, f32 y, f32 z, u16 yaw (2pi/65536),
// u16 sx, sy, sz (1/4096, or the pool's coarser scaleQ: scaleQFor), u8 r, g, b (linear, 2/255), u8 flags (bit 0: y is over the ground, add ctx.groundY)
const INSTANCE_BYTES = 24;
const q16 = (v, k) => { const q = Math.round(v * k); if (q < 0 || q > 65535) throw new Error(`u16 overflow ${v}`); return q; };
const q8 = (v) => { const q = Math.round((v / 2) * 255); if (q < 0 || q > 255) throw new Error(`u8 overflow ${v}`); return q; };
// the pool's scale step: 4096 unless a piece is longer than 65535/4096 = 16 units (ring 8: a scaffold run 18.2 m along a
// Long Island City facade), then the largest power of two that still holds its longest scale in a u16
const scaleQFor = (rows) => { const m = rows.reduce((a, r) => Math.max(a, r.sx, r.sy, r.sz), 0); let q = 4096; while (q > 1 && Math.round(m * q) > 65535) q /= 2; return q; };
function packInstances(rows, name = '', SQ = 4096) {
  const buf = Buffer.alloc(rows.length * INSTANCE_BYTES);
  rows.forEach((r, i) => { try {
    const o = i * INSTANCE_BYTES;
    buf.writeFloatLE(r.x, o); buf.writeFloatLE(r.y, o + 4); buf.writeFloatLE(r.z, o + 8);
    buf.writeUInt16LE(q16(((r.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 65536 / (2 * Math.PI)) & 0xffff, o + 12);
    buf.writeUInt16LE(q16(r.sx, SQ), o + 14); buf.writeUInt16LE(q16(r.sy, SQ), o + 16); buf.writeUInt16LE(q16(r.sz, SQ), o + 18);
    buf.writeUInt8(q8(r.r), o + 20); buf.writeUInt8(q8(r.g), o + 21); buf.writeUInt8(q8(r.b), o + 22);
    buf.writeUInt8(r.ground, o + 23);
  } catch (e) { throw new Error(`${name} instance at Valdrada (${r.vx?.toFixed(1)}, ${r.vy?.toFixed(1)}, ${r.vz?.toFixed(1)}) scale (${r.sx}, ${r.sy}, ${r.sz}): ${e.message}`); } });
  return buf;
}
// geometry: f32 position, i8 normal (x127), u16 linear colour (x65535), f32 uv, u32 index
function packGeometry(geo) {
  const g = geo.index ? geo : geo; // indexed or not, as Valdrada built it
  const P = g.getAttribute('position'), N = g.getAttribute('normal'), C = g.getAttribute('color'), U = g.getAttribute('uv');
  const n = P.count;
  const pos = Buffer.alloc(n * 12), nrm = Buffer.alloc(n * 3), col = Buffer.alloc(n * 6), uv = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) {
    pos.writeFloatLE(P.getX(i), i * 12); pos.writeFloatLE(P.getY(i), i * 12 + 4); pos.writeFloatLE(P.getZ(i), i * 12 + 8);
    const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i), l = Math.hypot(nx, ny, nz) || 1;
    nrm.writeInt8(Math.round((nx / l) * 127), i * 3); nrm.writeInt8(Math.round((ny / l) * 127), i * 3 + 1); nrm.writeInt8(Math.round((nz / l) * 127), i * 3 + 2);
    for (let k = 0; k < 3; k++) col.writeUInt16LE(Math.round(Math.min(1, Math.max(0, C ? C.getComponent(i, k) : 1)) * 65535), i * 6 + k * 2);
    uv.writeFloatLE(U ? U.getX(i) : 0, i * 8); uv.writeFloatLE(U ? U.getY(i) : 0, i * 8 + 4);
  }
  let idx;
  if (g.index) { idx = Buffer.alloc(g.index.count * 4); for (let i = 0; i < g.index.count; i++) idx.writeUInt32LE(g.index.getX(i), i * 4); }
  else { idx = Buffer.alloc(n * 4); for (let i = 0; i < n; i++) idx.writeUInt32LE(i, i * 4); }
  g.computeBoundingSphere();
  const bs = g.boundingSphere;
  return { n, pos, nrm, col, uv, idx, tris: idx.length / 12, radius: bs.center.length() + bs.radius };
}

// ---------------------------------------------------------------- panel atlas (city/panelArt.js)
const { panelTexture } = await vd('city/panelArt.js');
const ptex = panelTexture();
const cv = ptex.image;
const W = cv.width, H = cv.height;
const rgba = cv.getContext('2d').getImageData(0, 0, W, H).data;
// rows bottom-up: the CanvasTexture uploads with flipY, a DataTexture cannot, so the bake flips
const flipped = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) Buffer.from(rgba.buffer, rgba.byteOffset + (H - 1 - y) * W * 4, W * 4).copy(flipped, y * W * 4);
// run-length encode identical RGBA texels: [u16 run][u8 r g b a], runs <= 65535 (the atlas is flat colour panels)
const rle = [];
for (let i = 0; i < W * H;) {
  let j = i + 1;
  while (j < W * H && j - i < 65535 && flipped.readUInt32LE(j * 4) === flipped.readUInt32LE(i * 4)) j++;
  const b = Buffer.alloc(6); b.writeUInt16LE(j - i, 0); flipped.copy(b, 2, i * 4, i * 4 + 4); rle.push(b);
  i = j;
}
const atlasRle = Buffer.concat(rle);

// ---------------------------------------------------------------- write
mkdirSync(OUT, { recursive: true });
const header = (what) => `// GENERATED by tooling/city/vd-port/bake-furniture.mjs — do not edit. ${what}
// Valdrada v0.4.0 (2724c79, MIT: tooling/city/valdrada/LICENSE.valdrada); placements from Valdrada's tiles (ODbL 1.0,
// © OpenStreetMap contributors and NYC Open Data, see Valdrada LICENSING.md).
`;
// Every pool draws through the panel atlas, as instancer.js's panel pools do (panelArt.js blankUV: a triangle that is
// not a panel has its uv parked on the atlas's white block, where map * vertexColor is the vertex colour): a pool
// without a panel gets blankUV on its whole geometry, so the plain and the panel materials of one lighting model are one
// shader (materials.ts) and differ only in their uniforms.
const { blankUV } = await vd('city/panelArt.js');
const uvFor = (p, geo) => (p.def.tex ? geo : blankUV(geo.clone()));
// Everything bulky goes into one Metro asset, assets/pools.bin (the JS bundle carries only the offsets): pool geometry,
// the subway's coarse level and every pool's instances, each block 4-byte aligned.
const blob = [];
let blobLen = 0;
const put = (buf) => { const at = blobLen; const padded = buf.length % 4 ? Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4))]) : buf; blob.push(padded); blobLen += padded.length; return [at, buf.length]; };
const geoRef = (g) => `{ vertices: ${g.n}, triangles: ${g.tris}, radius: ${g.radius.toFixed(3)}, position: [${put(g.pos)}], normal: [${put(g.nrm)}], color: [${put(g.col)}], uv: [${put(g.uv)}], index: [${put(g.idx)}] }`;
const geoRows = pools.map((p) => `  ${JSON.stringify(p.name)}: ${geoRef(packGeometry(uvFor(p, p.def.geo)))},`);
// the subway pool ships its own coarse level (furnitureKit G.subway.lod, instancer.js L451 setLOD)
const lodRows = pools.filter((p) => p.def.lod && p.def.lod.geo).map((p) => `  ${JSON.stringify(p.name)}: { distance: ${p.def.lod.dist ?? 120}, geometry: ${geoRef(packGeometry(uvFor(p, p.def.lod.geo)))} },`);
const poolRows = pools.map((p) => `  { name: ${JSON.stringify(p.name)}, material: '${p.material}', shadow: ${p.shadow}, roofLow: ${p.roofLow}, count: ${p.rows.length}, data: [${put(packInstances(p.rows, p.name, scaleQFor(p.rows)))}]${scaleQFor(p.rows) !== 4096 ? `, scaleQ: ${scaleQFor(p.rows)}` : ''} },`);
const ASSETS = join(OUT, '../assets');
mkdirSync(ASSETS, { recursive: true });
writeFileSync(join(ASSETS, 'pools.bin'), Buffer.concat(blob));
writeFileSync(join(ASSETS, 'panel-atlas.bin'), atlasRle);
writeFileSync(join(OUT, 'pools.ts'), `${header('The pools: offsets into assets/pools.bin (city/furnitureKit.js geometry, Valdrada Instancer slots).')}
import type { PackedGeometry, PackedPool } from '../pool-data.ts';

export const VD_POOL_GEOMETRY: Readonly<Record<string, PackedGeometry>> = {
${geoRows.join('\n')}
};

export const VD_POOL_LOD: Readonly<Record<string, { distance: number; geometry: PackedGeometry }>> = {
${lodRows.join('\n')}
};

export const VD_POOLS: readonly PackedPool[] = [
${poolRows.join('\n')}
];

/** assets/pools.bin's size, and assets/panel-atlas.bin's (city/panelArt.js, rows bottom-up, RLE [u16 run][rgba]). */
export const VD_POOLS_BYTES = ${blobLen};
export const VD_PANEL_ATLAS = { width: ${W}, height: ${H}, bytes: ${atlasRle.length} } as const;
`);
for (const f of ['geometry.ts', 'instances.ts', 'panel-atlas.ts']) rmSync(join(OUT, f), { force: true });
writeFileSync(join(OUT, 'lamps.ts'), `${header('Lamp light spots: city/props.js L296/L300 over the claimed poles; kinds index world/night11.js FIXTURES.')}
import { decodeLampSpots } from '../lamp-codec.ts';

/** [x, y over ground, z, fixture kind (night11 FIXTURES; -1 legacy), mounting height m, arm yaw or NaN for a round throw] per lamp,
 * packed 16 bytes a lamp (lamp-codec.ts; tooling/city/vd-port/lamp-pack.mjs). */
export const VD_LAMP_SPOTS: readonly number[] = decodeLampSpots(${JSON.stringify(packLampSpots(lamps))});
`);
// placement fixture for the tests: Valdrada world point -> the instance it became, a sample per pool
const fixture = {};
for (const p of pools) fixture[p.name] = p.rows.filter((_, i) => i % Math.max(1, Math.floor(p.rows.length / 12)) === 0).slice(0, 12).map((r) => [r.vx, r.vz, r.x, r.z]);
writeFileSync(join(OUT, 'placement-fixture.ts'), `${header('Test fixture: [valdradaX, valdradaZ, sceneX, sceneZ] samples per pool.')}
export const VD_PLACEMENT_SAMPLES: Readonly<Record<string, readonly (readonly number[])[]>> = ${JSON.stringify(fixture)};
`);

const total = pools.reduce((s, p) => s + p.rows.length, 0);
const hash = createHash('sha256');
for (const p of pools) hash.update(p.name).update(packInstances(p.rows, p.name, scaleQFor(p.rows)));
console.log(JSON.stringify({
  pools: pools.length, instances: total, lamps: lamps.length, ...stats, atlas: `${W}x${H} rle ${atlasRle.length} B`,
  hash: hash.digest('hex').slice(0, 16),
  byMaterial: pools.reduce((a, p) => ((a[p.material] = (a[p.material] || 0) + p.rows.length), a), {}),
  perPool: Object.fromEntries(pools.map((p) => [p.name, p.rows.length])),
}, null, 1));
process.exit(0);
