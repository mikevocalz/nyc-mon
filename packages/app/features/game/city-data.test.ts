import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { ThreeContext } from '@acme/ui/three';
import { parseCityDataset } from './city-dataset.ts';
import { createCityScene } from './city-scene.ts';
const raw = readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8');
const data = parseCityDataset(JSON.parse(raw));
test('real Apollo extract retains geography, provenance and stable OSM identifiers', () => {
  assert.equal(data.features.length,26);
  assert.equal(data.features.filter(f=>f.kind==='building').length,17);
  assert.ok(data.features.some(f=>f.id==='osm:way:271798914')); // Apollo Theater footprint.
  assert.ok(data.features.some(f=>f.id==='osm:way:550514517')); // West 125th Street.
  assert.equal(data.source.license,'ODbL-1.0');
  assert.match(data.source.attribution,/OpenStreetMap/);
  assert.doesNotMatch(raw,/"(?:user|uid|changeset|email|phone)"\s*:/);
  assert.equal(JSON.parse(raw).dimensionEstimates.length,10);
});
test('the real extract produces finite geometry and disposes without a GPU', () => {
  const built=createCityScene({THREE} as ThreeContext,{dataset:data,camera:{x:0,z:0,yaw:0,distance:350}});
  built.scene.traverse(object=>{
    if(object instanceof THREE.Mesh){
      const positions=object.geometry.getAttribute('position');
      assert.ok(positions.count>0);
      for(const value of positions.array) assert.ok(Number.isFinite(value));
    }
  });
  built.dispose!(); assert.equal(built.scene.children.length,0);
});
