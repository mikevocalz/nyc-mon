#!/usr/bin/env node
// lod.mjs — generic per-GLB LOD bake: one GLB in, near/mid/far GLBs plus a
// sha256-pinned manifest out. Closes gap 1 of docs/implementation/asset-pipeline.md
// ("no per-GLB LOD0/1/2 generation"): the city bakes decimate near/mid/far index
// lists by hand (bake-cars.mjs buildLevels, vd-port harvest.js simplifyTo); this
// is the same pattern made generic for any GLB the asset lane ships.
//
// The decimation touches index lists only. Each tier is a byte-for-byte clone of
// the input's JSON + BIN with every triangle primitive's `indices` repointed at
// a fresh, simplified Uint32 accessor appended to the BIN chunk. Positions,
// normals, UVs, skins, morph targets and animations are never re-encoded, so a
// skinned GLB keeps working (the JOINTS/WEIGHTS stream is untouched) and nothing
// downstream has to re-decode an attribute. A primitive without POSITION, or a
// non-triangle mode, passes through unsimplified; a primitive the accessor
// reader can't decode fails the whole bake rather than emitting a broken file.
//
// Reads what the repo already reads: plain buffer views, KHR_mesh_quantization
// component types (decoded to float for the simplifier — normalisation is
// uniform, so the decimation sees true proportions) and EXT_meshopt_compression
// views (MeshoptDecoder); the decode path is bake-cars.mjs openGlb's. Writes
// plain uncompressed index views — Hermes never has to decode anything
// (asset-pipeline.md "Notes for lanes") — and when the input is meshopt-
// compressed the buffer gains EXT_meshopt_compression.fallback so the mixed
// compressed/plain view set stays legal.
//
// The manifest pins { path, sha256, bytes } per tier the way
// write-cells-manifest.mjs pins cells, plus triangles/ratio/simplifierMs for
// the audit. Tier names are the bake vocabulary: near/mid/far — `mid` is the
// asset-validation.ts descriptor tier `medium` (LOD_TIERS, asset-validation.ts:117).
//
// Usage:
//   node tooling/assets/lod.mjs <input.glb> [--out <dir>] [--tiers near,mid,far]
//       [--ratios 1.0,0.25,0.05] [--manifest <path>]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseGlb } from './validate-glb.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

// meshoptimizer is a transitive dependency — resolve it the way bake-cars.mjs
// does instead of pinning an absolute .pnpm path.
const pnpm = join(REPO, 'node_modules/.pnpm');
const meshoptDir = readdirSync(pnpm).find((d) => d.startsWith('meshoptimizer@'));
if (!meshoptDir) throw new Error('meshoptimizer not found under node_modules/.pnpm — run pnpm install');
const meshoptBase = join(pnpm, meshoptDir, 'node_modules/meshoptimizer');
const { MeshoptDecoder } = await import(pathToFileURL(join(meshoptBase, 'meshopt_decoder.mjs')).href);
await MeshoptDecoder.ready;
const { MeshoptSimplifier } = await import(pathToFileURL(join(meshoptBase, 'meshopt_simplifier.js')).href);
await MeshoptSimplifier.ready;

const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * Container check + decode handles, bake-cars.mjs openGlb's path: parseGlb
 * rejects a malformed container first, then `read(ai)` decodes any accessor
 * (plain, quantized or meshopt-compressed view) to a plain Float32Array.
 */
export function openGlb(file) {
  const b = readFileSync(file);
  const report = parseGlb(b); // throws on a bad container before we trust the chunk table
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString());
  const binOff = 20 + jl + 8;
  if (binOff + 8 > b.length) throw new Error(`${file}: no BIN chunk — external buffers are not supported`);
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
    if (!a) throw new Error(`accessor ${ai} missing`);
    if (a.sparse) throw new Error(`accessor ${ai} is sparse — sparse overrides are not supported`);
    if (a.bufferView === undefined) throw new Error(`accessor ${ai} has no bufferView — default-filled accessors are not supported`);
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
  return { j, bin, read, report };
}

/** Triangles in a parsed glTF JSON: indexed count, else POSITION count / 3. */
export function glbTriangles(j) {
  let tris = 0;
  for (const mesh of j.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      if ((prim.mode ?? 4) !== 4) continue;
      if (prim.indices !== undefined) tris += (j.accessors[prim.indices]?.count ?? 0) / 3;
      else tris += (j.accessors[prim.attributes?.POSITION]?.count ?? 0) / 3;
    }
  }
  return tris;
}

/**
 * Exact→sloppy decimation toward a triangle target, harvest.js simplifyTo's
 * shape: meshopt's error-bounded simplify first (Prune drops unreachable
 * interior), escalating the bound while it stalls on open borders, then
 * sloppy clustering as the fallback. Returns the new index list.
 */
function simplifyIndices(indices, pos, targetTris) {
  const want = Math.max(3, Math.round(targetTris) * 3);
  if (indices.length <= want) return { indices, how: 'copy' };
  // The index target is a cap, not a floor: keep the largest result at or
  // under `want`, or — while the simplifier stalls on open borders above it —
  // the smallest over. `Prune` can empty a whole fragmented primitive at a
  // loose bound; an emptied index list never qualifies (shipping the prim
  // unsimplified beats dropping it). Sloppy clustering is the fallback for
  // border-stalled prims, harvest.js simplifyTo's shape.
  let under = null; // largest result <= want
  let over = null; // smallest result > want
  const take = (out) => {
    if (out.length === 0) return;
    if (out.length <= want) { if (!under || out.length > under.length) under = out; }
    else if (!over || out.length < over.length) over = out;
  };
  let how = 'simplify';
  for (let tries = 0, e = 0.001; !under && tries++ < 14 && e <= 1; e *= 1.7) {
    take(MeshoptSimplifier.simplify(indices, pos, 3, want, e, ['Prune'])[0]);
  }
  if (!under) {
    how = 'sloppy';
    for (let tries = 0, e = 0.004; !under && tries++ < 12; e *= 1.6) {
      take(MeshoptSimplifier.simplifySloppy(indices, pos, 3, null, want, e)[0]);
    }
  }
  const best = under ?? over;
  if (!best || best.length >= indices.length) return { indices, how: 'copy' };
  return { indices: best, how };
}

/**
 * Clone the glTF, repoint every triangle primitive at a simplified Uint32
 * index accessor appended to the BIN chunk, and repack the GLB. Everything
 * else — attributes, materials, skins, animations — is the input's bytes.
 */
function buildTier(j, bin, read, ratio) {
  const json = JSON.parse(JSON.stringify(j));
  const parts = [bin];
  let binLen = bin.length;
  const align = () => {
    const pad = (4 - (binLen & 3)) & 3;
    if (pad) { parts.push(Buffer.alloc(pad)); binLen += pad; }
  };
  let triangles = 0;
  let simplifierMs = 0;
  const hows = new Set();
  const passthrough = [];
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      if ((prim.mode ?? 4) !== 4) continue; // points/lines/tri-strips keep their index data
      const posAi = prim.attributes?.POSITION;
      if (posAi === undefined) { passthrough.push('no POSITION'); continue; }
      const pos = read(posAi);
      const src = prim.indices !== undefined
        ? Uint32Array.from(read(prim.indices))
        : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
      const t0 = performance.now();
      const { indices, how } = ratio >= 1 ? { indices: src, how: 'copy' } : simplifyIndices(src, pos, (src.length / 3) * ratio);
      simplifierMs += performance.now() - t0;
      hows.add(how);
      align();
      json.bufferViews.push({ buffer: 0, byteOffset: binLen, byteLength: indices.byteLength });
      parts.push(Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength));
      binLen += indices.byteLength;
      prim.indices = json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: 5125, count: indices.length, type: 'SCALAR' }) - 1;
      triangles += indices.length / 3;
    }
  }

  // Our appended views are plain; on a meshopt-compressed input the buffer must
  // declare the fallback or strict loaders skip the uncompressed half.
  if ((json.extensionsUsed ?? []).includes('EXT_meshopt_compression')) {
    const buf = json.buffers[0];
    buf.extensions = { ...(buf.extensions ?? {}), EXT_meshopt_compression: { ...(buf.extensions?.EXT_meshopt_compression ?? {}), fallback: true } };
  }
  delete json.buffers[0].uri; // a GLB's buffer 0 is the BIN chunk
  json.buffers[0].byteLength = binLen;

  let jsonBuf = Buffer.from(JSON.stringify(json));
  const jpad = (4 - (jsonBuf.length & 3)) & 3;
  if (jpad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jpad, 0x20)]);
  let newBin = Buffer.concat(parts);
  const bpad = (4 - (newBin.length & 3)) & 3;
  if (bpad) newBin = Buffer.concat([newBin, Buffer.alloc(bpad)]);

  const glb = Buffer.alloc(12 + 8 + jsonBuf.length + 8 + newBin.length);
  glb.writeUInt32LE(0x46546c67, 0); // 'glTF'
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonBuf.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
  jsonBuf.copy(glb, 20);
  const o = 20 + jsonBuf.length;
  glb.writeUInt32LE(newBin.length, o);
  glb.writeUInt32LE(0x004e4942, o + 4); // 'BIN\0'
  newBin.copy(glb, o + 8);
  parseGlb(glb); // repack sanity: the same container check validate-glb runs
  return { glb, triangles, simplifierMs, how: [...hows].join('+'), passthrough };
}

/**
 * Bake every requested tier of `input` into `out` and write/merge the manifest.
 * Returns the manifest object.
 */
export function bakeLods(input, { out, tiers = ['near', 'mid', 'far'], ratios = [1, 0.25, 0.05], manifestPath } = {}) {
  if (!input || !/\.glb$/i.test(input)) throw new Error(`input '${input}' is not a .glb`);
  if (tiers.length !== ratios.length) throw new Error(`--tiers (${tiers.length}) and --ratios (${ratios.length}) must pair up`);
  for (const r of ratios) if (!Number.isFinite(r) || r <= 0 || r > 1) throw new Error(`ratio ${r} outside (0, 1]`);
  if (new Set(tiers).size !== tiers.length) throw new Error(`duplicate tier in --tiers ${tiers.join(',')}`);

  const name = basename(input).replace(/\.glb$/i, '');
  out = out ?? dirname(input);
  manifestPath = manifestPath ?? join(out, `${name}.lod.json`);
  mkdirSync(out, { recursive: true });

  const { j, bin, read, report } = openGlb(input);
  for (const w of report.warnings) console.warn(`  warning: ${w}`);
  const skinned = (j.skins ?? []).length > 0;
  if (skinned || (j.animations ?? []).length > 0) {
    // Safe by construction: only index lists are rewritten, so joints/weights
    // and every clip keep addressing the same vertices.
    console.log(`  ${j.skins?.length ?? 0} skin(s), ${j.animations?.length ?? 0} clip(s) — preserved verbatim (index-only decimation)`);
  }

  const inBuf = readFileSync(input);
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  manifest.input = { path: input, sha256: sha256(inBuf), bytes: inBuf.length };
  manifest.tiers = { ...(manifest.tiers ?? {}) };

  const results = [];
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const file = join(out, `${name}.${tier}.glb`);
    const { glb, triangles, simplifierMs, how, passthrough } = buildTier(j, bin, read, ratios[i]);
    writeFileSync(file, glb);
    manifest.tiers[tier] = {
      path: `${name}.${tier}.glb`,
      sha256: sha256(glb),
      bytes: glb.length,
      triangles,
      ratio: ratios[i],
      simplifierMs: Math.round(simplifierMs * 10) / 10,
    };
    results.push({ tier, file, triangles, how, passthrough });
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { manifest, manifestPath, results };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  let input; let out; let tiers = 'near,mid,far'; let ratios = '1.0,0.25,0.05'; let manifestPath;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') out = args[++i];
    else if (a === '--tiers') tiers = args[++i];
    else if (a === '--ratios') ratios = args[++i];
    else if (a === '--manifest') manifestPath = args[++i];
    else if (a.startsWith('--')) { console.error(`unknown flag ${a}`); process.exit(2); }
    else if (!input) input = a;
    else { console.error(`unexpected extra argument '${a}'`); process.exit(2); }
  }
  if (!input) {
    console.error('usage: node tooling/assets/lod.mjs <input.glb> [--out <dir>] [--tiers near,mid,far] [--ratios 1.0,0.25,0.05] [--manifest <path>]');
    process.exit(2);
  }
  try {
    const { manifest, manifestPath: mPath, results } = bakeLods(input, {
      out,
      tiers: tiers.split(',').map((s) => s.trim()).filter(Boolean),
      ratios: ratios.split(',').map(Number),
      manifestPath,
    });
    for (const r of results) {
      console.log(`${r.file}: ${r.triangles} tris (${r.how})`);
      for (const p of r.passthrough) console.log(`  passthrough: ${p}`);
    }
    console.log(`${mPath}: ${Object.keys(manifest.tiers).length} tier(s) pinned`);
  } catch (err) {
    console.error(`${input}: FAILED — ${err.message ?? err}`);
    process.exit(1);
  }
}
