import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { writeSurfaceAssets } from './write-surface-assets.mjs';
import { canonicalSurfaceJSON } from './surface-registry.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'source-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const geometryDir = join(root, 'geometry'), bankDir = join(root, 'bank'), outputDir = join(root, 'output');
  await mkdir(geometryDir); await mkdir(bankDir);
  const payload = Buffer.from('original authored pixels'), stored = gzipSync(payload), mesh = Buffer.from('authenticated VDN3 pack');
  const registryBody={coverage:{complete:true}};
  const registry={...registryBody,sha256:hash(Buffer.from(canonicalSurfaceJSON(registryBody)))};
  const page = { id: 7, sha256: hash(payload), sourceBytes: payload.length,
    storage: { encoding: 'gzip', sha256: hash(stored), fileBytes: stored.length, file: `${hash(stored)}.bin` } };
  const cell = { key: '-1_1-f0', sha256: hash(mesh), fileBytes: mesh.length, surface: { sha256: registry.sha256 } };
  await writeFile(join(geometryDir, 'registry.json'), JSON.stringify(registry));
  await writeFile(join(geometryDir, 'manifest.json'), JSON.stringify({ complete: true, cells: [cell] }));
  await writeFile(join(geometryDir, `${cell.key}.bin`), mesh);
  await writeFile(join(bankDir, 'manifest.json'), JSON.stringify({ complete: true, pages: [page] }));
  await writeFile(join(bankDir, page.storage.file), stored);
  return { geometryDir, bankDir, outputDir, admission: { materialBytes: 1024, budget: { geometryBytes: 1024, cellDraws: 2, triangles: 100 }, legacyMinimum: {geometryBytes:128,cellDraws:1,triangles:10} }, page, cell, stored, mesh, registry };
}
test('static Metro entry binds stored page identity, exact registry, and explicit residency limits', async t => {
  const f = await fixture(t), result = await writeSurfaceAssets(f);
  assert.deepEqual(result, { registrySha256: f.registry.sha256, pages: 1, cells: 1 });
  assert.deepEqual(await readFile(join(f.outputDir, 'pages', f.page.storage.file)), f.stored);
  assert.deepEqual(await readFile(join(f.outputDir, 'cells', `${f.cell.key}.bin`)), f.mesh);
  const entry = await readFile(join(f.outputDir, 'assets.ts'), 'utf8');
  assert.ok(entry.includes(`require('./pages/${f.page.storage.file}')`) || entry.includes(`require("./pages/${f.page.storage.file}")`));
  assert.ok(entry.includes('materialBytes: 1024'));
  assert.ok(entry.includes('readPage: (page, signal) => read(pages[page.id], signal)'));
  assert.ok(entry.includes('readCell: (cell, signal) => read(geometry[cell.key], signal)'));
});
test('corrupt or mismatched assets fail before publishing an entry', async t => {
  const f = await fixture(t);
  await writeFile(join(f.geometryDir, `${f.cell.key}.bin`), Buffer.from('corrupted'));
  await assert.rejects(writeSurfaceAssets(f), /cell asset hash mismatch/);
  await assert.rejects(access(join(f.outputDir, 'assets.ts')));
  await assert.rejects(writeSurfaceAssets({ ...f, admission: { materialBytes: 0, budget: f.admission.budget } }), /budgets are required/);
});
