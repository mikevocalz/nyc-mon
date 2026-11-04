import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfaceRegistry, canonicalSurfaceJSON } from './surface-registry.mjs';

const descriptor = uuid => ({ uuid, source: { shaderSha256: 'a'.repeat(64) }, state: { depthWrite: true }, textures: ['brick'] });
const registry = supported => new SurfaceRegistry({ source: { revision: 'pinned' }, textures: [{ id: 'brick', sha256: 'b'.repeat(64) }],
  identifyFamily: () => ({ name: 'source-brick', supported, requiredAttributes: ['uv'] }) });

test('material aliases share a descriptor while variants retain exact structure frames', () => {
  const r = registry(true);
  assert.deepEqual(r.registerMaterial(descriptor('one')), r.registerMaterial(descriptor('two')));
  assert.throws(() => r.material({ uuid: 'one' }, { attributes: {} }), /missing uv/);
  assert.equal(r.material({ uuid: 'two' }, { attributes: { uv: {} } }).material, 0);
  const original = r.variant(0, { aFkTr: [1, 0, 0] }, { isInstanced: false });
  const a = r.withSourceFrame(original, { baseY: 2, curb: .14, affine: [1, 1] });
  assert.equal(a, r.withSourceFrame(original, { baseY: 2, curb: .14, affine: [1, 1] }));
  const b = r.withSourceFrame(original, { baseY: 3, curb: .14, affine: [1, 1] });
  assert.notEqual(a, b);
  const result = r.finalize();
  assert.equal(result.materialCount, 1);
  assert.equal(result.coverage.complete, true);
  assert.equal(result.frames[result.variants[a].frame].sourceYOffset, 2 - .14);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test('unsupported programs and missing authored resources cannot publish complete assets', () => {
  const r = registry(false); r.registerMaterial(descriptor('one'));
  assert.equal(r.finalize().coverage.complete, false);
  const missing = registry(true);
  missing.registerMaterial({ ...descriptor('missing'), textures: ['absent'] });
  assert.throws(() => missing.finalize(), /Missing authored texture/);
  assert.throws(() => missing.registerMaterial({ source: { shaderSha256: 'short' } }), /SHA-256/);
});

test('identity is canonical and changes for source semantics or render state', () => {
  assert.equal(canonicalSurfaceJSON({ b: 2, a: 1 }), canonicalSurfaceJSON({ a: 1, b: 2 }));
  assert.throws(() => canonicalSurfaceJSON({ x: NaN }), /nonfinite/);
  const a = registry(true), b = registry(true);
  a.registerMaterial(descriptor('a'));
  b.registerMaterial({ ...descriptor('b'), state: { depthWrite: true, polygonOffset: true, polygonOffsetFactor: -2 } });
  assert.notEqual(a.finalize().sha256, b.finalize().sha256);
  b.source.revision = 'different';
  assert.notEqual(a.finalize().sha256, b.finalize().sha256);
});
test('table-driven opacity varies by descriptor without multiplying fixed-state draw families',()=>{
  const r=new SurfaceRegistry({source:{revision:'pinned'},identifyFamily:()=>({name:'shared',supported:true,renderState:{transparent:true,depthWrite:false}})});
  r.registerMaterial({uuid:'one',source:{shaderSha256:'a'.repeat(64)},state:{transparent:true,depthWrite:false,opacity:.2},textures:[]});
  r.registerMaterial({uuid:'two',source:{shaderSha256:'a'.repeat(64)},state:{transparent:true,depthWrite:false,opacity:.7},textures:[]});
  const result=r.finalize();
  assert.equal(result.materialCount,2);assert.equal(result.families.length,1);
  assert.equal(result.materials[0].state.opacity,.2);assert.equal(result.materials[1].state.opacity,.7);
});
test('shared variants retain exact material usage through source-frame merge and compaction',()=>{
 const r=new SurfaceRegistry({source:{revision:'fixture'},identifyFamily:()=>({name:'fixture',supported:true})});
 for(const sha of['a','b'])r.registerMaterial({source:{shaderSha256:sha.repeat(64)},state:{},textures:[]});
 const first=r.variant(0,{aFkTr:[1,1,1]},{hasInstanceColor:false});assert.equal(r.variant(1,{aFkTr:[1,1,1]},{hasInstanceColor:false}),first);
 const merged=r.withSourceFrame(first,{baseY:2,curb:.14,affine:{sx:1,sz:1,ox:0,oz:0}});const remap=r.retainVariants([merged]);
 assert.deepEqual(r.variants[remap.get(merged)].materials,[0,1]);assert.equal(r.variants.length,1);
});
