import test from 'node:test';
import assert from 'node:assert/strict';
import { registryFromCapture } from './surface-capture.mjs';
const capture = () => ({ sourcePin: 'pinned', bakeThree: '0.185.1', tiles: [{ key:'0_0',
  textures: [{ uuid:'t',sha256:'b'.repeat(64),format:1023,type:1009,width:1,height:1,mipLevels:[{width:1,height:1,byteOffset:0,byteLength:4}],sourceBytes:4,matrix:[1,0,0,0,1,0,0,0,1],wrapS:1000 }],
  materials: [{uuid:'used',type:'MeshStandardMaterial',key:'authored',maps:{map:'t'},shader:{sha256:'a'.repeat(64),hash:'abc',uniforms:{}},color:[2,1,1],polygonOffset:true},
    {uuid:'unused',maps:{},shader:{sha256:'c'.repeat(64),hash:'def',uniforms:{}}}],
  surfaceVariants:[{fields:{aFkTr:[1,2,3]},frame:{isInstanced:false}}],
  surfaces:[{id:'actual',base:2,surface:{vertices:[{material:0,variant:0,renderOrder:0,castShadow:true,receiveShadow:true,position:[1,2,3]}],indices:[0,0,0],families:[0]}}],
}] });
test('live capture preserves payload bindings and only classifies actual geometry materials',()=>{
  const seen=[];
  const result=registryFromCapture(capture(),{identifyFamily:d=>{seen.push(d);return{name:'actual',supported:true};}});
  assert.equal(seen.length,1);
  assert.deepEqual(seen[0].color,[2,1,1]);
  assert.equal(seen[0].state.polygonOffset,true);
  assert.equal(seen[0].textureBindings.map.texture,0);
  assert.equal(seen[0].textureBindings.map.wrapS,1000);
  assert.deepEqual(result.structures[0].surface.families,[0]);
  assert.deepEqual(result.registry.finalize().textures[0].mipLevels,[{width:1,height:1,byteOffset:0,byteLength:4}]);
});
test('missing or weak captured resources fail before an asset can be emitted',()=>{
  const missing=capture();missing.tiles[0].materials[0].maps.map='missing';
  assert.throws(()=>registryFromCapture(missing,{identifyFamily:()=>({name:'actual',supported:true})}),/Missing captured texture/);
  const weak=capture();weak.tiles[0].textures[0].sha256='weak';
  assert.throws(()=>registryFromCapture(weak,{identifyFamily:()=>({name:'actual',supported:true})}),/strong identity/);
});
test('complete-cell selection uses the same centroid ownership as the writer',()=>{
  const identity={sx:1,sz:1,ox:0,oz:0};
  const options={identifyFamily:()=>({name:'actual',supported:true}),affine:identity};
  const included=registryFromCapture(capture(),{...options,cell:{cx:0,cz:0}});
  assert.equal(included.structures[0].surface.indices.length,3);
  assert.deepEqual(included.registry.finalize().source.selection,{kind:'complete-cell',cx:0,cz:0});
  const excluded=registryFromCapture(capture(),{...options,cell:{cx:1,cz:0}});
  assert.equal(excluded.structures.length,0);
  assert.equal(excluded.registry.finalize().materialCount,0);
  assert.equal(excluded.registry.finalize().coverage.complete,false);
});
test('transient Three texture and material UUIDs do not change registry identity',()=>{
  const a=capture(),b=capture();
  a.tiles[0].materials[0].shader.uniforms={authoredMap:{texture:'t'},cityAO:{dynamic:'cityAO',initial:{texture:'t'}}};
  b.tiles[0].materials[0].uuid='other-material';
  b.tiles[0].textures[0].uuid='other-texture';b.tiles[0].materials[0].maps.map='other-texture';
  b.tiles[0].materials[0].shader.uniforms={authoredMap:{texture:'other-texture'},cityAO:{dynamic:'cityAO',initial:{texture:'other-texture'}}};
  const options={identifyFamily:()=>({name:'actual',supported:true}),semanticTextures:[{id:1,sha256:'d'.repeat(64)}],resolveTextureBinding:()=>({texture:1})};
  assert.equal(registryFromCapture(a,options).registry.finalize().sha256,registryFromCapture(b,options).registry.finalize().sha256);
});
test('family-required source attributes must be present, not supplied as fabricated defaults',()=>{
  assert.throws(()=>registryFromCapture(capture(),{identifyFamily:()=>({name:'actual',supported:true,requiredAttributes:['uv']})}),/missing uv/);
  const valid=capture();valid.tiles[0].surfaces[0].surface.vertices[0].flags=1;
  assert.doesNotThrow(()=>registryFromCapture(valid,{identifyFamily:()=>({name:'actual',supported:true,requiredAttributes:['uv','aFkTr']})}));
});
test('semantic uniforms require actual pages and keep initial placeholders out of residency refs',()=>{
  const source=capture();source.tiles[0].materials[0].maps={};
  source.tiles[0].materials[0].shader.uniforms={cityAO:{dynamic:'cityAO',initial:{texture:'t'}}};
  const classifier=()=>({name:'actual',supported:true});
  assert.throws(()=>registryFromCapture(source,{identifyFamily:classifier}),/actual resource binding/);
  const result=registryFromCapture(source,{identifyFamily:classifier,semanticTextures:[{id:1,sha256:'e'.repeat(64)}],resolveTextureBinding:()=>({texture:1})});
  assert.deepEqual(result.registry.textureRefs(0),[1]);
  assert.equal(result.registry.materials[0].shader.uniforms.cityAO.initial.texture,0);
  assert.equal(result.registry.materials[0].shader.uniforms.cityAO.binding.texture,1);
});
test('one source material used at distinct render orders retains separate draw families',()=>{
  const source=capture();const surface=source.tiles[0].surfaces[0].surface;
  surface.vertices.push({...surface.vertices[0],renderOrder:9});surface.indices=[0,0,0,1,1,1];surface.families=[0,0];
  const {registry,structures}=registryFromCapture(source,{identifyFamily:d=>({name:'actual',supported:true,staticFlags:{renderOrder:d.renderOrder}})});
  assert.equal(registry.families.length,2);assert.deepEqual(registry.families.map(f=>f.staticFlags.renderOrder),[0,9]);
  assert.notEqual(structures[0].surface.families[0],structures[0].surface.families[1]);
  delete surface.vertices[0].renderOrder;
  assert.throws(()=>registryFromCapture(source,{identifyFamily:()=>({name:'actual',supported:true})}),/renderOrder was not captured/);
});
test('normalization registers every material using an identical raw constant variant',()=>{
 const source=capture(),surface=source.tiles[0].surfaces[0].surface;
 surface.vertices.push({...surface.vertices[0],material:1});surface.indices=[0,0,0,1,1,1];surface.families=[0,0];
 const {registry}=registryFromCapture(source,{identifyFamily:()=>({name:'fixture',supported:true})});
 assert.equal(registry.variants.length,1);assert.deepEqual(registry.variants[0].materials,[0,1]);
});
