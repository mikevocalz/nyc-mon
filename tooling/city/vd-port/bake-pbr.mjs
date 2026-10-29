// Bakes the texture sets of Valdrada's PBR material library (client/src/city/mat/pbrLib.js, pbrSets.js) that the
// street props (pk), street life (lk) and elevated structures (vk) draw inside the bundled square, as two RGBA8
// DataArrayTexture payloads for vd-port/furniture/pbr-material.ts (lane C of the vd port).
//
// Source: Valdrada v0.4.0 (2724c79, MIT; tooling/city/valdrada/LICENSE.valdrada) run as shipped under Node
// (valdrada-runtime.mjs, assemble-city.mjs). The sets in use are read off the live scene, not listed by hand:
//   * every tile covering the square is assembled; each mesh a pk, lk or vk file added (userData.vdSrc) is measured
//     with its far geometry and again after its part's own LOD hook switched in the near models (pk/props.js
//     onBeforeRender, lk/life.js's per-tile driver), with a view camera (aspect 1.5) inside its cell;
//   * a mesh counts when one of its vertices lands inside the square (scene |x|, |z| <= 850 m, decode.mjs's
//     transform) and its material is a pbrLib material (userData.pbr); the set is pbrLib's own resolution of the
//     material's name (pbrInfo: MATS[name].tex through TEX_FALLBACK to a packed set).
// The KTX2 files (CC0: ambientCG, Poly Haven, Valdrada's procedural sets) are not in the git checkout; they ship in
// the Hugging Face dataset mehmetkeremturkcan/valdrada at tag v0.4.0, Content/textures/pbr/<set>/{albedo,normal,orm}
// .ktx2 (the same tag and repo the tiles come from, fetch.mjs). They download to tooling/city/.cache/vd-pbr/ (git-
// ignored) and are pinned by sha256 and byte count in tooling/city/vd-port/pbr-pins.json; a pinned file that changes
// fails the bake. Each download is also checked against the dataset's own LFS sha256 (the tree API's lfs.oid).
//
// Transcode: three's basis_transcoder.wasm (from packages/app/node_modules, as tooling/city/bake-cars.mjs does) to
// RGBA8 at the first KTX2 mip level whose sides are both at least the layer size, then a box filter to the square
// layer. Albedo averages in linear light and is stored sRGB again; normals average as vectors and are renormalised;
// ORM averages as stored. A non-square set (brick_tan, concrete_precast, wood_paint: 2:1) is resampled to the square
// layer: pbrLib maps a set by st = metres / size [u, v], so the layer's [0, 1]^2 is the same repeat at any aspect.
//
// Layer size: 512 px when the two arrays with their mip chains fit 16 MB of GPU memory, else 256 px (each layer
// costs 2 x 4 bytes x side^2 x 4/3). Rows are stored bottom-up (row 0 = the bottom of the image): KTX2 stores the
// top row first and pbrLib samples it at (s, -t) "so up the surface is up the image"; bottom-up storage sampled at
// (s, t) reads the same texel. No mips are written: three generates the chain on upload (generateMipmaps, as
// vd-materials.ts does; three's WebGPU path uploads only level 0 of a DataArrayTexture).
//
// Channels (pbr-albedo.bin, pbr-orm.bin; one RGBA8 layer per set, layers in the manifest's order):
//   albedo  R G B  the albedo, sRGB             A  the normal map's X (0..255 = -1..1)
//   orm     R AO   G roughness   B metalness or the ORM alpha (see below)   A  the normal map's Y
// The normal's Z is not stored: it is rebuilt as sqrt(1 - x^2 - y^2) (the maps are unit tangent-space normals with
// z > 0, checked below). pbrLib reads four ORM channels (AO, roughness, metalness and the alpha: height for most
// sets, the paint mask for paint_steel) and the pair of arrays has room for three once the normal takes its two. A
// set whose metalness channel is one value over the whole map (measured below, to the byte) stores its ORM alpha
// in B and carries the metalness as a constant in the manifest (`metal`); a set whose alpha is one value keeps its
// metalness in B instead. A set where both vary (paint_steel: its paint mask, and bare steel in ~3 % of its texels)
// keeps the alpha, which drives pbrLib's paint, chips, substrate, cavity dirt and tap blend, and carries the
// metalness as its mean over the map; the manifest records what was lost (`metalLost`).
//
// Run (VD_TOOLS: a directory with @napi-rs/canvas and earcut installed, outside the repo):
//   VD_TOOLS=/path/to/tools node tooling/city/vd-port/bake-pbr.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { REPO, THREE, vd } from './valdrada-runtime.mjs';
import { assembleCity } from './assemble-city.mjs';
import { EXTENT_METERS, ORIGIN } from '../valdrada/decode.mjs';

const HF = 'https://huggingface.co/datasets/mehmetkeremturkcan/valdrada';
const TAG = 'v0.4.0';
const CACHE = join(REPO, 'tooling/city/.cache/vd-pbr');
const PINS = join(REPO, 'tooling/city/vd-port/pbr-pins.json');
const FURN = join(REPO, 'packages/app/features/game/world/vd-port/furniture');
const OUT_BIN = join(FURN, 'assets');
const OUT_TS = join(FURN, 'data/pbr-sets.ts');
const BUDGET = 16 * 1024 * 1024;
const FILES = ['albedo', 'normal', 'orm'];

// vd-port/transform.ts valdradaToSceneAffine, for the dataset origin (the same affine bake-furniture.mjs checks)
const DEG = Math.PI / 180, R_M = 6_371_008.8;
const LAT0 = 40.7831, LON0 = -73.9712, M_LAT = 111132.0, M_LON = 111320.0 * Math.cos((LAT0 * Math.PI) / 180);
const kx = DEG * R_M * Math.cos(ORIGIN.latitude * DEG), kz = DEG * R_M;
const AFF = { sx: kx / M_LON, ox: (LON0 - ORIGIN.longitude) * kx, sz: kz / M_LAT, oz: -(LAT0 - ORIGIN.latitude) * kz };
const toScene = (x, z) => [x * AFF.sx + AFF.ox, z * AFF.sz + AFF.oz];

// ---------------------------------------------------------------- 1. the sets the square draws
const pbrLib = await vd('city/mat/pbrLib.js');
const { PBR_TEX } = await vd('city/mat/pbrSets.js');
for (const [f, r] of [['city/pk/pkMats.js', 'pkMatsReady'], ['city/lk/lkMats.js', 'lkMatsReady'], ['city/vk/vkMats.js', 'vkMatsReady']]) await (await vd(f))[r];
const { scene, groups } = await assembleCity();

const renderer = { info: { render: { frame: 0 } } };
const cam = new THREE.PerspectiveCamera(60, 1.5, 0.5, 2000);
const v3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
const used = new Map();   // material -> { parts: Set, verts }
function measure(mesh, part) {
  const p = mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.position;
  if (!p || p.count < 4) return;   // the parts' empty stand-ins are one 3-vertex triangle
  const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter((m) => m && m.userData && m.userData.pbr);
  if (!mats.length) return;
  mesh.updateMatrixWorld(true);
  let n = 0;
  for (let k = 0, kn = mesh.isInstancedMesh ? mesh.count : 1; k < kn; k++) {
    if (mesh.isInstancedMesh) { mesh.getMatrixAt(k, m4); m4.premultiply(mesh.matrixWorld); } else m4.copy(mesh.matrixWorld);
    for (let i = 0; i < p.count; i++) {
      v3.fromBufferAttribute(p, i).applyMatrix4(m4);
      const [x, z] = toScene(v3.x, v3.z);
      if (Math.abs(x) <= EXTENT_METERS && Math.abs(z) <= EXTENT_METERS) n++;
    }
  }
  if (!n) return;
  for (const mat of mats) {
    let r = used.get(mat);
    if (!r) used.set(mat, (r = { parts: new Set(), verts: 0 }));
    r.parts.add(part); r.verts += n;
  }
}
const view = (mesh, hook) => {
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  if (!g.boundingBox || g.boundingBox.isEmpty()) return false;
  g.boundingBox.getCenter(cam.position).applyMatrix4(mesh.matrixWorld);
  cam.updateMatrixWorld(true);
  renderer.info.render.frame++;
  hook.onBeforeRender(renderer, scene, cam, hook.geometry, hook.material, null);
  return true;
};
for (const { group } of groups) {
  group.updateMatrixWorld(true);
  const lkDriver = group.children.find((o) => o.name === 'lk:driver');
  group.traverse((o) => {
    const part = ((o.userData && o.userData.vdSrc) || '').match(/city\/(pk|lk|vk)\//)?.[1];
    if (!part || !o.isMesh || o.name === 'lk:driver') return;
    measure(o, part);   // the far model (or the part's only geometry)
    // the near model: lk/life.js switches its meshes from the tile's driver, pk/props.js from each mesh's own hook;
    // an empty stand-in's bounding box is its cell's box (lk), a far merge's is the cell's too (pk)
    if (part === 'lk' && lkDriver && view(o, lkDriver)) measure(o, 'lk');
    else if (part === 'pk' && o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender && view(o, o)) measure(o, 'pk');
  });
}
const materials = [...used].map(([mat, r]) => ({ mat, ...r, set: pbrLib.pbrInfo(mat.userData.pbr.name).set }))
  .sort((a, b) => a.set.localeCompare(b.set) || a.mat.userData.pbr.name.localeCompare(b.mat.userData.pbr.name));
const SETS = [...new Set(materials.map((m) => m.set))].sort();
console.log(`${materials.length} pbrLib materials inside the square, ${SETS.length} sets: ${SETS.join(' ')}`);
for (const m of materials) console.log(`  ${m.set.padEnd(18)} ${m.mat.userData.pbr.name.padEnd(18)} ${[...m.parts].join(',').padEnd(6)} ${JSON.stringify(m.mat.userData.pbr.opts)}`);

// ---------------------------------------------------------------- 2. download and pin
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
// (valdrada-runtime.mjs replaces globalThis.fetch with the checkout's file server, so the network goes through https)
function get(url, hops = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'nyc-mon-city-build/1.0 (offline pbr bake)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 8) {
        res.resume();
        resolve(get(new URL(res.headers.location, url).href, hops + 1));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => (res.statusCode === 200 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${url}: HTTP ${res.statusCode}`))));
      res.on('error', reject);
    }).on('error', reject);
  });
}
let pins = { repo: HF, tag: TAG, commit: '2724c79', path: 'Content/textures/pbr/<set>/<file>.ktx2', licence: 'CC0 1.0 (per set: pbrSets.js)', files: {} };
if (existsSync(PINS)) pins = { ...pins, ...JSON.parse(readFileSync(PINS, 'utf8')) };
const lfsOid = new Map();
async function lfsOf(set) {
  if (lfsOid.has(set)) return lfsOid.get(set);
  const tree = JSON.parse((await get(`https://huggingface.co/api/datasets/mehmetkeremturkcan/valdrada/tree/${TAG}/Content/textures/pbr/${set}`)).toString());
  const m = new Map(tree.map((e) => [e.path, e.lfs ? e.lfs.oid : null]));
  lfsOid.set(set, m);
  return m;
}
const files = {};
for (const set of SETS) {
  for (const f of FILES) {
    const rel = `Content/textures/pbr/${set}/${f}.ktx2`;
    const dest = join(CACHE, set, `${f}.ktx2`);
    let buf = existsSync(dest) ? readFileSync(dest) : null;
    if (!buf || (pins.files[rel] && sha256(buf) !== pins.files[rel].sha256)) {
      buf = await get(`${HF}/resolve/${TAG}/${rel}`);
      const oid = (await lfsOf(set)).get(rel);
      if (oid && oid !== sha256(buf)) throw new Error(`${rel}: sha256 ${sha256(buf)} is not the dataset's LFS oid ${oid}`);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, buf);
    }
    const hash = sha256(buf);
    if (pins.files[rel] && pins.files[rel].sha256 !== hash) throw new Error(`pin mismatch for ${rel}: pinned ${pins.files[rel].sha256}, got ${hash}`);
    files[rel] = pins.files[rel] ?? { sha256: hash, bytes: buf.length, retrievedAt: new Date().toISOString() };
  }
}
pins = { ...pins, files };
writeFileSync(PINS, `${JSON.stringify(pins, null, 2)}\n`);

// ---------------------------------------------------------------- 3. transcode and resample
const basisDir = join(REPO, 'packages/app/node_modules/three/examples/jsm/libs/basis');
const basisModule = { exports: {} };
vm.runInThisContext(`(function (module, exports, require, __filename, __dirname) {${readFileSync(join(basisDir, 'basis_transcoder.js'), 'utf8')}\n})`)(
  basisModule, basisModule.exports, createRequire(import.meta.url), join(basisDir, 'basis_transcoder.js'), basisDir,
);
const BASIS = await basisModule.exports({ wasmBinary: readFileSync(join(basisDir, 'basis_transcoder.wasm')) });
BASIS.initializeBasis();
const RGBA32 = 13;
/** The KTX2 DFD's transfer function (KHR_DF_TRANSFER_SRGB = 2, LINEAR = 1). */
const transferOf = (buf) => buf[buf.readUInt32LE(48) + 14];

const SIDE = SETS.length * 2 * 4 * 512 * 512 * (4 / 3) <= BUDGET ? 512 : 256;
const gpuBytes = (side) => SETS.length * 2 * 4 * side * side * (4 / 3);
if (gpuBytes(SIDE) > BUDGET) throw new Error(`${SETS.length} sets do not fit ${BUDGET} bytes even at ${SIDE} px`);
console.log(`layer ${SIDE} px (${SETS.length} sets at 512 px: ${(gpuBytes(512) / 1048576).toFixed(1)} MB with mips${SIDE === 256 ? ', over the 16 MB budget' : ''})`);

/** RGBA8 rows top-first at the first mip level whose sides are both >= SIDE. */
function transcode(buf, name) {
  const file = new BASIS.KTX2File(new Uint8Array(buf));
  if (!file.isValid()) throw new Error(`${name}: invalid KTX2`);
  let level = 0;
  while (level + 1 < file.getLevels() && Math.min(file.getWidth() >> (level + 1), file.getHeight() >> (level + 1)) >= SIDE) level++;
  if (!file.startTranscoding()) throw new Error(`${name}: startTranscoding failed`);
  const info = file.getImageLevelInfo(level, 0, 0);
  const data = new Uint8Array(file.getImageTranscodedSizeInBytes(level, 0, 0, RGBA32));
  if (!file.transcodeImage(data, level, 0, 0, RGBA32, 0, -1, -1)) throw new Error(`${name}: transcode failed`);
  const out = { w: info.origWidth, h: info.origHeight, data, level, src: [file.getWidth(), file.getHeight()] };
  file.close(); file.delete();
  return out;
}
const s2l = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const l2s = (v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)));
/** Box filter to SIDE x SIDE, rows flipped to bottom-up. kind: 'srgb' | 'normal' | 'linear'. Float RGBA out. */
function resample(img, kind) {
  const { w, h, data } = img;
  if (w % SIDE || h % SIDE) throw new Error(`${w}x${h} is not a multiple of ${SIDE}`);
  const fx = w / SIDE, fy = h / SIDE, out = new Float64Array(SIDE * SIDE * 4);
  const lut = kind === 'srgb' ? Float64Array.from({ length: 256 }, (_, i) => s2l(i)) : null;
  for (let y = 0; y < SIDE; y++) {
    const yOut = SIDE - 1 - y;   // bottom-up
    for (let x = 0; x < SIDE; x++) {
      const acc = [0, 0, 0, 0];
      for (let j = 0; j < fy; j++) for (let i = 0; i < fx; i++) {
        const o = ((y * fy + j) * w + x * fx + i) * 4;
        for (let c = 0; c < 4; c++) {
          const b = data[o + c];
          acc[c] += lut && c < 3 ? lut[b] : kind === 'normal' && c < 3 ? b / 127.5 - 1 : b / 255;
        }
      }
      const o = (yOut * SIDE + x) * 4, n = fx * fy;
      for (let c = 0; c < 4; c++) out[o + c] = acc[c] / n;
      if (kind === 'normal') {
        const l = Math.hypot(out[o], out[o + 1], out[o + 2]) || 1;
        out[o] /= l; out[o + 1] /= l; out[o + 2] /= l;
      }
    }
  }
  return out;
}

const N = SIDE * SIDE;
const albedoBin = new Uint8Array(N * 4 * SETS.length), ormBin = new Uint8Array(N * 4 * SETS.length);
const manifest = [];
for (const [layer, set] of SETS.entries()) {
  const raw = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(CACHE, set, `${f}.ktx2`))]));
  const tf = Object.fromEntries(FILES.map((f) => [f, transferOf(raw[f])]));
  if (tf.albedo !== 2 || tf.normal !== 1 || tf.orm !== 1) throw new Error(`${set}: transfer functions ${JSON.stringify(tf)} (albedo sRGB, data linear expected)`);
  const T = Object.fromEntries(FILES.map((f) => [f, transcode(raw[f], `${set}/${f}`)]));
  const alb = resample(T.albedo, 'srgb'), nrm = resample(T.normal, 'normal'), orm = resample(T.orm, 'linear');
  // the ORM channels' spread at the source resolution (to the byte): a channel with one value is a constant
  const spread = (c) => { let lo = 255, hi = 0; for (let i = c; i < T.orm.data.length; i += 4) { const b = T.orm.data[i]; if (b < lo) lo = b; if (b > hi) hi = b; } return [lo, hi]; };
  const [mLo, mHi] = spread(2), [aLo, aHi] = spread(3);
  let bHolds, metalConst = mLo / 255, metalLost = null;
  if (mLo === mHi) bHolds = 'alpha';
  else if (aLo === aHi) bHolds = 'metal';
  else {
    // both vary (paint_steel: the paint mask, and the bare steel in its chips): the alpha stays, it drives the paint, the
    // chips, the substrate, the dirt's cavities and the two taps' blend; the metalness becomes its mean over the map
    let sum = 0, on = 0, n = 0;
    for (let i = 2; i < T.orm.data.length; i += 4) { sum += T.orm.data[i]; if (T.orm.data[i] > 0) on++; n++; }
    bHolds = 'alpha'; metalConst = sum / n / 255;
    metalLost = { range: [mLo / 255, mHi / 255], nonZeroShare: +(on / n).toFixed(4) };
    console.log(`  ${set}: metalness ${mLo}..${mHi} and alpha ${aLo}..${aHi} both vary; metalness kept as its mean ${metalConst.toFixed(4)} (${(100 * on / n).toFixed(1)} % of texels above 0)`);
  }
  let zMin = 1, mean = [0, 0, 0];
  const o0 = layer * N * 4;
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    for (let c = 0; c < 3; c++) { albedoBin[o0 + o + c] = l2s(alb[o + c]); mean[c] += alb[o + c] / N; }
    albedoBin[o0 + o + 3] = Math.round(Math.min(1, Math.max(-1, nrm[o])) * 127.5 + 127.5);
    ormBin[o0 + o] = Math.round(orm[o] * 255);
    ormBin[o0 + o + 1] = Math.round(orm[o + 1] * 255);
    ormBin[o0 + o + 2] = Math.round((bHolds === 'alpha' ? orm[o + 3] : orm[o + 2]) * 255);
    ormBin[o0 + o + 3] = Math.round(Math.min(1, Math.max(-1, nrm[o + 1])) * 127.5 + 127.5);
    zMin = Math.min(zMin, nrm[o + 2]);
  }
  if (zMin <= 0) throw new Error(`${set}: a normal with z ${zMin.toFixed(3)} (z is rebuilt as positive)`);
  const P = PBR_TEX[set];
  manifest.push({
    set, layer, size: P.size, mean: P.mean, meanHex: P.meanHex, alpha: P.alpha, roughMean: P.roughMean ?? null,
    paintMean: P.paintMean ?? null, courses: P.courses ?? null, bricks: P.bricks ?? null, halfBricks: P.halfBricks ?? null,
    b: bHolds, metal: bHolds === 'alpha' ? +metalConst.toFixed(6) : null, alphaConst: bHolds === 'metal' ? +(aLo / 255).toFixed(6) : null, metalLost,
    source: { id: P.id, url: P.url, licence: P.licence, res: P.res, level: T.albedo.level },
    bakedMean: mean.map((v) => +v.toFixed(4)), zMin: +zMin.toFixed(3),
  });
  console.log(`  ${String(layer).padStart(2)} ${set.padEnd(18)} ${P.res.join('x').padEnd(9)} -> mip ${T.albedo.level} ${T.albedo.w}x${T.albedo.h} -> ${SIDE}; metal ${mLo}..${mHi}, alpha ${aLo}..${aHi} -> B ${bHolds}; mean ${P.mean.join(',')} baked ${manifest.at(-1).bakedMean.join(',')}; z >= ${zMin.toFixed(3)}`);
}

// ---------------------------------------------------------------- 4. write
mkdirSync(OUT_BIN, { recursive: true });
writeFileSync(join(OUT_BIN, 'pbr-albedo.bin'), albedoBin);
writeFileSync(join(OUT_BIN, 'pbr-orm.bin'), ormBin);
const digest = (b) => sha256(Buffer.from(b.buffer, b.byteOffset, b.byteLength)).slice(0, 16);
const ts = `// GENERATED by tooling/city/vd-port/bake-pbr.mjs: do not edit by hand.
// The PBR texture sets the vd port's street props (pk), street life (lk) and elevated structures (vk) draw inside the
// bundled square, from Valdrada v0.4.0's material library (client/src/city/mat/pbrSets.js, MIT; the images CC0, per set
// below). One layer each in assets/pbr-albedo.bin and assets/pbr-orm.bin (RGBA8, ${SIDE} x ${SIDE}, rows bottom-up):
//   albedo  RGB the albedo (sRGB)   A the normal's X
//   orm     R AO  G roughness  B metalness ('metal') or the ORM alpha ('alpha'), see \`b\`   A the normal's Y
// size: metres per repeat [u, v] (pbrLib pbSize before opts.scale); mean: the packed albedo's linear mean (pbrLib's
// pbRatio reference); paintMean: a paint set's paint-cluster mean; alpha: what the ORM alpha holds ('height', 'paint',
// 'none'); metal: the constant metalness of a set whose B holds the alpha (metalLost: the set's metalness varied, this
// is its mean); alphaConst: the constant alpha of a set whose B holds the metalness; courses / bricks / halfBricks:
// the brick pattern (pbrLib's anti-tiling snap).

export const VD_PBR_LAYER_SIZE = ${SIDE};
export const VD_PBR_LAYERS = ${SETS.length};
/** Bytes of each .bin (RGBA8 x side^2 x layers) and their content digests (sha256, first 16 hex). */
export const VD_PBR_BIN = { albedo: { bytes: ${albedoBin.byteLength}, sha256: '${digest(albedoBin)}' }, orm: { bytes: ${ormBin.byteLength}, sha256: '${digest(ormBin)}' } } as const;

export interface VdPbrSet {
  set: string;
  layer: number;
  size: readonly [number, number];
  mean: readonly [number, number, number];
  meanHex: string;
  alpha: 'height' | 'paint' | 'none';
  roughMean: number | null;
  paintMean: readonly [number, number, number] | null;
  courses: number | null;
  bricks: number | null;
  halfBricks: boolean | null;
  b: 'metal' | 'alpha';
  metal: number | null;
  alphaConst: number | null;
  metalLost: { range: readonly [number, number]; nonZeroShare: number } | null;
  source: { id: string | null; url: string; licence: string; res: readonly [number, number]; level: number };
  bakedMean: readonly [number, number, number];
  zMin: number;
}

export const VD_PBR_SETS: readonly VdPbrSet[] = [
${manifest.map((m) => `  ${JSON.stringify(m).replace(/"([a-zA-Z]\w*)":/g, '$1: ').replace(/,(?=[a-z\[{'"-\d])/g, ', ').replace(/"/g, "'")}`).join(',\n')},
];

export const VD_PBR_SET_INDEX: Readonly<Record<string, number>> = Object.fromEntries(VD_PBR_SETS.map((s) => [s.set, s.layer]));
`;
writeFileSync(OUT_TS, ts);
console.log(`wrote ${OUT_BIN}/pbr-{albedo,orm}.bin: ${albedoBin.byteLength} + ${ormBin.byteLength} = ${albedoBin.byteLength + ormBin.byteLength} bytes; GPU with mips ${(gpuBytes(SIDE) / 1048576).toFixed(2)} MB`);
process.exit(0);   // pbrLib's texture pump keeps an interval alive
