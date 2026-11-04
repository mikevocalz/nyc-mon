import test from 'node:test';import assert from 'node:assert/strict';import {createRequire}from'node:module';
import {auditSourceGeometry}from'./geometry-provenance.js';import{harvestSurfaceTriangles}from'./surface-harvest.mjs';
const require=createRequire(import.meta.url),sha256=require('../../../node_modules/.pnpm/fast-sha256@1.3.0/node_modules/fast-sha256/sha256.js');
const attribute=(values,size)=>({itemSize:size,count:values.length/size,getComponent:(i,c)=>values[i*size+c],getX:i=>values[i*size]});
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],matrix=()=>({elements:identity,clone:matrix});
function fixture(){const positions=[0,0,0,1,0,0,0,0,1],material={uuid:'volatile',name:'known',type:'MeshStandardMaterial',visible:true};return{positions,root:{id:'fixture',group:{name:'known',isMesh:true,visible:true,renderOrder:0,castShadow:true,receiveShadow:true,children:[],material,matrixWorld:matrix(),updateMatrixWorld(){},geometry:{groups:[],drawRange:{start:0,count:3},attributes:{position:attribute(positions,3),normal:attribute([0,-1,0,0,-1,0,0,-1,0],3),uv:attribute([0,0,1,0,0,1],2)}}}},records:[{...material,shader:{sha256:'a'.repeat(64),uniforms:{}},maps:{},color:[1,1,1]}]};}
test('bounded source geometry digest is stable across transient UUIDs and changes for exact channel/state changes',()=>{
 const previous=globalThis.window;globalThis.window={sha256,__harvestSurfaceTriangles:harvestSurfaceTriangles};
 try{const a=fixture(),first=auditSourceGeometry(a.root,a.records,[]);assert.equal(first.triangles,1);assert.equal(first.vertices,3);assert.match(first.sha256,/^[a-f0-9]{64}$/);assert.equal(Array.isArray(first.vertices),false);assert.deepEqual(first.variants[0].materials,[0]);assert.equal(first.variants[0].frame.hasInstanceColor,false);assert.deepEqual(first.variants[0].frame.combinedMatrix,identity);
  a.root.group.material.uuid='different';a.records[0].uuid='different';assert.equal(auditSourceGeometry(a.root,a.records,[]).sha256,first.sha256);
  a.positions[3]=2;assert.notEqual(auditSourceGeometry(a.root,a.records,[]).sha256,first.sha256);
  a.positions[3]=1;a.root.group.renderOrder=2;assert.notEqual(auditSourceGeometry(a.root,a.records,[]).sha256,first.sha256);
 }finally{globalThis.window=previous;}
});
