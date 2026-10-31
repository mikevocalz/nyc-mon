// Roundtrip test for the generic GLB LOD bake — node --test, no fixtures on
// disk: it hand-packs a heightfield GLB (the same container shape
// validate-glb.mjs reads) and bakes near/mid/far into a temp dir. The pins are
// verified the way cell-source verifies a download: re-hash the written bytes
// and compare against the manifest's sha256 + bytes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { bakeLods, glbTriangles } from './lod.mjs';
import { parseGlb } from './validate-glb.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');

/** Read the JSON chunk of a GLB buffer (validate-glb.mjs's chunk layout). */
const glbJson = (buf) => JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));

/**
 * A minimal but spec-valid GLB: one node, one mesh, one indexed TRIANGLES
 * primitive — a (2^n)×(2^n) heightfield, bumpy enough that the simplifier has
 * features to spend its budget on. POSITION carries min/max (required by the
 * spec and by validate-glb's bounds heuristic); indices are Uint16.
 */
function hillGlb(n = 24) {
  const side = n + 1;
  const pos = new Float32Array(side * side * 3);
  for (let z = 0; z < side; z++) {
    for (let x = 0; x < side; x++) {
      const i = z * side + x;
      pos[i * 3] = x / n - 0.5;
      pos[i * 3 + 1] = 0.08 * Math.sin((x / n) * Math.PI * 6) * Math.cos((z / n) * Math.PI * 4);
      pos[i * 3 + 2] = z / n - 0.5;
    }
  }
  const idx = new Uint16Array(n * n * 6);
  let t = 0;
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const a = z * side + x;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b;
      idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
  }
  const posBytes = Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength);
  const idxPad = (4 - (idx.byteLength & 3)) & 3;
  const idxBytes = Buffer.concat([Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength), Buffer.alloc(idxPad)]);
  const bin = Buffer.concat([posBytes, idxBytes]);
  const lo = [0, 1, 2].map((c) => Math.min(...pos.filter((_, i) => i % 3 === c)));
  const hi = [0, 1, 2].map((c) => Math.max(...pos.filter((_, i) => i % 3 === c)));
  const json = {
    asset: { version: '2.0', generator: 'lod.test.mjs hillGlb' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'hill' }],
    meshes: [{ name: 'hill', primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: side * side, type: 'VEC3', min: lo, max: hi },
      { bufferView: 1, componentType: 5123, count: idx.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length },
      { buffer: 0, byteOffset: posBytes.length, byteLength: idx.length * 2 },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  let jsonBuf = Buffer.from(JSON.stringify(json));
  const jpad = (4 - (jsonBuf.length & 3)) & 3;
  if (jpad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jpad, 0x20)]);
  const binPad = (4 - (bin.length & 3)) & 3;
  const binPadded = binPad ? Buffer.concat([bin, Buffer.alloc(binPad)]) : bin;
  const glb = Buffer.alloc(12 + 8 + jsonBuf.length + 8 + binPadded.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonBuf.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  jsonBuf.copy(glb, 20);
  const o = 20 + jsonBuf.length;
  glb.writeUInt32LE(binPadded.length, o);
  glb.writeUInt32LE(0x004e4942, o + 4);
  binPadded.copy(glb, o + 8);
  return glb;
}

const SOURCE_TRIS = 24 * 24 * 2;

test('hillGlb fixture is itself a valid, warning-free GLB', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'lod-fixture-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'hill.glb');
  await writeFile(file, hillGlb());
  const report = parseGlb(await readFile(file));
  assert.equal(report.asset.version, '2.0');
  assert.equal(report.counts.meshes, 1);
  assert.deepEqual(report.warnings, []);
  assert.equal(glbTriangles(glbJson(await readFile(file))), SOURCE_TRIS);
});

test('bakeLods writes descending tiers and a manifest whose pins re-hash', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'lod-bake-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, 'hill.glb');
  await writeFile(input, hillGlb());
  const manifestPath = join(dir, 'hill.lod.json');

  const { manifest } = bakeLods(input, { out: dir, manifestPath });
  assert.deepEqual(Object.keys(manifest.tiers), ['near', 'mid', 'far']);

  // Input pin matches a re-hash of the source bytes.
  const inBuf = await readFile(input);
  assert.equal(manifest.input.path, input);
  assert.equal(manifest.input.sha256, sha(inBuf));
  assert.equal(manifest.input.bytes, inBuf.length);

  const counts = {};
  for (const tier of ['near', 'mid', 'far']) {
    const file = join(dir, `hill.${tier}.glb`);
    const buf = await readFile(file);
    // Every tier is a valid GLB with the fixture's single mesh and no warnings.
    const report = parseGlb(buf);
    assert.equal(report.counts.meshes, 1, `${tier} keeps the mesh`);
    assert.deepEqual(report.warnings, [], `${tier} parses clean`);
    counts[tier] = glbTriangles(glbJson(buf));
    // The manifest pin is what was written — path, sha256, bytes (the
    // write-cells-manifest.mjs record shape).
    const pin = manifest.tiers[tier];
    assert.equal(pin.path, `hill.${tier}.glb`);
    assert.equal(pin.sha256, sha(buf), `${tier} sha256 re-hashes`);
    assert.equal(pin.bytes, buf.length, `${tier} byteLength matches`);
    assert.equal(pin.triangles, counts[tier], `${tier} manifest triangle count is the accessor truth`);
    assert.ok(pin.simplifierMs >= 0);
  }

  assert.equal(counts.near, SOURCE_TRIS, 'near (ratio 1.0) keeps every triangle');
  assert.ok(counts.mid < counts.near, `mid ${counts.mid} < near ${counts.near}`);
  assert.ok(counts.far < counts.mid, `far ${counts.far} < mid ${counts.mid}`);
  assert.ok(counts.mid <= SOURCE_TRIS * 0.25 * 1.5, `mid ${counts.mid} is in the 0.25-ratio neighbourhood`);
});

test('a re-run merges into the existing manifest instead of clobbering it', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'lod-merge-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, 'hill.glb');
  await writeFile(input, hillGlb());
  const manifestPath = join(dir, 'hill.lod.json');

  bakeLods(input, { out: dir, tiers: ['mid'], ratios: [0.25], manifestPath });
  const { manifest } = bakeLods(input, { out: dir, tiers: ['far'], ratios: [0.05], manifestPath });
  assert.deepEqual(Object.keys(manifest.tiers).sort(), ['far', 'mid'], 'the second run kept the first run\'s tier');
  for (const tier of ['mid', 'far']) {
    const buf = await readFile(join(dir, `hill.${tier}.glb`));
    assert.equal(manifest.tiers[tier].sha256, sha(buf));
  }
});
