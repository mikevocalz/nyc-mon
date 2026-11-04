import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MeshoptEncoder} from '../../../node_modules/.pnpm/meshoptimizer@1.1.1/node_modules/meshoptimizer/index.js';
import {SurfaceRegistry} from './surface-registry.mjs';
import {writeSurfacePacks} from './write-surfaces.mjs';

test('manifest index width matches the actual encoded16/32-bit buffer and registry excludes unused frames',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'nycmon-surface-width-'));
 try{for(const count of[3,65538]){
  const registry=new SurfaceRegistry({source:{revision:'fixture'},identifyFamily:()=>({name:'fixture',supported:true})});
  registry.registerMaterial({source:{shaderSha256:'a'.repeat(64)},state:{},textures:[]});
  const variant=registry.variant(0,{},{});
  const vertices=Array.from({length:count},(_,i)=>{const triangle=Math.floor(i/3),corner=i%3;return{position:[(triangle%200)*.1+(corner===1?.04:0),0,Math.floor(triangle/200)*.1+(corner===2?.04:0)],color:[1,1,1],uv:[corner===1?1:0,corner===2?1:0],normal:[0,1,0],material:0,variant,grime:0,flags:7,weather:[0,0,0,-1]};});
  const output=await writeSurfacePacks({structures:[{id:'fixture',base:0,surface:{vertices,indices:vertices.map((_,i)=>i),families:vertices.map(()=>0)}}],registry,encoder:MeshoptEncoder,outDir:directory,affine:{sx:1,sz:1,ox:0,oz:0},buildParameters:r=>({materialCount:r.materials.length})});
  assert.equal(output.cells.length,1);
  const cell=output.cells[0],bytes=await readFile(join(directory,`${cell.key}.bin`)),header=new DataView(bytes.buffer,bytes.byteOffset,64);
  assert.equal(cell.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(cell.wide,Boolean(header.getUint32(12,true)&0x80000000));assert.equal(cell.wide,count>65535);
  assert.equal(output.registry.frames.length,1);assert.equal(output.registry.variants.length,1);assert.equal(output.registry.frames[0].baseY,0);
 }}finally{await rm(directory,{recursive:true,force:true});}
});
