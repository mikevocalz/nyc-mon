import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSourceActivation, selectSourceCohorts } from './source-activation.ts';
import type { SurfaceCohortPlan } from './surface-layers.ts';

test('START shares real SSE/distance rules and includes entire nearest cohorts without loading far metadata', async () => {
  const plan = new Map([0,100,1000].map((x,id)=>[id,{key:{},bounds:new Float64Array([x,0,0,x+10,10,10]),cells:[{cx:id,cz:0}],siblings:[]}])) as unknown as SurfaceCohortPlan;
  const args={camera:{x:0,y:2,z:2},k:1000,layer:{errorM:1,chunk:128,fade:true},residentRadius:500,screenErrorPx:1,hysteresis:.8};
  assert.deepEqual(selectSourceCohorts(plan,{...args,startRadius:50}),[0]);
  assert.deepEqual(selectSourceCohorts(plan,args),[0,1]);
  assert.deepEqual(selectSourceCohorts(plan,{...args,startRadius:50,pinned:cx=>cx===2}),[0,2]);
  const reads:number[]=[];
  const controller=createSourceActivation({activate:async id=>{reads.push(id);return{dispose(){}};},wake(){}});
  await controller.request(selectSourceCohorts(plan,{...args,startRadius:50}));
  assert.deepEqual(reads,[0]);controller.dispose();
});

test('activations serialize real resource work and coalesce repeated demand', async () => {
  const calls:number[]=[];let finish!:()=>void;
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  const controller=createSourceActivation({async activate(id){calls.push(id);if(id===0)await gate;return{dispose(){}};},wake(){}});
  const first=controller.request([0,1]),same=controller.request([0,1]);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,[0]);finish();
  await Promise.all([first,same]);assert.deepEqual(calls,[0,1]);controller.dispose();
});

test('offscreen replacement aborts queued work and disposes late results without waking or leaking', async () => {
  let finish!:()=>void,disposals=0,wakes=0;const calls:number[]=[];
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  const controller=createSourceActivation({async activate(id,signal){calls.push(id);if(id===0){await gate;assert.equal(signal.aborted,true);}return{dispose(){disposals++;}};},wake(){wakes++;}});
  const old=controller.request([0,1]);void old.catch(()=>{});
  await new Promise(resolve=>setImmediate(resolve));const next=controller.request([2]);finish();
  await assert.rejects(old,{name:'AbortError'});await next;
  assert.deepEqual(calls,[0,2]);assert.equal(disposals,1);assert.equal(wakes,1);
  controller.dispose();controller.dispose();assert.equal(disposals,2);
});

test('budget/resource failure stays failed, may retry, and disposal owns late completion', async () => {
  let attempts=0,finish!:()=>void,disposed=0;
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  const controller=createSourceActivation({async activate(){if(++attempts===1)throw new Error('cohort budget');await gate;return{dispose(){disposed++;}};},wake(){assert.fail('disposed activation woke');}});
  await assert.rejects(controller.request([1]),/cohort budget/);
  const retry=controller.request([1]);await new Promise(resolve=>setImmediate(resolve));controller.dispose();finish();
  await assert.rejects(retry,{name:'AbortError'});assert.equal(disposed,1);
});

test('a registration committed before a demand-change microtask keeps one owner until scene disposal',async()=>{
 let finish!:(handle:{dispose():void;registered:true})=>void,disposals=0,calls=0;
 const controller=createSourceActivation({activate(){calls++;return new Promise(resolve=>{finish=resolve;});},wake(){}});
 const pending=controller.request([0]);await new Promise(resolve=>setImmediate(resolve));
 finish({registered:true,dispose(){disposals++;}});
 await controller.request([]);await pending;
 await controller.request([0]);assert.equal(calls,1);assert.equal(disposals,0);
 controller.dispose();assert.equal(disposals,1);
});
