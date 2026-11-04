import test from 'node:test';import assert from 'node:assert/strict';
import {sourceFrameValues,multiplySourceMatrices,inverseSourceMatrix}from'./surface-frame.mjs';
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const transform=(m,v,w)=>[0,1,2].map(row=>m[row]*v[0]+m[4+row]*v[1]+m[8+row]*v[2]+m[12+row]*w);
const close=(a,b)=>a.forEach((value,i)=>assert.ok(Math.abs(value-b[i])<1e-9));
test('source frame inverse and local wind transform retain original instance coordinates without another vertex buffer',()=>{
 const mesh=[0,0,-2,0,0,3,0,0,4,0,0,0,1200,5,-2900,1],instance=[-1,0,0,0,0,2,0,0,0,0,.5,0,12,2,-7,1];
 const combined=multiplySourceMatrices(mesh,instance),frame={meshMatrixWorld:mesh,instanceMatrix:instance,combinedMatrix:combined,isInstanced:true,instanceTranslationXZ:[12,-7],baseY:4,curb:.14,affine:{sx:.4,sz:.7,ox:-800,oz:1700}},values=sourceFrameValues(frame);
 const inverse=[0,1,2,3].flatMap(column=>values[`inverseCombined${column}`]),scene=[0,1,2,3].flatMap(column=>values[`localToScene${column}`]);
 close(transform(inverse,transform(combined,[1,2,3],1),1),[1,2,3]);
 const delta=[.2,-.1,.3],sourceDelta=transform(combined,delta,0);
 close(transform(scene,delta,0),[sourceDelta[0]*.4,sourceDelta[1],sourceDelta[2]*.7]);
 assert.equal(values.isInstanced,1);assert.deepEqual(values.instanceTranslationXZ,[12,-7]);assert.deepEqual(values.meshWorld3,[1200,5,-2900,1]);
});
test('missing, singular and inconsistent original frames fail before table publication',()=>{
 const singular=[...identity];singular[5]=0;assert.throws(()=>inverseSourceMatrix(singular),/Singular/);
 assert.throws(()=>sourceFrameValues({}),/Missing finite affine/);
 const wrong={meshMatrixWorld:identity,instanceMatrix:identity,combinedMatrix:[...identity],isInstanced:false,instanceTranslationXZ:[0,0],baseY:0,curb:.14,affine:{sx:1,sz:1,ox:0,oz:0}};wrong.combinedMatrix[12]=1;
 assert.throws(()=>sourceFrameValues(wrong),/combination mismatch/);
});
