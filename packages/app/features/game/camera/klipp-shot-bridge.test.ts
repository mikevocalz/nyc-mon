import test from 'node:test';
import assert from 'node:assert/strict';
import { applyKlippShot, chooseCameraShot, validKlippShot, type KlippCameraShot } from './klipp-shot-bridge.ts';
const shot:KlippCameraShot={position:[10,3,8],quaternion:[0,0,0,1],fov:50,near:.1,far:3000};
function dummy() {
  const calls: string[]=[];
  return {
    calls,position:{set:(x:number,y:number,z:number)=>{calls.push(`position:${x}:${y}:${z}`)}},
    quaternion:{set:(x:number,y:number,z:number,w:number)=>{calls.push(`quat:${x}:${y}:${z}:${w}`)}},
    fov:50,near:.1,far:3000,
    updateProjectionMatrix(){calls.push('lens')},
  };
}
test('battle overrides encounter and scanner; exploration remains fallback',()=>{
  assert.equal(chooseCameraShot({}), 'explore');
  assert.equal(chooseCameraShot({riding:true}), 'ride');
  assert.equal(chooseCameraShot({scanner:true,riding:true}), 'scan');
  assert.equal(chooseCameraShot({encounter:true,scanner:true}), 'encounter');
  assert.equal(chooseCameraShot({battle:true,encounter:true}), 'battle');
});
test('validated Klipp shot writes real Three-style pose without lens rebuild if unchanged',()=>{
  const c=dummy();
  assert.equal(applyKlippShot(c,shot),true);
  assert.deepEqual(c.calls,['position:10:3:8','quat:0:0:0:1']);
  assert.equal(applyKlippShot(c,{...shot,fov:60}),true);
  assert.equal(c.calls.at(-1),'lens');
});
test('corrupt shots do not mutate the camera; quaternion normalized',()=>{
  const c=dummy();
  for(const input of [
    null,{...shot,position:[NaN,0,0]},{...shot,quaternion:[0,0,0,0]},
    {...shot,quaternion:[10,0,0,0]},{...shot,far:-1},{...shot,fov:120},
  ] as any[]) assert.equal(applyKlippShot(c,input),false);
  assert.equal(c.calls.length,0);
  const normalized=validKlippShot({...shot,quaternion:[0,0,0,1.1]})!;
  assert.ok(Math.abs(Math.hypot(...normalized.quaternion)-1)<1e-9);
});
test('camera near/far remain finite and bounded',()=>{
  assert.equal(validKlippShot({...shot,near:0}),null);
  assert.equal(validKlippShot({...shot,far:25000}),null);
  assert.equal(validKlippShot({...shot,far:.01}),null);
});
