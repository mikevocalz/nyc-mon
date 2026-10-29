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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { REPO, THREE, vd } from './valdrada-runtime.mjs';
import { assembleCity } from './assemble-city.mjs';
import { ORIGIN, EXTENT_METERS, parseTile, tileIdsForSquare, unproject } from '../valdrada/decode.mjs';
import { tileBytes } from './valdrada-runtime.mjs';

const OUT = join(REPO, 'packages/app/features/game/world/vd-port/furniture/data');
const TILE = join(REPO, 'packages/app/features/game/data/harlem-apollo.json');

// vd-port/transform.ts valdradaToSceneAffine, for the dataset origin
const DEG = Math.PI / 180, R_M = 6_371_008.8;
const LAT0 = 40.7831, LON0 = -73.9712, M_LAT = 111132.0, M_LON = 111320.0 * Math.cos((LAT0 * Math.PI) / 180);
const kx = DEG * R_M * Math.cos(ORIGIN.latitude * DEG), kz = DEG * R_M;
const AFF = { sx: kx / M_LON, ox: (LON0 - ORIGIN.longitude) * kx, sz: kz / M_LAT, oz: -(LAT0 - ORIGIN.latitude) * kz };
const toScene = (x, z) => [x * AFF.sx + AFF.ox, z * AFF.sz + AFF.oz];
{ // the affine agrees with decode.mjs's unproject + projectToScene
  const [lon, lat] = unproject(1500, -3000);
  const ex = (lon - ORIGIN.longitude) * kx, ez = -(lat - ORIGIN.latitude) * kz;
  const [ax, az] = toScene(1500, -3000);
  if (Math.hypot(ax - ex, az - ez) > 1e-6) throw new Error('affine transform drifted from decode.mjs');
}

// The ground under a point, in Valdrada's datum: world/assemble.js L1707-1805 (surfHash, sectionY, surfY, padYAt,
// padYNear) over the tile's own compiled sections, as that file asks it. Most of the square is Valdrada's flat stack
// (pavement 3.520, roadway 3.385); Morningside and the Manhattan Valley slope are not, so every piece is measured.
const TILES = new Map(tileIdsForSquare().map((id) => { const t = parseTile(tileBytes(id)); return [`${t.header.tx}_${t.header.tz}`, t]; }));
const SURF = new Map(), surfCell = 4;
function surfHash(t, name) {
  const key = `${t.header.tx}_${t.header.tz}:${name}`;
  if (SURF.has(key)) return SURF.get(key);
  const a = t.S[name], [ox, oz] = t.header.origin;
  let rec = null;
  if (a && a.length >= 9) {
    const H = new Map();
    for (let tr = 0, n = Math.floor(a.length / 9); tr < n; tr++) {
      const o = tr * 9;
      const x0 = a[o] + ox, z0 = a[o + 2] + oz, x1 = a[o + 3] + ox, z1 = a[o + 5] + oz, x2 = a[o + 6] + ox, z2 = a[o + 8] + oz;
      const i0 = Math.floor(Math.min(x0, x1, x2) / surfCell), i1 = Math.floor(Math.max(x0, x1, x2) / surfCell);
      const j0 = Math.floor(Math.min(z0, z1, z2) / surfCell), j1 = Math.floor(Math.max(z0, z1, z2) / surfCell);
      if ((i1 - i0) > 64 || (j1 - j0) > 64) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = i + '_' + j; let arr = H.get(k); if (!arr) H.set(k, (arr = [])); arr.push(tr); }
    }
    rec = { a, H, ox, oz };
  }
  SURF.set(key, rec);
  return rec;
}
function sectionY0(t, name, x, z, tol) {
  const rec = surfHash(t, name);
  if (!rec) return null;
  const { a, H, ox, oz } = rec;
  const list = H.get(Math.floor(x / surfCell) + '_' + Math.floor(z / surfCell));
  if (!list) return null;
  let bestY = null, bestD = 1e9;
  for (const tr of list) {
    const o = tr * 9;
    const x0 = a[o] + ox, y0 = a[o + 1], z0 = a[o + 2] + oz, x1 = a[o + 3] + ox, y1 = a[o + 4], z1 = a[o + 5] + oz, x2 = a[o + 6] + ox, y2 = a[o + 7], z2 = a[o + 8] + oz;
    const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
    if (Math.abs(d) < 1e-9) continue;
    const l0 = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d, l1 = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d, l2 = 1 - l0 - l1;
    let out = 0;
    if (l0 < 0) out = Math.max(out, -l0 * Math.abs(d) / Math.hypot(x1 - x2, z1 - z2));
    if (l1 < 0) out = Math.max(out, -l1 * Math.abs(d) / Math.hypot(x2 - x0, z2 - z0));
    if (l2 < 0) out = Math.max(out, -l2 * Math.abs(d) / Math.hypot(x0 - x1, z0 - z1));
    if (out < bestD) {
      bestD = out; bestY = l0 * y0 + l1 * y1 + l2 * y2;
      if (out > 0) bestY = Math.min(Math.max(y0, y1, y2), Math.max(Math.min(y0, y1, y2), bestY));
    }
    if (bestD === 0) break;
  }
  return bestD <= tol ? bestY : null;
}
const sectionY = (t, name, x, z, tol) => { const y = sectionY0(t, name, x, z, tol); return y === null && name === 'grass' ? sectionY0(t, 'grassU', x, z, tol) : y; };
const WALK_KINDS = ['sidewalk', 'path', 'brick', 'plaza', 'gravel'], ROAD_KINDS = ['gutter', 'busred', 'asphalt'];
const surfY = (t, x, z, kinds, tol) => { for (const k of kinds) { const y = sectionY(t, k, x, z, tol); if (y !== null) return y; } return null; };
const padYAt = (t, x, z, tol = 0.35) => surfY(t, x, z, WALK_KINDS, tol) ?? sectionY(t, 'grass', x, z, tol) ?? surfY(t, x, z, ROAD_KINDS, tol);
const RING8 = [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]];
function sampleT(t, x, z) {
  const res = t.header.res, n = res + 1, G = t.S.terrain, [ox, oz] = t.header.origin;
  const fx = Math.min(res - 0.001, Math.max(0, ((x - ox) / 512) * res)), fz = Math.min(res - 0.001, Math.max(0, ((z - oz) / 512) * res));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return G[j * n + i] * (1 - u) * (1 - v) + G[j * n + i + 1] * u * (1 - v) + G[(j + 1) * n + i] * (1 - u) * v + G[(j + 1) * n + i + 1] * u * v;
}
/** padYNear (assemble.js L1797) in the tile that holds (x, z), Valdrada world metres. */
function groundVd(x, z) {
  const t = TILES.get(`${Math.floor(x / 512)}_${Math.floor(z / 512)}`);
  if (!t) return null;
  const at = padYAt(t, x, z); if (at !== null) return at;
  let best = null;
  for (const [dx, dz] of RING8) { const y = padYAt(t, x + dx, z + dz); if (y !== null && (best === null || y > best)) best = y; }
  return best !== null ? best : sampleT(t, x, z) + 0.28;
}

const log = (s) => process.stderr.write(s + '\n');
const { instancer, roofOf } = await assembleCity(log);
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
const stats = { roofNoBuilding: 0, outside: 0 };
const lamps = [];
for (const [name, p] of instancer.pools) {
  if (OTHER_LANES(name) || !p.pos || !geos[name]) continue;
  const def = geos[name];
  const rows = [];
  for (let slot = 0; slot < p.top; slot++) {
    if (!p.alive[slot]) continue;
    _m.fromArray(p.mats, slot * 16).decompose(_p, _q, _s);
    { // a yaw about +Y only (only trees lean, instancer.js L593): no Y in the X/Z columns, no X/Z in the Y column
      const e = _m.elements;
      if (Math.abs(e[1]) + Math.abs(e[9]) > 1e-4 * (_s.x + _s.z) || Math.abs(e[4]) + Math.abs(e[6]) > 1e-4 * _s.y) throw new Error(`${name}: a non-yaw rotation`);
    }
    const [x, z] = toScene(_p.x, _p.z);
    if (Math.abs(x) > EXTENT_METERS || Math.abs(z) > EXTENT_METERS) { stats.outside++; continue; }
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
    rows.push({ x, y, z, yaw, sx: _s.x, sy: _s.y, sz: _s.z, r: p.cols[slot * 3], g: p.cols[slot * 3 + 1], b: p.cols[slot * 3 + 2], ground, vx: _p.x, vy: _p.y, vz: _p.z });
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
// u16 sx, sy, sz (1/4096), u8 r, g, b (linear, 2/255), u8 flags (bit 0: y is over the ground, add ctx.groundY)
const INSTANCE_BYTES = 24;
const q16 = (v, k) => { const q = Math.round(v * k); if (q < 0 || q > 65535) throw new Error(`u16 overflow ${v}`); return q; };
const q8 = (v) => { const q = Math.round((v / 2) * 255); if (q < 0 || q > 255) throw new Error(`u8 overflow ${v}`); return q; };
function packInstances(rows) {
  const buf = Buffer.alloc(rows.length * INSTANCE_BYTES);
  rows.forEach((r, i) => {
    const o = i * INSTANCE_BYTES;
    buf.writeFloatLE(r.x, o); buf.writeFloatLE(r.y, o + 4); buf.writeFloatLE(r.z, o + 8);
    buf.writeUInt16LE(q16(((r.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 65536 / (2 * Math.PI)) & 0xffff, o + 12);
    buf.writeUInt16LE(q16(r.sx, 4096), o + 14); buf.writeUInt16LE(q16(r.sy, 4096), o + 16); buf.writeUInt16LE(q16(r.sz, 4096), o + 18);
    buf.writeUInt8(q8(r.r), o + 20); buf.writeUInt8(q8(r.g), o + 21); buf.writeUInt8(q8(r.b), o + 22);
    buf.writeUInt8(r.ground, o + 23);
  });
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
const b64 = (b) => b.toString('base64');
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
const geoRows = pools.map((p) => {
  const g = packGeometry(uvFor(p, p.def.geo));
  return `  ${JSON.stringify(p.name)}: { vertices: ${g.n}, triangles: ${g.tris}, radius: ${g.radius.toFixed(3)}, position: '${b64(g.pos)}', normal: '${b64(g.nrm)}', color: '${b64(g.col)}', uv: '${b64(g.uv)}', index: '${b64(g.idx)}' },`;
});
// the subway pool ships its own coarse level (furnitureKit G.subway.lod, instancer.js L451 setLOD)
const lodRows = pools.filter((p) => p.def.lod && p.def.lod.geo).map((p) => {
  const g = packGeometry(uvFor(p, p.def.lod.geo));
  return `  ${JSON.stringify(p.name)}: { distance: ${p.def.lod.dist ?? 120}, geometry: { vertices: ${g.n}, triangles: ${g.tris}, radius: ${g.radius.toFixed(3)}, position: '${b64(g.pos)}', normal: '${b64(g.nrm)}', color: '${b64(g.col)}', uv: '${b64(g.uv)}', index: '${b64(g.idx)}' } },`;
});
writeFileSync(join(OUT, 'geometry.ts'), `${header('Pool geometry: city/furnitureKit.js buildFurnitureGeos().')}
import type { PackedGeometry } from '../pool-data.ts';

export const VD_POOL_GEOMETRY: Readonly<Record<string, PackedGeometry>> = {
${geoRows.join('\n')}
};

export const VD_POOL_LOD: Readonly<Record<string, { distance: number; geometry: PackedGeometry }>> = {
${lodRows.join('\n')}
};
`);
const poolRows = pools.map((p) => `  { name: ${JSON.stringify(p.name)}, material: '${p.material}', shadow: ${p.shadow}, roofLow: ${p.roofLow}, count: ${p.rows.length}, data: '${b64(packInstances(p.rows))}' },`);
writeFileSync(join(OUT, 'instances.ts'), `${header('Instances: Valdrada Instancer slots after assembleTile over the square.')}
import type { PackedPool } from '../pool-data.ts';

export const VD_POOLS: readonly PackedPool[] = [
${poolRows.join('\n')}
];
`);
writeFileSync(join(OUT, 'lamps.ts'), `${header('Lamp light spots: city/props.js L296/L300 over the claimed poles; kinds index world/night11.js FIXTURES.')}
/** [x, y over ground, z, fixture kind (night11 FIXTURES; -1 legacy), mounting height m, arm yaw or NaN for a round throw] per lamp. */
export const VD_LAMP_SPOTS: readonly number[] = ${JSON.stringify(lamps.flatMap((l) => [+l.x.toFixed(3), +l.y.toFixed(3), +l.z.toFixed(3), l.kind, l.head, l.yaw === null ? null : +l.yaw.toFixed(4)])).replace(/null/g, 'NaN')};
`);
writeFileSync(join(OUT, 'panel-atlas.ts'), `${header('city/panelArt.js, painted by its own canvas code; rows bottom-up (flipY baked); RLE [u16 run][rgba].')}
export const VD_PANEL_ATLAS = { width: ${W}, height: ${H}, rle: '${b64(atlasRle)}' } as const;
`);
// placement fixture for the tests: Valdrada world point -> the instance it became, a sample per pool
const fixture = {};
for (const p of pools) fixture[p.name] = p.rows.filter((_, i) => i % Math.max(1, Math.floor(p.rows.length / 12)) === 0).slice(0, 12).map((r) => [r.vx, r.vz, r.x, r.z]);
writeFileSync(join(OUT, 'placement-fixture.ts'), `${header('Test fixture: [valdradaX, valdradaZ, sceneX, sceneZ] samples per pool.')}
export const VD_PLACEMENT_SAMPLES: Readonly<Record<string, readonly (readonly number[])[]>> = ${JSON.stringify(fixture)};
`);

const total = pools.reduce((s, p) => s + p.rows.length, 0);
const hash = createHash('sha256');
for (const p of pools) hash.update(p.name).update(packInstances(p.rows));
console.log(JSON.stringify({
  pools: pools.length, instances: total, lamps: lamps.length, ...stats, atlas: `${W}x${H} rle ${atlasRle.length} B`,
  hash: hash.digest('hex').slice(0, 16),
  byMaterial: pools.reduce((a, p) => ((a[p.material] = (a[p.material] || 0) + p.rows.length), a), {}),
  perPool: Object.fromEntries(pools.map((p) => [p.name, p.rows.length])),
}, null, 1));
process.exit(0);
