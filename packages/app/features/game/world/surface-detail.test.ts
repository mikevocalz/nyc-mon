import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENTAL_SURFACE_DETAIL, parseSurfaceDetailFlag, surfaceDetailWeight, SURFACE_DETAIL } from './surface-detail.ts';

test('visual detail is opt-in and never inferred from unrelated flags',()=>{
  for(const value of [undefined,null,false,true,0,'','off','production','yes'])
    assert.equal(parseSurfaceDetailFlag(value),false);
  for(const value of ['1','true','ON',' True ']) assert.equal(parseSurfaceDetailFlag(value),true);
  assert.equal(typeof EXPERIMENTAL_SURFACE_DETAIL,'boolean');
});
test('mortar fades before subpixel moire and never changes far city colors',()=>{
  const { fadeNearMetres:near, fadeFarMetres:far }=SURFACE_DETAIL.mortar;
  assert.equal(surfaceDetailWeight(0,near,far),1);
  assert.equal(surfaceDetailWeight(near,near,far),1);
  assert.equal(surfaceDetailWeight((near+far)/2,near,far),.5);
  assert.equal(surfaceDetailWeight(far,near,far),0);
  assert.equal(surfaceDetailWeight(far*3,near,far),0);
});
test('invalid world distances and thresholds fail closed',()=>{
  assert.equal(surfaceDetailWeight(NaN,8,38),0);
  assert.equal(surfaceDetailWeight(-Infinity,8,38),0);
  assert.equal(surfaceDetailWeight(12,15,15),0);
  assert.equal(surfaceDetailWeight(12,-1,15),0);
});
test('asphalt variance remains subtle, no object geometry or new texture uploads',()=>{
  assert.ok(SURFACE_DETAIL.asphalt.grainDark>=.9);
  assert.ok(SURFACE_DETAIL.asphalt.grainLight<=1.1);
  assert.ok(SURFACE_DETAIL.asphalt.fadeFarMetres<=40);
  // Grain is hashed per 2-D cell, fine enough to read as grit not tiles.
  assert.ok(SURFACE_DETAIL.asphalt.cellMetres>=.05);
  assert.ok(SURFACE_DETAIL.asphalt.cellMetres<=.5);
});
test('masonry treatments match real unit sizes and differ from each other',()=>{
  const { brick, brownstone, limestone }=SURFACE_DETAIL.mortar.treatments;
  // US modular brick: ~57 mm face + ~10 mm joint = ~67.5 mm course
  // (14.8/m), ~194 mm stretcher + ~10 mm = ~204 mm bay (4.9/m).
  assert.ok(brick.coursesPerMetre>14&&brick.coursesPerMetre<15.2);
  assert.ok(brick.baysPerMetre>4.5&&brick.baysPerMetre<5.3);
  // A ~10 mm joint at those unit sizes, as a fraction of a cell.
  assert.ok(brick.horizontalJoint>=.12&&brick.horizontalJoint<=.17);
  assert.ok(brick.verticalJoint>=.04&&brick.verticalJoint<=.06);
  // Ashlar reads bigger than brick; limestone joints are the faintest.
  assert.ok(brownstone.coursesPerMetre<brick.coursesPerMetre);
  assert.ok(limestone.coursesPerMetre<brownstone.coursesPerMetre);
  assert.ok(limestone.darkness<brick.darkness);
  assert.ok(brownstone.darkness>brick.darkness);
});
