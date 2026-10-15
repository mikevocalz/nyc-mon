import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { ThreeContext, ThreeFrame } from '@acme/ui/three';
import { createCityScene } from './city-scene.ts';
import { parseCityDataset } from './city-dataset.ts';
const context = { THREE } as ThreeContext; // Scene construction does not create a GPU renderer.
function params() {
  return { camera: { x:0,z:0,yaw:0,distance:200 }, dataset: parseCityDataset({
    version:1,id:'synthetic-test-only',origin:[-73.95,40.81],
    source:{url:'https://example.com/test',attribution:'Synthetic test',license:'test',retrievedAt:'2026-10-14T00:00:00Z'},
    features:[
      {id:'building:1',kind:'building',heightMeters:20,points:[[-73.95,40.81],[-73.949,40.81],[-73.949,40.811],[-73.95,40.81]]},
      {id:'road:1',kind:'road',widthMeters:8,points:[[-73.95,40.81],[-73.949,40.811]]},
    ],
  }) };
}
test('builds metric building and road meshes with an elevated camera', () => {
  const built = createCityScene(context,params());
  const building = built.scene.getObjectByName('building:1') as THREE.Mesh;
  building.geometry.computeBoundingBox();
  assert.equal(Math.round(building.geometry.boundingBox!.max.y),20);
  assert.ok(built.scene.getObjectByName('road:1'));
  assert.ok(built.camera.position.y > 0);
  built.dispose!();
});
test('resize retains world and camera state, updates remain on the same dataset', () => {
  const input = params(); const built = createCityScene(context,input);
  const before = built.camera.position.clone();
  built.resize!(1200,800); assert.ok(built.camera.position.equals(before));
  assert.equal((built.camera as THREE.PerspectiveCamera).aspect,1.5);
  built.resize!(NaN,0); assert.equal((built.camera as THREE.PerspectiveCamera).aspect,1.5);
  built.update!({} as ThreeFrame,{...input,camera:{...input.camera,x:40}});
  assert.equal(built.camera.position.x,40);
  assert.throws(() => built.update!({} as ThreeFrame,params()),/Remount/);
  built.dispose!();
});
test('disposes all geometries and shared materials exactly once', () => {
  const built = createCityScene(context,params());
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  built.scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    }
  });
  let count = 0;
  for (const resource of resources) resource.addEventListener('dispose',() => { count++; });
  built.dispose!(); built.dispose!();
  assert.equal(count,resources.size); assert.equal(built.scene.children.length,0);
});
test('rejects invalid cameras and oversize scenes before allocating meshes', () => {
  const input = params(); input.camera.x = NaN;
  assert.throws(() => createCityScene(context,input),/camera/);
  const big = params(); big.dataset.features = Array.from({length:257},(_,i) => ({...big.dataset.features[0]!,id:`building:${i}`}));
  assert.throws(() => createCityScene(context,big),/budget/);
});
