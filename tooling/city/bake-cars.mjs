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
// The bake takes LOD1 (11k-24k triangles) and:
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
//   4. drops the triangles no one outside can see (the cabin behind the glass,
//      which both car materials draw opaque, and the hidden floor and
//      bulkheads; exteriorTriangles), turns every kept triangle to face the
//      way its normals do, and decimates three index lists (buildLevels):
//      `near` (LEVEL_TRIS, about LOD2's size), `mid` and `far`;
//   5. keeps only the vertices those levels draw and quantises: int16
//      position in a per-car box, int8 normal, rgb8 colour, u8 part (bit 7 =
//      paint), u16 index.
//
// Why LOD1 and not LOD2 (2026-10-28): the cab's LOD2 is broken at the source.
// Decoded and drawn, it is shards: long slivers across the body, 35 % of the
// rays from outside meeting a back face (vd-car-draw.test.ts). The CARLA
// bodies' LOD2s are whole but carry 2-6 % of their faces wound against their
// normals, which front-face culling turned into holes in the doors.
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
 * A body whose LOD decimated its tyres away (the cab's LOD2: a 0.17 m rim disc, the body 13 cm up) is regrown. Where a
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
 * LOD1 of several CARLA bodies has no lamp faces (suv, mercedes, the van). For an end with no FRONT/REAR vertex, the
 * outward-facing exterior trim at lamp height near that end becomes the lamp: red texels at the rear, bright ones at
 * the front, and, when the atlas shows neither, the outboard trim in the lamp band. Exterior: the van's lamp housings
 * behind the lens face the right way too, and would light a lamp no one can see.
 */
function deriveLamps(P, N, C, R, size, counts, exterior) {
  const [W, H, L] = size;
  const nv = P.length / 3;
  let minZ = Infinity; let maxZ = -Infinity;
  for (let v = 0; v < nv; v++) { minZ = Math.min(minZ, P[v * 3 + 2]); maxZ = Math.max(maxZ, P[v * 3 + 2]); }
  // A lamp only counts if it is on the outside (the van's emissive lamp faces sit inside its housings).
  const has = (id) => [...exterior].some((v) => (R[v] & 0x7f) === id);
  // Exterior trim first; a body whose lamp corners are all paint (the van) falls back to any exterior face but glass and wheels.
  const end = (front, anyPart) => (v) => {
    if (!exterior.has(v)) return false;
    const part = R[v] & 0x7f;
    if (anyPart ? [PART.WINDOW, PART.TYRE, PART.ALLOY].includes(part) : R[v] !== PART.TRIM) return false;
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
    const atEnd = end(false, false);
    const red = (v) => atEnd(v) && C[v * 3] > 60 && C[v * 3] > 1.6 * C[v * 3 + 1];
    if (tag(red, PART.REAR, null) === 0 && tag(atEnd, PART.REAR, [150, 22, 18]) === 0) tag(end(false, true), PART.REAR, [150, 22, 18]);
  }
  if (!has(PART.FRONT)) {
    const atEnd = end(true, false);
    const bright = (v) => atEnd(v) && Math.min(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]) > 150;
    if (tag(bright, PART.FRONT, null) === 0 && tag(atEnd, PART.FRONT, [220, 222, 216]) === 0) tag(end(true, true), PART.FRONT, [220, 222, 216]);
  }
}

/** Triangles per detail level. Valdrada's LOD1 is the source; `near` takes the place of its LOD2 (about 4k a car). */
const LEVEL_TRIS = { near: 4500, mid: 900, far: 260 };
const BUS_LEVEL_TRIS = { near: 6000, mid: 1400, far: 420 };
/** Voxel edge (m) for the interior test, and how far off a face (in voxels) its two sides are probed. */
const VOXEL = 0.05;
const PROBE = 3;
/** A decimated corner whose best vertex normal is under this cosine to its face gets a copy with the face normal. */
const MIN_FACING = 0.25;

/**
 * The triangles a viewer outside the car can reach. The body is voxelised (every triangle marks the cells it passes
 * through, then one cell of dilation closes panel seams), the air outside is flood-filled from the box corner, and a
 * triangle stays when either side of it, PROBE voxels off its face, is outside air. The cabin behind the glass (the
 * glass draws opaque in both car materials) and the hidden floor and bulkheads go. If the fill leaks in through a gap,
 * every triangle reads as reachable and the body keeps its interior: a slower car, not a broken one.
 */
function exteriorTriangles(P, I) {
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i++) { lo[i % 3] = Math.min(lo[i % 3], P[i]); hi[i % 3] = Math.max(hi[i % 3], P[i]); }
  const pad = PROBE + 3;
  const dim = [0, 1, 2].map((c) => Math.ceil((hi[c] - lo[c]) / VOXEL) + pad * 2);
  const at = (x, y, z) => {
    const i = Math.floor((x - lo[0]) / VOXEL) + pad; const j = Math.floor((y - lo[1]) / VOXEL) + pad; const k = Math.floor((z - lo[2]) / VOXEL) + pad;
    return i < 0 || j < 0 || k < 0 || i >= dim[0] || j >= dim[1] || k >= dim[2] ? -1 : (k * dim[1] + j) * dim[0] + i;
  };
  const cells = dim[0] * dim[1] * dim[2];
  const solid = new Uint8Array(cells);
  const each = (a, b, c, step, fn) => {
    const e = Math.max(Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]), Math.hypot(P[b] - P[c], P[b + 1] - P[c + 1], P[b + 2] - P[c + 2]), Math.hypot(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]));
    const n = Math.max(1, Math.ceil(e / step));
    for (let u = 0; u <= n; u++) for (let v = 0; v <= n - u; v++) {
      const w = n - u - v;
      fn((P[a] * w + P[b] * u + P[c] * v) / n, (P[a + 1] * w + P[b + 1] * u + P[c + 1] * v) / n, (P[a + 2] * w + P[b + 2] * u + P[c + 2] * v) / n);
    }
  };
  for (let t = 0; t < I.length; t += 3) each(I[t] * 3, I[t + 1] * 3, I[t + 2] * 3, VOXEL / 3, (x, y, z) => { const i = at(x, y, z); if (i >= 0) solid[i] = 1; });
  const sx = 1; const sy = dim[0]; const sz = dim[0] * dim[1];
  const dilated = Uint8Array.from(solid);
  for (let i = 0; i < cells; i++) if (solid[i]) for (const d of [sx, -sx, sy, -sy, sz, -sz]) { const j = i + d; if (j >= 0 && j < cells) dilated[j] = 1; }
  const outside = new Uint8Array(cells);
  const queue = new Int32Array(cells);
  let head = 0; let tail = 0;
  queue[tail++] = 0; outside[0] = 1;
  while (head < tail) {
    const i = queue[head++];
    const x = i % dim[0]; const y = Math.floor(i / sy) % dim[1]; const z = Math.floor(i / sz);
    for (const [ok, d] of [[x > 0, -sx], [x < dim[0] - 1, sx], [y > 0, -sy], [y < dim[1] - 1, sy], [z > 0, -sz], [z < dim[2] - 1, sz]]) {
      const j = i + d;
      if (ok && !outside[j] && !dilated[j]) { outside[j] = 1; queue[tail++] = j; }
    }
  }
  /** Outside-air samples on the +normal side minus the -normal side of triangle (a, b, c), PROBE voxels off it; 0 when sealed in. */
  const side = (a, b, c) => {
    const ux = P[b] - P[a]; const uy = P[b + 1] - P[a + 1]; const uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a]; const vy = P[c + 1] - P[a + 1]; const vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy; let ny = uz * vx - ux * vz; let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0) return { front: 0, back: 0 };
    nx /= len; ny /= len; nz /= len;
    const off = PROBE * VOXEL;
    let front = 0; let back = 0;
    each(a, b, c, VOXEL * 2, (x, y, z) => {
      const f = at(x + nx * off, y + ny * off, z + nz * off); if (f < 0 || outside[f]) front++;
      const k = at(x - nx * off, y - ny * off, z - nz * off); if (k < 0 || outside[k]) back++;
    });
    return { front, back };
  };
  const keep = [];
  for (let t = 0; t < I.length; t += 3) {
    const { front, back } = side(I[t] * 3, I[t + 1] * 3, I[t + 2] * 3);
    if (front + back > 0) keep.push(I[t], I[t + 1], I[t + 2]);
  }
  return { keep, side };
}

/** Turns each triangle so its winding faces the way its vertex normals do (front faces cull the right side). Returns the flips. */
function orient(P, N, idx) {
  let flipped = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3; const b = idx[t + 1] * 3; const c = idx[t + 2] * 3;
    const ux = P[b] - P[a]; const uy = P[b + 1] - P[a + 1]; const uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a]; const vy = P[c + 1] - P[a + 1]; const vz = P[c + 2] - P[a + 2];
    const gx = uy * vz - uz * vy; const gy = uz * vx - ux * vz; const gz = ux * vy - uy * vx;
    if (gx * (N[a] + N[b] + N[c]) + gy * (N[a + 1] + N[b + 1] + N[c + 1]) + gz * (N[a + 2] + N[b + 2] + N[c + 2]) < 0) {
      const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; flipped++;
    }
  }
  return flipped;
}

/**
 * near / mid / far index lists over the unwelded LOD1 vertices. `near` is the exterior triangles (turned to their
 * normals) decimated by meshoptimizer's attribute-aware simplifier with Permissive, which collapses across the colour
 * and normal seams of the unwelded input and keeps every corner on its own side of a seam. `mid` and `far` decimate
 * `near` harder: on the unwelded mesh the simplifier stalls at its open borders, so those two simplify the
 * position-welded surface and then put each corner back on the vertex at that position whose normal best matches
 * the triangle. The old bake stopped at the welded index, so a decimated triangle took the first vertex at each
 * position, often an interior or a wheel vertex, and drew in its colour and normal: the grey, black and see-through
 * panels on distant cars.
 */
function buildLevels(id, P, N, C, R, ext, side, counts) {
  const budget = id === 'mtaxd40' ? BUS_LEVEL_TRIS : LEVEL_TRIS;
  const Pf = Float32Array.from(P);
  const nv = P.length / 3;
  const attrs = new Float32Array(nv * 7);
  for (let v = 0; v < nv; v++) {
    for (let c = 0; c < 3; c++) { attrs[v * 7 + c] = N[v * 3 + c]; attrs[v * 7 + 3 + c] = C[v * 3 + c] / 255; }
    attrs[v * 7 + 6] = (R[v] & 0x7f) / 8 + ((R[v] & PAINT_BIT) ? 1 : 0);
  }
  const weights = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1];
  // Lamp faces are a few small patches the materials light by part: they stay as baked.
  const lampLock = Uint8Array.from({ length: nv }, (_, v) => ([PART.FRONT, PART.REAR, PART.SIGN].includes(R[v] & 0x7f) ? 1 : 0));
  const near = ext.length / 3 > budget.near
    ? [...MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(ext), Pf, 3, attrs, 7, weights, lampLock, budget.near * 3, 1, ['Permissive'])[0]]
    : [...ext];
  // Weld near's vertices by position; the representative of a position is the first near vertex there.
  const remap = MeshoptSimplifier.generatePositionRemap(Pf, 3);
  const group = new Map();
  for (const v of new Set(near)) { const w = remap[v]; if (!group.has(w)) group.set(w, []); group.get(w).push(v); }
  const rep = new Map([...group].map(([w, list]) => [w, list[0]]));
  const welded = Uint32Array.from(near, (v) => rep.get(remap[v]));
  // A clustered triangle faces the outside air (its winding is flipped if that air lies behind it; one sealed in on
  // both sides is dropped), and each corner takes the vertex at its position whose normal best matches that face.
  const unweld = (idx) => {
    const out = [];
    for (let t = 0; t < idx.length; t += 3) {
      let tri = [idx[t], idx[t + 1], idx[t + 2]];
      const { front, back } = side(tri[0] * 3, tri[1] * 3, tri[2] * 3);
      if (front + back === 0) continue;
      if (back > front) tri = [tri[0], tri[2], tri[1]];
      const [a, b, c] = tri.map((v) => v * 3);
      const gx = (P[b + 1] - P[a + 1]) * (P[c + 2] - P[a + 2]) - (P[b + 2] - P[a + 2]) * (P[c + 1] - P[a + 1]);
      const gy = (P[b + 2] - P[a + 2]) * (P[c] - P[a]) - (P[b] - P[a]) * (P[c + 2] - P[a + 2]);
      const gz = (P[b] - P[a]) * (P[c + 1] - P[a + 1]) - (P[b + 1] - P[a + 1]) * (P[c] - P[a]);
      const len = Math.hypot(gx, gy, gz);
      for (const corner of tri) {
        let best = corner; let score = -Infinity;
        for (const v of group.get(remap[corner])) {
          const d = (N[v * 3] * gx + N[v * 3 + 1] * gy + N[v * 3 + 2] * gz) / len;
          if (d > score) { score = d; best = v; }
        }
        // No vertex there faces this way (the clusterer bridged two surfaces): a copy with the face's own normal,
        // so the facet lights as the side it shows instead of the one it hides.
        if (score < MIN_FACING) {
          const v = P.length / 3;
          P.push(P[best * 3], P[best * 3 + 1], P[best * 3 + 2]);
          N.push(gx / len, gy / len, gz / len);
          C.push(C[best * 3], C[best * 3 + 1], C[best * 3 + 2]);
          R.push(R[best]);
          counts.refaced = (counts.refaced ?? 0) + 1;
          best = v;
        }
        out.push(best);
      }
    }
    return out;
  };
  // The clusterer may answer with any vertex of the buffer it is given, so it gets the representatives alone.
  const reps = [...new Set(welded)];
  const local = new Map(reps.map((v, i) => [v, i]));
  const repPositions = new Float32Array(reps.length * 3);
  reps.forEach((v, i) => repPositions.set(Pf.subarray(v * 3, v * 3 + 3), i * 3));
  const weldedLocal = Uint32Array.from(welded, (v) => local.get(v));
  // The tyres' contact patches (nothing else comes within 6 cm of the street) stay put, so a clustered car still stands.
  const groundLock = Uint8Array.from(reps, (v) => (P[v * 3 + 1] < 0.06 ? 1 : 0));
  const decimate = (tris) => unweld(Array.from(MeshoptSimplifier.simplifySloppy(weldedLocal, repPositions, 3, groundLock, Math.min(weldedLocal.length, tris * 3), 1)[0], (i) => reps[i]));
  counts.flipped = orient(Pf, N, near);
  // The clusterer can lose a whole tyre at a coarse grid (the cab's far level floated 21 cm): ask for more until the
  // level still stands on the street, at most the mid budget.
  const floor = (idx) => idx.reduce((m, v) => Math.min(m, P[v * 3 + 1]), Infinity);
  const ground = floor(near) + 0.08;
  const standing = (tris) => {
    let out = decimate(tris);
    for (let n = tris; floor(out) > ground && n < budget.mid; ) { n = Math.min(budget.mid, Math.round(n * 1.4)); out = decimate(n); }
    return out;
  };
  return { near, mid: standing(budget.mid), far: standing(budget.far) };
}

const cars = [];
for (const id of CARS) {
  const glb = openGlb(join(SRC, `${id}.glb`));
  const { j } = glb;
  const root = j.nodes.find((n) => n.extras?.hubs);
  const lod = j.nodes.find((n) => n.name === 'LOD1');
  if (!root || !lod || lod.rotation) throw new Error(`${id}: expected a root with extras and an unrotated LOD1 node`);
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
  regrowWheels(P, C, R, hubs, wheelOf, counts);
  const { keep: exterior, side } = exteriorTriangles(Float32Array.from(P), I);
  counts.interior = (I.length - exterior.length) / 3;
  deriveLamps(P, N, C, R, size, counts, new Set(exterior));
  const levels = buildLevels(id, P, N, C, R, exterior, side, counts);
  // Keep only the vertices some level draws, renumbered in first-use order.
  const used = new Int32Array(P.length / 3).fill(-1);
  let nv = 0;
  for (const level of Object.values(levels)) for (const v of level) if (used[v] < 0) used[v] = nv++;
  if (nv > 65535) throw new Error(`${id}: ${nv} vertices exceed u16 indices`);
  const pick = (src, n) => { const out = new Array(nv * n); for (let v = 0; v < used.length; v++) if (used[v] >= 0) for (let c = 0; c < n; c++) out[used[v] * n + c] = src[v * n + c]; return out; };
  const P2 = pick(P, 3); const N2 = pick(N, 3); const C2 = pick(C, 3); const R2 = pick(R, 1);
  const index = {};
  for (const [name, level] of Object.entries(levels)) index[name] = Uint16Array.from(level, (v) => used[v]);
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < nv; v++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], P2[v * 3 + c]); hi[c] = Math.max(hi[c], P2[v * 3 + c]); }
  const q = new Int16Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) {
    const c = i % 3;
    q[i] = Math.round(((P2[i] - lo[c]) / (hi[c] - lo[c] || 1)) * 65535) - 32768;
  }
  const n8 = Int8Array.from(N2, (x) => Math.round(Math.max(-1, Math.min(1, x)) * 127));
  const lods = {};
  for (const name of ['mid', 'far']) lods[name] = { triangles: index[name].length / 3, index: b64(index[name]) };
  cars.push({
    id,
    size: size.map((x) => Number(x.toFixed(3))),
    wheelbase: Number((root.extras.wheelbase ?? 0).toFixed(3)),
    box: [lo.map((x) => Number(x.toFixed(5))), hi.map((x) => Number(x.toFixed(5)))],
    vertices: nv,
    triangles: index.near.length / 3,
    position: b64(q), normal: b64(n8), color: b64(Uint8Array.from(C2)), part: b64(Uint8Array.from(R2)), index: b64(index.near),
    lods,
    counts,
  });
}

const text = [
  '// Generated by tooling/city/bake-cars.mjs. Do not edit.',
  '// Street cars from Valdrada v0.4.0 (github.com/mkturkcan/valdrada; Hugging Face',
  '// mehmetkeremturkcan/valdrada Content/models/fleet24), LOD1, decimated. lincoln, suv, van, mercedes,',
  '// charger: CC BY 4.0, CARLA Simulator (carla.org). taxinv200: CC BY 4.0, memoov',
  '// ("Dhl delivery van", Sketchfab), TLC cab build by Valdrada. mtaxd40: Valdrada\'s MTA',
  '// New Flyer XD40 bus, built from published dimensions. Valdrada code MIT.',
  '/** Bit 7 of a `part` byte: the vertex is body paint and takes the instance colour. */',
  'export const VD_CAR_PAINT_BIT = 0x80;',
  '/**',
  ' * Base64 little-endian arrays: Int16 position in `box` ([lo, hi], metres), Int8 normal (/127), sRGB8 colour,',
  ' * u8 part (CAR_PARTS id | VD_CAR_PAINT_BIT), Uint16 index. +Z forward, +Y up, origin at the ground centre, left at +X.',
  ' * `index` is the near level; `lods.mid` / `lods.far`: coarser Uint16 index lists over the same vertices.',
  ' */',
  `export const VD_CARS = ${JSON.stringify(cars.map(({ counts, ...c }) => c))} as const;`,
  '',
].join('\n');
writeFileSync(OUT, text);
console.log(`wrote ${OUT} (${(text.length / 1024).toFixed(0)} KB)`);
for (const c of cars) console.log(` ${c.id}: ${c.triangles} tris (mid ${c.lods.mid.triangles}, far ${c.lods.far.triangles}), ${c.vertices} verts, size ${c.size}`, JSON.stringify(c.counts));
