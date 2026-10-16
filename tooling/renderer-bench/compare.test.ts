import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCaptures, timingStats, type RendererCapture } from './compare.ts';
const sample=(engine:RendererCapture['engine'],capturedFrom:RendererCapture['capturedFrom']='physical-device'):RendererCapture=>({
  engine,backend:'webgpu',deviceClass:'test-iphone',gpuModel:'synthetic-gpu',sceneId:'harlem-apollo-v2',
  buildId:'test-build',cameraPathId:'125th-walk',datasetDigest:'sha256-same',
  widthPx:1080,heightPx:1920,devicePixelRatio:2,triangles:283000,
  drawCalls:21,qualitySignature:'lights=2;shadows=0;bloom=0;dof=0;reflection=0',
  frameIntervalsMs:Array.from({length:120},()=>16),cpuSubmitMs:Array.from({length:120},()=>7),capturedFrom,
});
test('same GPU/backend/scene/fidelity yields comparable sample statistics',()=>{
  const a=sample('three-webgpu'),b=sample('pixijs3d');
  b.frameIntervalsMs=Array.from({length:120},()=>20);
  const r=compareCaptures(a,b);
  assert.equal(r.threeFrame.p90Ms,16);
  assert.equal(r.pixiFrame.p90Ms,20);
  assert.ok(Math.abs(r.pixiP90DifferencePercent-25)<1e-9);
  assert.equal(r.sceneId,'harlem-apollo-v2');
});
test('reject comparison of different pixel ratio, geometry, lighting or backend',()=>{
  for(const key of ['devicePixelRatio','triangles','qualitySignature','backend','datasetDigest'] as const){
    const a=sample('three-webgpu'),b=sample('pixijs3d');
    (b as any)[key]=key==='qualitySignature'?'bloom=1':key==='backend'?'webgl2':key==='datasetDigest'?'other':0;
    assert.throws(()=>compareCaptures(a,b),new RegExp('Not comparable'));
  }
});
test('marketing or simulated frames cannot decide which renderer ships',()=>{
  const a=sample('three-webgpu'),b=sample('pixijs3d','synthetic-test');
  assert.throws(()=>compareCaptures(a,b),/No production renderer recommendation/);
});
test('invalid frame values and missing data reject rather than report 60fps',()=>{
  const a=sample('three-webgpu'),b=sample('pixijs3d');
  b.frameIntervalsMs[0]=0;
  assert.throws(()=>compareCaptures(a,b),/Invalid renderer capture/);
  b.frameIntervalsMs[0]=16;
  b.frameIntervalsMs=[];
  assert.throws(()=>compareCaptures(a,b),/Invalid renderer capture/);
});
test('p90/p99 and budget miss counters report recorded numbers only',()=>{
  const values=[...Array(119).fill(16),18];
  const s=timingStats(values);
  assert.equal(s.p90Ms,16);
  assert.equal(s.p99Ms,16);
  assert.equal(s.over60HzBudget,1);
});
