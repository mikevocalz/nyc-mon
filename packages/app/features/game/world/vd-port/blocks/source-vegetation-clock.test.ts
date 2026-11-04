import assert from 'node:assert/strict';import{test}from'node:test';import*as THREE from'three/webgpu';
import{createSourceVegetationClock}from'./source-vegetation-clock.ts';
test('source vegetation clocks own elapsed time and rendered-frame modulo64 without a reduced-motion resume jump',()=>{
 const c=createSourceVegetationClock(THREE,THREE.TSL.uniform(0),THREE.TSL.uniform(0));
 c.update(100);c.update(100.5);assert.equal(c.dynamics.windTime.value,0.5);assert.equal(c.dynamics.fadeFrame.value,2);
 c.update(101,true);c.update(500,true);c.update(900);assert.equal(c.dynamics.windTime.value,0.5);assert.equal(c.dynamics.fadeFrame.value,3);
 c.update(900.25);assert.equal(c.dynamics.windTime.value,0.75);
 for(let i=0;i<60;i++)c.update(900.25);assert.equal(c.dynamics.fadeFrame.value,0);
 c.update(NaN);c.update(1000);assert.equal(c.dynamics.windTime.value,0.75);
});
