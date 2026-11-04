import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three/webgpu';
import {createSourceVegetationActivity} from './source-vegetation-activity.ts';
import {createSourceVegetationClock} from './source-vegetation-clock.ts';

test('distant registry foliage parks; wanted foliage and resident fade-out keep animation until real eviction',()=>{
 const activity=createSourceVegetationActivity(new Set([2]));let resident=true;
 assert.equal(activity.animated,false);activity.setWanted([0]);assert.equal(activity.animated,false);
 activity.setWanted([2]);assert.equal(activity.animated,true);
 const remove=activity.register(2,()=>resident);activity.setWanted([]);
 assert.equal(activity.animated,true,'fade-out retains its actual lease');resident=false;assert.equal(activity.animated,false);
 remove();activity.dispose();assert.equal(activity.animated,false);
});

test('parked/reduced-motion foliage clocks do not jump across an inactive gap',()=>{
 const activity=createSourceVegetationActivity(new Set([1]));const clock=createSourceVegetationClock(THREE,THREE.TSL.uniform(0),THREE.TSL.uniform(0));
 const tick=(time:number,reduced=false)=>clock.update(time,reduced||!activity.animated);
 const elapsed=()=>Number((clock.dynamics.windTime as unknown as {value:number}).value);
 tick(0);tick(100);activity.setWanted([1]);tick(101);tick(102);
 const active=elapsed();assert.equal(active,1);
 activity.setWanted([]);tick(103);tick(1000);activity.setWanted([1]);tick(1001);assert.equal(elapsed(),active);
 tick(1002,true);tick(2000,true);tick(2001);assert.equal(elapsed(),active);
});
