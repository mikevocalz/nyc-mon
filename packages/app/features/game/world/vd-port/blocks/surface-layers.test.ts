import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { registerSurfaceLayers, type SurfaceCellInfo } from './surface-layers.ts';
import { createNearCohortMask } from './cohort-mask.ts';
import type { createSurfaceMaterialBank } from './surface-material-bank.ts';
import type { VdPortCtx } from '../types.ts';
import type { ExternalLayer } from '../../cells/cell-stream.ts';

const require = createRequire(import.meta.url), meshoptRequire = createRequire(require.resolve('@types/three/package.json'));
const { MeshoptEncoder } = await import(pathToFileURL(meshoptRequire.resolve('meshoptimizer')).href);
const { encodeSurfaceCell } = await import(new URL('../../../../../../../tooling/city/vd-port/surface-codec.mjs', import.meta.url).href);
const hash = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const registry = { sha256: 'ab'.repeat(32), materialCount: 2, variantCount: 1 };
async function fixture() {
  const files = new Map<string, Uint8Array>(), cells: SurfaceCellInfo[] = [];
  for (let family = 0; family < 2; family++) {
    const x = family * 40 + 1;
    const vertices = [[x, 1, 1], [x + 1, 1, 1], [x, 2, 1]].map((position) => ({ position, normal: [0, 0, 1], uv: [0, 0], color: [1, 1, 1], material: family, variant: 0, grime: 0, weather: [0, 0, 4, -1], flags: 63 }));
    const encoded: { bytes: Uint8Array } = await encodeSurfaceCell({ cx: 0, cz: 0, vertices, indices: [0, 1, 2], registry, encoder: MeshoptEncoder });
    const key = `0_0-f${family}`; files.set(key, encoded.bytes);
    cells.push({ key, family, cx: 0, cz: 0, vertices: 3, triangles: 1, wide: false, bounds: [x, 1, 1, x + 1, 2, 1], bytes: 234,
      textures: [], materials: [family], variants: [0], surface: registry, fileBytes: encoded.bytes.length, sha256: await hash(encoded.bytes) });
  }
  const group = new THREE.Group(), layers: ExternalLayer[] = [];
  const ctx = { THREE, group, registerChunks: (template: ExternalLayer['template'], spec: ExternalLayer['spec'], packages: ExternalLayer['packages'], budget?: ExternalLayer['budget']) => layers.push({ template, spec, packages, budget }) } as unknown as VdPortCtx;
  const materials = [new THREE.MeshStandardNodeMaterial(), new THREE.MeshStandardNodeMaterial()];
  let releases = 0;
  const bank = { material: (family: number) => materials[family], renderOrder: () => 2, shadowFlags: () => ({ cast: true, receive: false }), resources() {
    let held = false;
    return { ready: () => held, prefetch: async () => (held = true), release() { if (held) { held = false; releases++; } } };
  } } as unknown as Awaited<ReturnType<typeof createSurfaceMaterialBank>>;
  const lease = { ready: () => true } as ReturnType<typeof bank.lease>;
  const budget = { name: 'source-test', geometryBytes: 468, cellDraws: 2, triangles: 2, vertices: 6 };
  return { cells, files, group, layers, ctx, materials, bank, lease, budget, releases: () => releases };
}

test('family registration shares exact cohort demand/admission while keeping actual geometry bounds and ready bytes', async () => {
  const f = await fixture();
  const part = await registerSurfaceLayers(f.ctx, { ...f, cohorts: createNearCohortMask(), layer: { errorM: 0.09, chunk: 128, fade: true },
    readCell: async (info) => f.files.get(info.key)!, sha256Hex: hash });
  assert.equal(f.layers.length, 2);
  assert.equal(f.layers[0]!.budget, f.budget); assert.equal(f.layers[1]!.budget, f.budget);
  const a = f.layers[0]!.packages[0]!, b = f.layers[1]!.packages[0]!;
  assert.equal(a.group, b.group); assert.equal(a.demandBounds, b.demandBounds);
  assert.deepEqual(Array.from(a.demandBounds!), [1, 1, 1, 42, 2, 1]);
  assert.notDeepEqual(a.bounds, b.bounds);
  assert.equal(a.ready?.(), true); assert.equal(b.ready?.(), true);
  f.files.get(f.cells[0]!.key)![0] = 0;
  assert.equal(a.prepare?.(Infinity, () => 0), true);
  assert.equal(a.attributes.position!.array.length, 9, 'START uses its verified snapshot even if an external byte owner mutates');
  assert.ok(f.layers.every((layer) => layer.template.renderOrder === 2));
  assert.ok(f.layers.every((layer) => layer.template.castShadow && !layer.template.receiveShadow));
  part.dispose(); part.dispose();
  assert.equal(f.group.children.length, 0); assert.equal(f.releases(), 2);
  for (const material of f.materials) material.dispose();
});

test('abort between page acquisition and package creation releases the immediately owned lease', async () => {
  const f = await fixture(), controller = new AbortController();
  let finish!: (ready: boolean) => void, started!: () => void, released = 0;
  const acquired = new Promise<void>((resolve) => { started = resolve; });
  const bank = { ...f.bank, resources() {
    let held = true;
    return { error: null, ready: () => held, prefetch: () => new Promise<boolean>((resolve) => { finish = resolve; started(); }),
      release() { if (held) { held = false; released++; } } };
  } } as typeof f.bank;
  const pending = registerSurfaceLayers(f.ctx, { ...f, bank, signal: controller.signal, cohorts: createNearCohortMask(),
    layer: { errorM: 0.09, chunk: 128, fade: true }, readCell: async (info) => f.files.get(info.key)!, sha256Hex: hash });
  await acquired; controller.abort(); finish(true);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(released, 1); assert.equal(f.group.children.length, 0); assert.equal(f.layers.length, 0);
  for (const material of f.materials) material.dispose();
});

test('insufficient whole-cohort budgets fail before IO and never register a partial facade', async () => {
  const f = await fixture(); let reads = 0;
  await assert.rejects(registerSurfaceLayers(f.ctx, { ...f, budget: { ...f.budget, cellDraws: 1 }, cohorts: createNearCohortMask(),
    layer: { errorM: 0.09, chunk: 128, fade: true }, readCell: async (info) => { reads++; return f.files.get(info.key)!; }, sha256Hex: hash }), /complete authored source cohort/);
  assert.equal(reads, 0); assert.equal(f.layers.length, 0); assert.equal(f.group.children.length, 0);
  for (const material of f.materials) material.dispose();
});

test('authentic page and geometry readiness cannot register visible packages before template compilation', async () => {
  const f = await fixture();let finish!:()=>void,entered!:()=>void;
  const compiling=new Promise<void>(resolve=>{entered=resolve;});
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  const pending=registerSurfaceLayers(f.ctx,{...f,cohorts:createNearCohortMask(),layer:{errorM:.09,chunk:128,fade:true},
    readCell:async info=>f.files.get(info.key)!,sha256Hex:hash,async prepareTemplates(templates){assert.equal(templates.length,2);assert.equal(f.layers.length,0);entered();await gate;}});
  await compiling;assert.equal(f.layers.length,0);finish();const part=await pending;
  assert.equal(f.layers.length,2);part.dispose();for(const material of f.materials)material.dispose();
});

test('cancellation during compilation disposes real template resources and cannot register late', async () => {
  const f=await fixture(),controller=new AbortController();let finish!:()=>void,entered!:()=>void;
  const compiling=new Promise<void>(resolve=>{entered=resolve;});
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  const pending=registerSurfaceLayers(f.ctx,{...f,signal:controller.signal,cohorts:createNearCohortMask(),layer:{errorM:.09,chunk:128,fade:true},
    readCell:async info=>f.files.get(info.key)!,sha256Hex:hash,async prepareTemplates(){entered();await gate;}});
  await compiling;controller.abort();finish();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(f.layers.length,0);assert.equal(f.group.children.length,0);assert.equal(f.releases(),2);
  for(const material of f.materials)material.dispose();
});

test('actual eviction drops verified binary snapshots and returning packages authenticate bytes again',async()=>{
 const f=await fixture();let reads=0;
 const part=await registerSurfaceLayers(f.ctx,{...f,cohorts:createNearCohortMask(),layer:{errorM:.09,chunk:128,fade:true},
  readCell:async info=>{reads++;return f.files.get(info.key)!;},sha256Hex:hash});
 const pkg=part.packages[0]!;assert.equal(reads,2);pkg.release?.();assert.equal(pkg.ready?.(),true,'CPU upload release keeps the live texture cohort');
 pkg.releaseResources?.();assert.equal(pkg.ready?.(),false);assert.equal(await pkg.prefetch?.(true),true);assert.equal(reads,3);
 assert.equal(pkg.prepare?.(Infinity,()=>0),true);part.dispose();for(const material of f.materials)material.dispose();
});

test('concurrent prefetch shares one read/hash per epoch and a stale settlement cannot clear a replacement request',async()=>{
 const f=await fixture();let reads=0,hashes=0;
 const incoming:{resolve:(bytes:Uint8Array)=>void}[]=[];
 const part=await registerSurfaceLayers(f.ctx,{...f,cohorts:createNearCohortMask(),layer:{errorM:.09,chunk:128,fade:true},
  async readCell(info){reads++;if(reads<=2)return f.files.get(info.key)!;return new Promise<Uint8Array>(resolve=>{incoming.push({resolve});});},
  async sha256Hex(bytes){hashes++;return hash(bytes);}});
 const pkg=part.packages[0]!;pkg.releaseResources?.();
 const first=pkg.prefetch?.(true),same=pkg.prefetch?.(true);assert.equal(first,same);assert.equal(reads,3);assert.equal(hashes,2);
 pkg.releaseResources?.();
 const replacement=pkg.prefetch?.(true);assert.notEqual(replacement,first);assert.equal(reads,4);
 incoming[0]!.resolve(f.files.get(f.cells[0]!.key)!);assert.equal(await first,false);assert.equal(hashes,3);
 const sameReplacement=pkg.prefetch?.(true);assert.equal(sameReplacement,replacement,'old finally must not clear newer epoch pending');assert.equal(reads,4);
 incoming[1]!.resolve(f.files.get(f.cells[0]!.key)!);assert.equal(await replacement,true);assert.equal(hashes,4);
 assert.equal(pkg.ready?.(),true);assert.equal(pkg.prepare?.(Infinity,()=>0),true);
 part.dispose();for(const material of f.materials)material.dispose();
});
