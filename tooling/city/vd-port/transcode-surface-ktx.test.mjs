import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{existsSync}from'node:fs';
import{loadSurfaceBasis,transcodeSurfaceKtx}from'./transcode-surface-ktx.mjs';
const input=new URL('../.cache/vd-pbr/alu_brushed/orm.ktx2',import.meta.url);
test('pinned real KTX retains every original mip, alpha and source PBR sampler in ASTC target',{skip:!existsSync(input)},async()=>{
 const{basis,provenance}=await loadSurfaceBasis(),bytes=await readFile(input),options={basis,sourceSha256:'7cfe3a17b6f9df0b48b2a5f32b488e7b812b95bd555e428163aed544114301de',set:'alu_brushed',role:'orm'};
 const first=transcodeSurfaceKtx(bytes,options),second=transcodeSurfaceKtx(bytes,options);
 assert.equal(first.texture.width,1024);assert.equal(first.texture.height,1024);assert.equal(first.texture.mipLevels.length,11);assert.equal(first.payload.length,1398128);
 assert.equal(first.texture.hasAlpha,true);assert.equal(first.texture.format,37808);assert.equal(first.texture.generateMipmaps,false);assert.equal(first.texture.wrapS,1000);assert.equal(first.texture.anisotropy,8);assert.equal(first.texture.colorSpace,'');
 assert.deepEqual(first.texture.basis,provenance);assert.deepEqual(first.payload,second.payload);
 assert.equal(first.texture.mipLevels.at(-1).byteLength,16);assert.equal(first.texture.mipLevels.at(-1).width,1);
 await assert.rejects(async()=>transcodeSurfaceKtx(bytes,{...options,sourceSha256:'0'.repeat(64)}),/integrity/);
});
