#!/usr/bin/env node
// validate-glb.mjs — Living City PR04 GLB import check, zero dependencies.
//
// Parses a GLB container by hand (12-byte header + length-prefixed chunks),
// then reads the JSON chunk for structural sanity: glTF version, mesh/
// accessor counts, declared POSITION bounds, animation clip names, a
// unit-scale heuristic (glTF is metres; a human ~10 units tall or a sedan
// ~450 units long means the export used centimetres/millimetres), and the
// attribute checks asset-pipeline.md calls out: triangle budget plus
// NORMAL/TEXCOORD_0 presence.
//
// Usage:
//   node tooling/assets/validate-glb.mjs <file.glb> [more.glb...]
//   node tooling/assets/validate-glb.mjs --json <file.glb>   # machine report
//   node tooling/assets/validate-glb.mjs --max-tris 200000 <file.glb>
//
// Exit code 1 if any file is structurally invalid. Descriptor-level rules
// (pivot, licence, registry chain) live in
// packages/app/features/game/living-city/asset-validation.ts — this tool
// only sees the bytes.

import { readFileSync } from 'node:fs';

const GLB_MAGIC = 0x46546c67; // 'glTF' little-endian
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

/**
 * Parse a GLB buffer into a report. Throws on structural errors.
 * @param {Buffer} buf
 */
export function parseGlb(buf, { maxTris = 100_000 } = {}) {
  if (buf.length < 12) throw new Error('file shorter than the 12-byte GLB header');
  const magic = buf.readUInt32LE(0);
  if (magic !== GLB_MAGIC) {
    throw new Error(`bad magic 0x${magic.toString(16)} — not a GLB (expected 'glTF')`);
  }
  const version = buf.readUInt32LE(4);
  const declaredLength = buf.readUInt32LE(8);
  if (version !== 2) throw new Error(`GLB container version ${version} — expected 2`);
  if (declaredLength !== buf.length) {
    throw new Error(`header length ${declaredLength} != file size ${buf.length} — truncated or padded file`);
  }

  const chunks = [];
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    if (offset + 8 + length > buf.length) {
      throw new Error(`chunk at ${offset} declares ${length} bytes past end of file`);
    }
    chunks.push({ type, length, offset: offset + 8 });
    offset += 8 + length;
  }
  if (offset !== buf.length) {
    throw new Error(`${buf.length - offset} trailing bytes after last chunk — malformed container`);
  }
  if (chunks.length === 0 || chunks[0].type !== CHUNK_JSON) {
    throw new Error('first chunk is not the required JSON chunk');
  }

  const json = JSON.parse(buf.subarray(chunks[0].offset, chunks[0].offset + chunks[0].length).toString('utf8'));
  const binBytes = chunks.filter((c) => c.type === CHUNK_BIN).reduce((n, c) => n + c.length, 0);

  // Union of every mesh primitive's POSITION accessor min/max — a rough
  // scene bounding box that ignores node transforms (note in report). The
  // same walk counts the attribute checks: triangles, missing NORMAL, and
  // TEXCOORD_0 gaps (a gap only fails when the material samples a texture —
  // untextured prims legitimately export without UVs).
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  let missingNormals = 0;
  let missingTexcoords = 0;
  let texturedWithoutUv = 0;
  let quantized = false;
  const accessors = json.accessors ?? [];
  const materials = json.materials ?? [];
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const acc = accessors[prim.attributes?.POSITION];
      if (acc?.min && acc?.max) {
        min = min.map((v, i) => Math.min(v, acc.min[i]));
        max = max.map((v, i) => Math.max(v, acc.max[i]));
        // KHR_mesh_quantization stores POSITION as normalized ints whose
        // min/max are integer units — the metres heuristic can't read them.
        if (acc.componentType !== 5126) quantized = true;
      }
      if ((prim.mode ?? 4) === 4) {
        triangles += prim.indices !== undefined
          ? (accessors[prim.indices]?.count ?? 0) / 3
          : (acc?.count ?? 0) / 3;
      }
      if (prim.attributes?.NORMAL === undefined) missingNormals++;
      if (prim.attributes?.TEXCOORD_0 === undefined) {
        missingTexcoords++;
        const mat = materials[prim.material];
        const maps = [mat?.pbrMetallicRoughness?.baseColorTexture,
          mat?.pbrMetallicRoughness?.metallicRoughnessTexture,
          mat?.normalTexture, mat?.occlusionTexture, mat?.emissiveTexture];
        if (maps.some(Boolean)) texturedWithoutUv++;
      }
    }
  }
  const hasBounds = Number.isFinite(min[0]);
  const size = hasBounds ? max.map((v, i) => v - min[i]) : null;
  const maxDim = hasBounds ? Math.max(...size) : null;

  const warnings = [];
  if (json.asset?.version !== '2.0') warnings.push(`asset.version '${json.asset?.version}' — expected '2.0'`);
  if (!hasBounds) warnings.push('no POSITION accessor min/max — bounds heuristic unavailable');
  // Metres heuristic: flag files whose largest extent screams centimetres
  // (>60 m) or millimetres (>6000), and sub-centimetre specks (<0.01 m).
  // Quantized positions live in integer units until the node scale
  // dequantizes them, so the heuristic skips those files entirely.
  if (!quantized) {
    if (maxDim !== null && maxDim > 60) {
      warnings.push(`largest mesh extent ${maxDim.toFixed(1)} units — likely not metres (a bus is ~12 m)`);
    }
    if (maxDim !== null && maxDim > 0 && maxDim < 0.01) {
      warnings.push(`largest mesh extent ${maxDim} units — implausibly small for metres`);
    }
  }
  if (triangles > maxTris) {
    warnings.push(`${triangles} triangles exceeds the ${maxTris} budget — bake tiers with tooling/assets/lod.mjs or pass --max-tris`);
  }
  if (missingNormals) {
    warnings.push(`${missingNormals} primitive(s) have no NORMAL — loaders must synthesize flat normals`);
  }
  if (texturedWithoutUv) {
    warnings.push(`${texturedWithoutUv} primitive(s) use a texture-mapped material but have no TEXCOORD_0 — the map cannot render`);
  }

  return {
    container: { version, declaredLength, chunks: chunks.length, jsonBytes: chunks[0].length, binBytes },
    asset: { version: json.asset?.version, generator: json.asset?.generator ?? null },
    counts: {
      meshes: (json.meshes ?? []).length,
      primitives: (json.meshes ?? []).reduce((n, m) => n + (m.primitives ?? []).length, 0),
      triangles,
      primitivesMissingNormals: missingNormals,
      primitivesMissingTexcoords: missingTexcoords,
      accessors: accessors.length,
      nodes: (json.nodes ?? []).length,
      animations: (json.animations ?? []).length,
      skins: (json.skins ?? []).length,
      images: (json.images ?? []).length,
    },
    animations: (json.animations ?? []).map((a) => a.name ?? '(unnamed)'),
    bounds: hasBounds
      ? {
        min, max, size, maxDim, quantized,
        note: quantized
          ? 'union of POSITION accessor min/max — quantized units, node transforms ignored'
          : 'union of POSITION accessor min/max — node transforms ignored',
      }
      : null,
    warnings,
  };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const files = [];
  let maxTris = 100_000;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') continue;
    if (a === '--max-tris') { maxTris = Number(args[++i]); continue; }
    if (a.startsWith('--')) { console.error(`unknown flag ${a}`); process.exit(2); }
    files.push(a);
  }
  if (!Number.isFinite(maxTris) || maxTris <= 0) {
    console.error(`--max-tris '${maxTris}' is not a positive number`);
    process.exit(2);
  }
  if (files.length === 0) {
    console.error('usage: node tooling/assets/validate-glb.mjs [--json] [--max-tris <n>] <file.glb> [...]');
    process.exit(2);
  }
  let failed = 0;
  for (const file of files) {
    try {
      const report = parseGlb(readFileSync(file), { maxTris });
      if (asJson) {
        console.log(JSON.stringify({ file, ok: true, ...report }));
      } else {
        console.log(`${file}: ok — glTF ${report.asset.version}, ${report.counts.meshes} mesh(es), ` +
          `${report.counts.animations} clip(s), ${report.container.chunks} chunk(s), ` +
          (report.bounds
            ? `extent ${report.bounds.size.map((v) => v.toFixed(2)).join('×')} ${report.bounds.quantized ? 'quantized units' : 'm'}`
            : 'no bounds'));
        for (const w of report.warnings) console.log(`  warning: ${w}`);
      }
      if (report.warnings.length) failed++; // warnings fail the gate too — import must be explicit
    } catch (err) {
      failed++;
      if (asJson) console.log(JSON.stringify({ file, ok: false, error: String(err.message ?? err) }));
      else console.error(`${file}: INVALID — ${err.message ?? err}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
