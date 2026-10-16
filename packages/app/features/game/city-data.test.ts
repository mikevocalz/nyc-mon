import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { URL } from 'node:url';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { ThreeContext } from '@acme/ui/three';
import { cityDatasetBounds, isOverMappedArea } from './city-bounds.ts';
import { INITIAL_CITY_CAMERA } from './city-camera.ts';
import { parseCityDataset } from './city-dataset.ts';
import { createCityScene } from './city-scene.ts';
import { createWalkQueries } from './world/walkability.ts';

const file = new URL('./data/harlem-apollo.json', import.meta.url);
const raw = readFileSync(file, 'utf8');
const data = parseCityDataset(JSON.parse(raw));

test('the Harlem tile keeps provenance, stable OSM ids and the three landmarks', () => {
  assert.equal(data.version, 2);
  assert.equal(data.id, 'harlem-apollo-20261014');
  assert.deepEqual(data.origin, [-73.94975, 40.81005]);
  assert.equal(data.source.license, 'ODbL-1.0');
  assert.match(data.source.attribution, /OpenStreetMap/);
  assert.doesNotMatch(raw, /"(?:user|uid|changeset|email|phone)"\s*:/);
  assert.ok(data.buildings.some((b) => b.id === 'osm:way:271798914'), 'Apollo Theater footprint');
  assert.ok(data.roads.some((r) => r.name?.includes('125th')), 'West 125th Street');
  assert.deepEqual(data.landmarks.map((l) => l.key).sort(), ['acp-state-office', 'apollo-theater', 'hotel-theresa']);
});

test('the tile reads as a neighbourhood and stays inside the bundle budget', () => {
  assert.ok(data.buildings.length > 1000, `buildings ${data.buildings.length}`);
  assert.ok(data.roads.length > 300, `roads ${data.roads.length}`);
  assert.ok(data.areas.some((a) => a.kind === 'park'));
  assert.ok(data.trees.osm.length + data.trees.fill.length > 0);
  assert.ok(statSync(file).size < 3 * 1024 * 1024, 'baked JSON under 3 MB');
});

test('the real tile bakes to a few finite meshes and disposes without a GPU', () => {
  const built = createCityScene({ THREE } as ThreeContext, { dataset: data, camera: { ...INITIAL_CITY_CAMERA, yaw: 0 } });
  let meshes = 0;
  built.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    const positions = object.geometry.getAttribute('position');
    assert.ok(positions.count > 0, object.name);
    for (const value of positions.array as Float32Array) assert.ok(Number.isFinite(value), object.name);
  });
  // 13 city and tree meshes plus 7 for neon, billboards and street furniture (2026-10-16).
  // Triangles, not draw calls, bound the Duo: world/budget.test.ts holds those under 200k.
  assert.ok(meshes <= 22, `draw calls stay flat: ${meshes} meshes`);
  built.dispose!(); assert.equal(built.scene.children.length, 0);
});

test('start view is mapped, the clamp corner is not, and the Apollo frontage is walkable', () => {
  const bounds = cityDatasetBounds(data);
  assert.ok(isOverMappedArea(INITIAL_CITY_CAMERA, bounds));
  assert.equal(isOverMappedArea({ ...INITIAL_CITY_CAMERA, yaw: 0, x: 2000, z: 2000 }, bounds), false);
  const walk = createWalkQueries(data);
  const apollo = data.landmarks.find((l) => l.key === 'apollo-theater')!;
  assert.equal(walk.isWalkable(apollo.x, apollo.z), false, 'inside the theatre');
  const street = data.roads.find((r) => r.name?.includes('125th') && r.class !== 'sidewalk')!;
  assert.equal(walk.isWalkable(street.points[0]!, street.points[1]!), true, 'on 125th Street');
});
