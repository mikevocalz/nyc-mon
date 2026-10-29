// Bakes Valdrada's street cars into packages/app/features/game/world/vd-cars.ts
// for the vd lane, as plain arrays: react-native-webgpu has no image decoder
// and nyc-mon has no GLB path, so the geometry and the colour of every
// textured vertex ship as data (same reason as bake-trees.mjs).
//
// Source: Valdrada v0.4.0 Content/models/fleet24 on Hugging Face
// (mehmetkeremturkcan/valdrada, revision v0.4.0). The CARLA bodies (lincoln,
// suv, van, mercedes, charger) are CC BY 4.0, CARLA Simulator (carla.org);
// taxinv200 is CC BY 4.0, memoov ("Dhl delivery van", Sketchfab), re-built
// as a TLC cab by Valdrada. Valdrada's code is MIT
// (tooling/city/valdrada/LICENSE.valdrada).
//
// Each GLB holds a root node (extras: kind, size, hubs, lights, wheelbase)
// and LOD0/LOD1/LOD2 children whose translation + uniform scale dequantise
// KHR_mesh_quantization int16 positions. Buffer views are
// EXT_meshopt_compression; textures are KTX2 (KHR_texture_basisu, UASTC).
// Frame: +Z forward, +Y up, origin at the ground centre, left at +X.
//
// The bake takes LOD2 (3.3k-5k triangles a car) and:
//   1. decodes the meshopt views (meshoptimizer, a transitive dependency in
//      node_modules/.pnpm) and dequantises with the LOD node transform;
//   2. transcodes each detail atlas with three's basis_transcoder.wasm to
//      RGBA at the mip near 256 px, and samples it at every vertex UV, so the
//      tyre, chrome, grille and plate colours become vertex colours (sRGB);
//   3. tags each vertex with a lofted-car CAR_PARTS id: paint -> BODY with the
//      paint bit (the instance colour replaces it), glass -> WINDOW, detail on
//      a wheel (_WHEEL > 0) -> TYRE or ALLOY by texel brightness, the
//      untextured MI_Emissive_Parked lamp faces and the lamp class -> FRONT or
//      REAR by which end they sit on (a lamp on the roof -> SIGN), other
//      detail -> TRIM. Lens shells (transparent, a few triangles) are dropped;
//   4. quantises: int16 position in a per-car box, int8 normal, rgb8 colour,
//      u8 part (bit 7 = paint), u16 index;
//   5. decimates two cheaper index lists over the same vertices with
//      meshoptimizer's simplifier, so distance LOD draws the same body:
//      `mid` (about a sixth of LOD2) and `far` (about a twentieth); see the
//      LOD block below for how the body and the wheels decimate.
//
// The bus is mtaxd40, Valdrada's New Flyer Xcelsior XD40 in the 2016+ MTA
// livery (client/tools/ar34/vehicles/bus40/build_bus40.mjs, built from
// published dimensions; Valdrada code MIT). Its livery is a textured paint,
// so it keeps the baked colours; its destination sign stays trim (the SIGN
// part burns the taxi sign colour).
//
// Fetch first, then run:
//   B=https://huggingface.co/datasets/mehmetkeremturkcan/valdrada/resolve/v0.4.0/Content/models/fleet24
//   mkdir -p tooling/city/.cache/vd-cars
//   for f in lincoln suv van taxinv200 mercedes charger mtaxd40; do
//     curl -sSL -o tooling/city/.cache/vd-cars/$f.glb $B/$f.glb; done
//   node tooling/city/bake-cars.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = join(ROOT, '../..');
const SRC = join(ROOT, '.cache/vd-cars');
const OUT = join(REPO, 'packages/app/features/game/world/vd-cars.ts');
const CARS = ['lincoln', 'suv', 'van', 'taxinv200', 'mercedes', 'charger', 'mtaxd40'];
/** Distance LODs as a share of LOD2's triangles (the wheels keep twice that share). */
const LODS = [['mid', 1 / 6], ['far', 1 / 20]];
/** Atlas mip to sample: the first level at or under this width, so a vertex reads an area average, not one texel. */
const SAMPLE_WIDTH = 256;
const PART = { BODY: 0, WINDOW: 1, TYRE: 2, ALLOY: 3, TRIM: 4, MIRROR: 5, SIGN: 6, FRONT: 7, REAR: 8 };
const PAINT_BIT = 0x80;

const pnpm = join(REPO, 'node_modules/.pnpm');
const meshoptDir = readdirSync(pnpm).find((d) => d.startsWith('meshoptimizer@'));
if (!meshoptDir) throw new Error('meshoptimizer not found under node_modules/.pnpm');
const { MeshoptDecoder } = await import(pathToFileURL(join(pnpm, meshoptDir, 'node_modules/meshoptimizer/meshopt_decoder.mjs')).href);
await MeshoptDecoder.ready;
const { MeshoptSimplifier } = await import(pathToFileURL(join(pnpm, meshoptDir, 'node_modules/meshoptimizer/meshopt_simplifier.js')).href);
await MeshoptSimplifier.ready;

// three ships the transcoder as a UMD script inside a "type": "module" package, so evaluate it as CommonJS by hand.
const basisDir = join(REPO, 'packages/app/node_modules/three/examples/jsm/libs/basis');
const basisModule = { exports: {} };
vm.runInThisContext(`(function (module, exports, require, __filename, __dirname) {${readFileSync(join(basisDir, 'basis_transcoder.js'), 'utf8')}\n})`)(
  basisModule, basisModule.exports, createRequire(import.meta.url), join(basisDir, 'basis_transcoder.js'), basisDir,
);
const BASIS = await basisModule.exports({ wasmBinary: readFileSync(join(basisDir, 'basis_transcoder.wasm')) });
BASIS.initializeBasis();
const RGBA32 = 13;

const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function openGlb(file) {
  const b = readFileSync(file);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString());
  const binOff = 20 + jl + 8;
  const bin = b.subarray(binOff, binOff + b.readUInt32LE(20 + jl));
  const views = new Map();
  const view = (i) => {
    if (views.has(i)) return views.get(i);
    const bv = j.bufferViews[i];
    const ext = bv.extensions?.EXT_meshopt_compression;
    let v;
    if (ext) {
      const u8 = new Uint8Array(ext.count * ext.byteStride);
      const off = ext.byteOffset || 0;
      MeshoptDecoder.decodeGltfBuffer(u8, ext.count, ext.byteStride, bin.subarray(off, off + ext.byteLength), ext.mode, ext.filter || 'NONE');
      v = { u8, stride: ext.byteStride };
    } else {
      v = { u8: bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), stride: bv.byteStride };
    }
    views.set(i, v);
    return v;
  };
  const read = (ai) => {
    const a = j.accessors[ai];
    const v = view(a.bufferView);
    const n = NC[a.type];
    const size = CT[a.componentType].BYTES_PER_ELEMENT;
    const stride = v.stride || n * size;
    const dv = new DataView(v.u8.buffer, v.u8.byteOffset + (a.byteOffset || 0));
    const out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) {
      const o = i * stride + c * size;
      let x;
      switch (a.componentType) {
        case 5126: x = dv.getFloat32(o, true); break;
        case 5122: x = dv.getInt16(o, true); break;
        case 5123: x = dv.getUint16(o, true); break;
        case 5121: x = dv.getUint8(o); break;
        case 5120: x = dv.getInt8(o); break;
        default: x = dv.getUint32(o, true);
      }
      if (a.normalized) x = Math.max(x / NORM[a.componentType], -1);
      out[i * n + c] = x;
    }
    return out;
  };
  const image = (texIndex) => {
    const tex = j.textures[texIndex];
    const src = tex.extensions?.KHR_texture_basisu?.source ?? tex.source;
    const bv = j.bufferViews[j.images[src].bufferView];
    return new Uint8Array(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength));
  };
  return { j, read, image };
}

const atlasCache = new Map();
function atlas(glb, key, texIndex) {
  const k = `${key}:${texIndex}`;
  if (atlasCache.has(k)) return atlasCache.get(k);
  const file = new BASIS.KTX2File(glb.image(texIndex));
  if (!file.isValid()) throw new Error(`${k}: invalid KTX2`);
  let level = 0;
  while (level + 1 < file.getLevels() && Math.max(1, file.getWidth() >> level) > SAMPLE_WIDTH) level++;
  if (!file.startTranscoding()) throw new Error(`${k}: startTranscoding failed`);
  const info = file.getImageLevelInfo(level, 0, 0);
  const width = info.origWidth; const height = info.origHeight;
  const data = new Uint8Array(file.getImageTranscodedSizeInBytes(level, 0, 0, RGBA32));
  if (!file.transcodeImage(data, level, 0, 0, RGBA32, 0, -1, -1)) throw new Error(`${k}: transcode failed`);
  file.close();
  file.delete();
  const out = { width, height, data };
  atlasCache.set(k, out);
  return out;
}

/** Bilinear, repeat-wrapped sample of an sRGB atlas at glTF UV (v down), 0..255 per channel. */
function sample(a, u, v) {
  const fx = (u - Math.floor(u)) * a.width - 0.5;
  const fy = (v - Math.floor(v)) * a.height - 0.5;
  const x0 = Math.floor(fx); const y0 = Math.floor(fy);
  const tx = fx - x0; const ty = fy - y0;
  const at = (x, y, c) => a.data[((((y % a.height) + a.height) % a.height) * a.width + (((x % a.width) + a.width) % a.width)) * 4 + c];
  return [0, 1, 2].map((c) => (at(x0, y0, c) * (1 - tx) + at(x0 + 1, y0, c) * tx) * (1 - ty) + (at(x0, y0 + 1, c) * (1 - tx) + at(x0 + 1, y0 + 1, c) * tx) * ty);
}

const toSrgb8 = (linear) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, linear)), 1 / 2.2));
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

/**
 * The cab's LOD2 decimated its tyres away: the wheels shrink to a 0.17 m rim disc and the body floats 13 cm. Where a
 * hub's wheel vertices reach less than 80 % of the hub radius, push them out radially to the hub radius and paint the
 * outer third as tyre rubber, so the car stands on its wheels again.
 */
function regrowWheels(P, C, R, hubs, wheelOf, counts) {
  hubs.forEach((h, k) => {
    // The 95th percentile, so one stray arch-liner vertex inside the cylinder does not hide a shrunken wheel.
    const radii = [];
    for (let v = 0; v < wheelOf.length; v++) if (wheelOf[v] === k) radii.push(Math.hypot(P[v * 3 + 1] - h.p[1], P[v * 3 + 2] - h.p[2]));
    radii.sort((a, b) => a - b);
    const reach = radii[Math.floor(radii.length * 0.95)] ?? 0;
    if (reach === 0 || reach >= h.r * 0.8) return;
    const grow = h.r / reach;
    counts.regrown = (counts.regrown ?? 0) + 1;
    for (let v = 0; v < wheelOf.length; v++) {
      if (wheelOf[v] !== k) continue;
      const dy = P[v * 3 + 1] - h.p[1]; const dz = P[v * 3 + 2] - h.p[2];
      const d = Math.hypot(dy, dz);
      const scale = d > 0 ? Math.min(grow, h.r / d) : 1; // the stragglers past the percentile stop at the tread
      P[v * 3 + 1] = h.p[1] + dy * scale; P[v * 3 + 2] = h.p[2] + dz * scale;
      if (d * scale > h.r * 0.66) { R[v] = PART.TYRE; C.splice(v * 3, 3, 24, 24, 26); } else R[v] = PART.ALLOY;
    }
  });
}

/**
 * LOD2 of several CARLA bodies has no lamp faces (suv, mercedes) or only one end of them (the cab, the van). For an
 * end with no FRONT/REAR vertex, the outward-facing trim at lamp height near that end becomes the lamp: red texels
 * at the rear, bright ones at the front, and, when the atlas shows neither, the outboard trim in the lamp band.
 */
function deriveLamps(P, N, C, R, size, counts) {
  const [W, H, L] = size;
  const nv = P.length / 3;
  let minZ = Infinity; let maxZ = -Infinity;
  for (let v = 0; v < nv; v++) { minZ = Math.min(minZ, P[v * 3 + 2]); maxZ = Math.max(maxZ, P[v * 3 + 2]); }
  const has = (id) => R.some((p) => (p & 0x7f) === id);
  const end = (front) => (v) => {
    if (R[v] !== PART.TRIM) return false;
    const x = P[v * 3]; const y = P[v * 3 + 1]; const z = P[v * 3 + 2]; const nz = N[v * 3 + 2];
    const band = front ? [0.25 * H, 0.52 * H] : [0.3 * H, 0.62 * H];
    const reach = front ? maxZ - z : z - minZ;
    return reach < Math.min(0.25, L * 0.05) && y > band[0] && y < band[1] && Math.abs(x) > 0.22 * W && (front ? nz > 0.25 : nz < -0.25);
  };
  const tag = (test, id, rgb) => {
    let n = 0;
    for (let v = 0; v < nv; v++) if (test(v)) { R[v] = id; if (rgb) C.splice(v * 3, 3, ...rgb); n++; }
    counts.lamp += n;
    return n;
  };
  if (!has(PART.REAR)) {
    const atEnd = end(false);
    const red = (v) => atEnd(v) && C[v * 3] > 60 && C[v * 3] > 1.6 * C[v * 3 + 1];
    if (tag(red, PART.REAR, null) === 0) tag(atEnd, PART.REAR, [150, 22, 18]);
  }
  if (!has(PART.FRONT)) {
    const atEnd = end(true);
    const bright = (v) => atEnd(v) && Math.min(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]) > 150;
    if (tag(bright, PART.FRONT, null) === 0) tag(atEnd, PART.FRONT, [220, 222, 216]);
  }
}

const cars = [];
for (const id of CARS) {
  const glb = openGlb(join(SRC, `${id}.glb`));
  const { j } = glb;
  const root = j.nodes.find((n) => n.extras?.hubs);
  const lod = j.nodes.find((n) => n.name === 'LOD2');
  if (!root || !lod || lod.rotation) throw new Error(`${id}: expected a root with extras and an unrotated LOD2 node`);
  const t = lod.translation ?? [0, 0, 0];
  const s = lod.scale ?? [1, 1, 1];
  const size = root.extras.size;
  const halfLength = size[2] / 2;
  const roof = root.extras.roof ?? size[1];
  // Wheels by the root's hub records (_WHEEL marks more than the wheels on some bakes): the radial distance in the
  // wheel plane over the hub radius, or null when the vertex is not on a wheel. Inside two thirds is the rim.
  const hubs = root.extras.hubs;
  const wheelOf = [];
  const nearHub = (x, y, z) => {
    for (let k = 0; k < hubs.length; k++) {
      const h = hubs[k];
      const d = Math.hypot(y - h.p[1], z - h.p[2]) / h.r;
      if (d < 1.06 && Math.abs(x - h.p[0]) < h.w * 0.75 + 0.06) { wheelOf[P.length / 3 - 1] = k; return d; }
    }
    return null;
  };
  const P = []; const N = []; const C = []; const R = []; const I = [];
  const counts = { paint: 0, glass: 0, wheel: 0, lamp: 0, trim: 0, dropped: 0 };
  for (const prim of j.meshes[lod.mesh].primitives) {
    const mat = j.materials[prim.material];
    const cls = mat.extras?.cls;
    if (cls === 'lens') { counts.dropped += j.accessors[prim.indices].count / 3; continue; }
    const pos = glb.read(prim.attributes.POSITION);
    const nor = glb.read(prim.attributes.NORMAL);
    const idx = glb.read(prim.indices);
    const uvs = prim.attributes.TEXCOORD_0 !== undefined ? glb.read(prim.attributes.TEXCOORD_0) : null;
    const wheel = prim.attributes._WHEEL !== undefined ? glb.read(prim.attributes._WHEEL) : null;
    const wheelScale = prim.attributes._WHEEL !== undefined && j.accessors[prim.attributes._WHEEL].normalized ? 65535 : 1;
    const pbr = mat.pbrMetallicRoughness ?? {};
    const factor = pbr.baseColorFactor ?? [1, 1, 1, 1];
    const tex = pbr.baseColorTexture && uvs ? atlas(glb, id, pbr.baseColorTexture.index) : null;
    const lampFaces = cls === 'lamp' || (cls === 'detail' && !tex && /Emissive/i.test(mat.name ?? ''));
    const base = P.length / 3;
    const nv = pos.length / 3;
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3] * s[0] + t[0]; const y = pos[v * 3 + 1] * s[1] + t[1]; const z = pos[v * 3 + 2] * s[2] + t[2];
      P.push(x, y, z);
      const len = Math.hypot(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]) || 1;
      N.push(nor[v * 3] / len, nor[v * 3 + 1] / len, nor[v * 3 + 2] / len);
      let rgb; let part;
      if (cls === 'paint' && !tex) {
        rgb = [0, 0, 0]; part = PART.BODY | PAINT_BIT; counts.paint++;
      } else if (cls === 'glass') {
        rgb = factor.slice(0, 3).map(toSrgb8); part = PART.WINDOW; counts.glass++;
      } else if (lampFaces) {
        const front = z > 0;
        rgb = front ? [236, 236, 228] : [176, 24, 20];
        part = y > roof - 0.35 ? (id === 'mtaxd40' ? PART.TRIM : PART.SIGN) : front ? PART.FRONT : PART.REAR;
        // Low side markers and cab-roof clearance lamps (the van) are not head or tail lamps: they stay dark trim.
        if (part !== PART.SIGN && (Math.abs(z) < halfLength * 0.8 || y < 0.45)) part = PART.TRIM;
        counts.lamp++;
      } else {
        const texel = tex ? sample(tex, uvs[v * 2], uvs[v * 2 + 1]) : [255, 255, 255];
        rgb = texel.map((c, k) => Math.round(Math.min(255, c * (tex ? factor[k] : Math.pow(factor[k], 1 / 2.2)))));
        const hub = cls === 'paint' ? null : nearHub(x, y, z);
        if (cls === 'paint') { part = PART.BODY; counts.paint++; } // a textured paint is a fixed livery (the TLC cab)
        else if (hub !== null) { part = hub < 0.66 ? PART.ALLOY : PART.TYRE; counts.wheel++; }
        else { part = PART.TRIM; counts.trim++; }
      }
      C.push(...rgb);
      R.push(part);
    }
    for (const k of idx) I.push(base + k);
  }
  const nv = P.length / 3;
  regrowWheels(P, C, R, hubs, wheelOf, counts);
  deriveLamps(P, N, C, R, size, counts);
  if (nv > 65535) throw new Error(`${id}: ${nv} vertices exceed u16 indices`);
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < nv; v++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], P[v * 3 + c]); hi[c] = Math.max(hi[c], P[v * 3 + c]); }
  const q = new Int16Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) {
    const c = i % 3;
    q[i] = Math.round(((P[i] - lo[c]) / (hi[c] - lo[c] || 1)) * 65535) - 32768;
  }
  const n8 = Int8Array.from(N, (x) => Math.round(Math.max(-1, Math.min(1, x)) * 127));
  // Distance LODs: new index lists over the same vertices. Positions are welded first (generatePositionRemap) so
  // the simplifier sees one surface across part and UV seams; a welded index points at the first vertex of its
  // position, so a far triangle may take its neighbour's colour across a seam. The body and the wheels decimate
  // apart: the body with the attribute-aware simplifier (colour and part weighted, Pruned of the specks it can no
  // longer hold), the wheels with the sloppy clusterer, which keeps a coarse tyre where edge collapse cannot (each
  // wheel is a closed cylinder of its own and Prune would drop it, leaving the car hovering).
  const attrs = new Float32Array(nv * 4);
  for (let v = 0; v < nv; v++) {
    for (let c = 0; c < 3; c++) attrs[v * 4 + c] = C[v * 3 + c] / 255;
    attrs[v * 4 + 3] = (R[v] & 0x7f) / 8 + ((R[v] & PAINT_BIT) ? 1 : 0);
  }
  const Pf = Float32Array.from(P);
  const remap = MeshoptSimplifier.generatePositionRemap(Pf, 3);
  const isWheel = (v) => R[v] === PART.TYRE || R[v] === PART.ALLOY;
  const bodyTris = []; const wheelTris = [];
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]];
    (tri.every(isWheel) ? wheelTris : bodyTris).push(...tri.map((v) => remap[v]));
  }
  const lods = {};
  for (const [name, share] of LODS) {
    const bodyTarget = Math.max(12, Math.floor((I.length / 3) * share)) * 3;
    const [body] = MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(bodyTris), Pf, 3, attrs, 4, [0.5, 0.5, 0.5, 1], null, bodyTarget, 1, ['Prune', 'Permissive']);
    const wheelTarget = Math.max(16 * hubs.length, Math.floor((wheelTris.length / 3) * share * 2)) * 3;
    const [wheels] = wheelTris.length > 0 ? MeshoptSimplifier.simplifySloppy(Uint32Array.from(wheelTris), Pf, 3, null, wheelTarget, 1) : [new Uint32Array()];
    const idx = Uint16Array.from([...body, ...wheels]);
    lods[name] = { triangles: idx.length / 3, index: b64(idx) };
  }
  cars.push({
    id,
    size: size.map((x) => Number(x.toFixed(3))),
    wheelbase: Number((root.extras.wheelbase ?? 0).toFixed(3)),
    box: [lo.map((x) => Number(x.toFixed(5))), hi.map((x) => Number(x.toFixed(5)))],
    vertices: nv,
    triangles: I.length / 3,
    position: b64(q), normal: b64(n8), color: b64(Uint8Array.from(C)), part: b64(Uint8Array.from(R)), index: b64(Uint16Array.from(I)),
    lods,
    counts,
  });
}

const text = [
  '// Generated by tooling/city/bake-cars.mjs. Do not edit.',
  '// Street cars from Valdrada v0.4.0 (github.com/mkturkcan/valdrada; Hugging Face',
  '// mehmetkeremturkcan/valdrada Content/models/fleet24), LOD2. lincoln, suv, van, mercedes,',
  '// charger: CC BY 4.0, CARLA Simulator (carla.org). taxinv200: CC BY 4.0, memoov',
  '// ("Dhl delivery van", Sketchfab), TLC cab build by Valdrada. mtaxd40: Valdrada\'s MTA',
  '// New Flyer XD40 bus, built from published dimensions. Valdrada code MIT.',
  '/** Bit 7 of a `part` byte: the vertex is body paint and takes the instance colour. */',
  'export const VD_CAR_PAINT_BIT = 0x80;',
  '/**',
  ' * Base64 little-endian arrays: Int16 position in `box` ([lo, hi], metres), Int8 normal (/127), sRGB8 colour,',
  ' * u8 part (CAR_PARTS id | VD_CAR_PAINT_BIT), Uint16 index. +Z forward, +Y up, origin at the ground centre, left at +X.',
  ' * `lods.mid` / `lods.far`: meshopt-decimated Uint16 index lists over the same vertices (about 1/6 and 1/20 of LOD2).',
  ' */',
  `export const VD_CARS = ${JSON.stringify(cars.map(({ counts, ...c }) => c))} as const;`,
  '',
].join('\n');
writeFileSync(OUT, text);
console.log(`wrote ${OUT} (${(text.length / 1024).toFixed(0)} KB)`);
for (const c of cars) console.log(` ${c.id}: ${c.triangles} tris (mid ${c.lods.mid.triangles}, far ${c.lods.far.triangles}), ${c.vertices} verts, size ${c.size}`, JSON.stringify(c.counts));
