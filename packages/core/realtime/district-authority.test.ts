import test from 'node:test';
import assert from 'node:assert/strict';
import { DistrictAuthority, DEFAULT_DISTRICT_SPEC, normalizeInput } from './district-authority.ts';

test('only trusted join context supplies initial position; snapshot excludes secrets',()=>{
  const room=new DistrictAuthority();
  assert.equal(room.join({sessionId:'sid-one',callerId:'Callah-1',startX:0,startZ:0}),null);
  assert.deepEqual(room.snapshot(),[{callerId:'Callah-1',x:0,z:0,tick:0}]);
  assert.ok(!JSON.stringify(room.snapshot()).includes('sid-one'));
  assert.equal(room.join({sessionId:'sid-two',callerId:'Callah-1',startX:0,startZ:0}),'already_joined');
});
test('client cannot replay, teleport, inject NaN or multiply movement by packet spam',()=>{
  const room=new DistrictAuthority();
  room.join({sessionId:'s',callerId:'c',startX:0,startZ:0});
  assert.equal(room.submit('s',{seq:1,dx:1,dz:0,run:true}),null);
  assert.equal(room.submit('s',{seq:1,dx:1,dz:0,run:true}),'bad_sequence');
  assert.equal(room.submit('s',{seq:2,dx:Infinity,dz:0,run:true}),'invalid_vector');
  assert.equal(room.submit('s',{seq:2,dx:999,dz:0,run:true}),'invalid_vector');
  assert.equal(room.submit('s',{seq:2,dx:1,dz:0,run:true}),null);
  assert.equal(room.submit('s',{seq:3,dx:1,dz:0,run:true}),null);
  // Three packets: only the freshest input moves once per SERVER tick.
  const [p]=room.step();
  assert.ok(p!.x<=DEFAULT_DISTRICT_SPEC.runMetresPerSecond*DEFAULT_DISTRICT_SPEC.tickMs/1000);
  assert.equal(p!.tick,1);
  assert.equal(room.step()[0]!.x,p!.x);
});
test('normalized diagonal input never travels sqrt(2) times as far',()=>{
  const [x,z]=normalizeInput(1,1);
  assert.ok(Math.abs(Math.hypot(x,z)-1)<1e-9);
  const room=new DistrictAuthority();
  room.join({sessionId:'s',callerId:'c',startX:0,startZ:0});
  room.submit('s',{seq:1,dx:1,dz:1,run:true});
  const [p]=room.step();
  assert.ok(Math.hypot(p!.x,p!.z)<=.375+1e-10);
});
test('bounds and server collision query stop traversing walls',()=>{
  const bounds={...DEFAULT_DISTRICT_SPEC,extentMetres:2,walkable:(x:number,z:number)=>x<1};
  const room=new DistrictAuthority(bounds);
  assert.equal(room.join({sessionId:'block',callerId:'a',startX:1,startZ:0}),'blocked_start');
  assert.equal(room.join({sessionId:'s',callerId:'ok',startX:.95,startZ:0}),null);
  room.submit('s',{seq:1,dx:1,dz:0,run:false});
  assert.equal(room.step()[0]!.x,.95);
  assert.equal(room.join({sessionId:'edge',callerId:'b',startX:3,startZ:0}),'outside_bounds');
});
test('capacity, disconnect and room clearance do not preserve ghost players',()=>{
  const room=new DistrictAuthority({...DEFAULT_DISTRICT_SPEC,maxPlayers:1});
  room.join({sessionId:'s',callerId:'a',startX:0,startZ:0});
  assert.equal(room.join({sessionId:'new',callerId:'b',startX:0,startZ:0}),'room_full');
  room.leave('s');
  assert.equal(room.submit('s',{seq:3,dx:1,dz:1,run:false}),'unknown_session');
  assert.equal(room.join({sessionId:'new',callerId:'b',startX:0,startZ:0}),null);
  room.clear();
  assert.equal(room.snapshot().length,0);
});
