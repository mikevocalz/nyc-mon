import test from 'node:test';
import assert from 'node:assert/strict';
import { DistrictAuthority, DEFAULT_DISTRICT_SPEC, normalizeInput, segmentCellsWalkable } from './district-authority.ts';

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
test('a wall between two walkable cells blocks a move that skips over it',()=>{
  // 0.25 m cells; the cell x in [1, 1.25) is a wall. Start and end are both walkable.
  const wall=(x:number)=>!(x>=1&&x<1.25);
  const spec={...DEFAULT_DISTRICT_SPEC,extentMetres:4,tickMs:100,walkableCellMetres:.25,
    walkable:(x:number,_z:number)=>wall(x)};
  const room=new DistrictAuthority(spec);
  assert.equal(room.join({sessionId:'s',callerId:'c',startX:.9,startZ:.1}),null);
  // Running for one 100 ms tick covers 0.75 m: 0.9 -> 1.65, past the wall.
  assert.ok(spec.walkable(.9+.75,.1));
  assert.equal(room.submit('s',{seq:1,dx:1,dz:0,run:true}),null);
  assert.equal(room.step()[0]!.x,.9);
  // Walking back the other way crosses no wall and is applied.
  assert.equal(room.submit('s',{seq:2,dx:-1,dz:0,run:false}),null);
  assert.ok(Math.abs(room.step()[0]!.x-(.9-.45))<1e-9);
});
test('segmentCellsWalkable visits every crossed cell, diagonals included',()=>{
  const visited:string[]=[];
  const ok=segmentCellsWalkable(.5,.5,2.5,1.5,1,(x,z)=>{visited.push(`${x},${z}`);return true;});
  assert.equal(ok,true);
  assert.deepEqual(visited,['1.5,0.5','1.5,1.5','2.5,1.5']);
  assert.equal(segmentCellsWalkable(.5,.5,.6,.7,1,()=>false),true);
  assert.equal(segmentCellsWalkable(-.5,-.5,-2.5,-.5,1,(x)=>x!==-1.5),false);
});
test('rejects a non-positive walkability cell size',()=>{
  assert.throws(()=>new DistrictAuthority({...DEFAULT_DISTRICT_SPEC,walkableCellMetres:0}),/Invalid district/);
});
