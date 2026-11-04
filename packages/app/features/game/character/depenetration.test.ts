import assert from 'node:assert/strict';
import {test} from 'node:test';
import {findLocalSeparation,DEPENETRATION_RADIUS} from './depenetration.ts';
import {stepGameFrame,RELEASED_CONTROLS,IDLE_CHASE} from './caller-controller.ts';
import {INITIAL_CALLER_STATE} from './caller-store.ts';
import {INITIAL_CITY_CAMERA} from '../city-camera.ts';

test('centimetre LOD overlap separates locally without broad spawn relocation',()=>{
 const result=findLocalSeparation(0,0,(x)=>x>=.047);
 assert.ok(result);assert.ok(result.x>=.047&&result.x<.0471);assert.ok(Math.abs(result.z)<.0001);
 assert.equal(findLocalSeparation(0,0,()=>false),null);
 const invalid=findLocalSeparation(0,0,(x)=>x>DEPENETRATION_RADIUS+.01);assert.equal(invalid,null);
});

test('collision revision recovery preserves orientation, orbit and animation distance, then movement escapes',()=>{
 let revision=0,edge=-.1;
 const world={isWalkable:(x:number)=>x>=edge,groundHeight:()=>.14,collisionRevision:()=>revision};
 let frame=stepGameFrame({caller:{...INITIAL_CALLER_STATE,spawned:true,heading:1.2,stride:7,gaitPhase:3},camera:{...INITIAL_CITY_CAMERA,x:0,z:0,yaw:-Math.PI/2,distance:8},chase:IDLE_CHASE},RELEASED_CONTROLS,1/60,false,world);
 edge=.047;revision++;
 frame=stepGameFrame(frame,RELEASED_CONTROLS,1/60,false,world);
 assert.ok(frame.caller.x>=edge&&frame.caller.x<.0471);assert.equal(frame.caller.heading,1.2);
 assert.equal(frame.caller.stride,7);assert.equal(frame.caller.gaitPhase,3);assert.equal(frame.camera.yaw,-Math.PI/2);assert.equal(frame.camera.distance,8);
 const recoveredX=frame.caller.x;
 const moved=stepGameFrame(frame,{...RELEASED_CONTROLS,engaged:true,stickY:1,run:true},.1,false,world);
 assert.ok(moved.caller.x>recoveredX);assert.ok(moved.caller.stride>7);
});

test('unchanged collision revision never searches or teleports a newly invalid position',()=>{
 let calls=0;
 const world={isWalkable:()=>{calls++;return false;},groundHeight:()=>0,collisionRevision:()=>4};
 const frame={caller:{...INITIAL_CALLER_STATE,spawned:true},camera:{...INITIAL_CITY_CAMERA,x:0,z:0},chase:{...IDLE_CHASE,collisionRevision:4}};
 const result=stepGameFrame(frame,RELEASED_CONTROLS,0,false,world);
 assert.equal(result.caller.x,0);assert.equal(result.caller.z,0);assert.ok(calls<5,'only ordinary chase validation, no radial search');
});
