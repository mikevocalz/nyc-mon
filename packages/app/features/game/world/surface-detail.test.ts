import test from 'node:test';
import assert from 'node:assert/strict';
import { asphaltGrainHash, EXPERIMENTAL_SURFACE_DETAIL, parseSurfaceDetailFlag, surfaceDetailWeight, SURFACE_DETAIL } from './surface-detail.ts';

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
test('asphalt grain varies per cell in 2-D, not along the old stripe diagonal',()=>{
  const { cellMetres }=SURFACE_DETAIL.asphalt;
  const grain=(x:number,z:number)=>asphaltGrainHash(Math.floor(x/cellMetres),Math.floor(z/cellMetres));
  // One cell, one grit value; neighbouring cells differ on both axes.
  assert.equal(grain(.01,.01),grain(.17,.17));
  assert.notEqual(grain(.09,.09),grain(.27,.09));
  assert.notEqual(grain(.09,.09),grain(.09,.27));
  // The old grain hashed 12.73x+24.39z, so it pinned along the line
  // perpendicular to (12.73,24.39): 1,000 samples there spread by 3e-7.
  // Walking the same line, the cell hash covers most of its range.
  const ux=24.39,uz=-12.73,ul=Math.hypot(ux,uz);
  let lo=1,hi=0;
  for(let i=0;i<1000;i++){
    const g=grain(ux/ul*i*.05,uz/ul*i*.05);
    lo=Math.min(lo,g); hi=Math.max(hi,g);
  }
  assert.ok(hi-lo>.5,`spread along the old stripe line ${hi-lo}`);
  // No short diagonal period: a 40x40 cell block is ~all distinct.
  const seen=new Set<number>();
  for(let i=0;i<40;i++)for(let j=0;j<40;j++)seen.add(asphaltGrainHash(i,j));
  assert.ok(seen.size>=1500,`${seen.size} distinct of 1600 cells`);
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
