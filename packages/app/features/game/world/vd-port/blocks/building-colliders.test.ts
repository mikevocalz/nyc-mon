import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset } from '../../../city-dataset.ts';
import { cameraPose } from '../../../city-camera-pose.ts';
import { CAMERA_CLEARANCE, constrainChaseCameraPose, createCameraBlocker } from '../../../camera-collision.ts';
import { spawnCaller } from '../../../character/caller-controller.ts';
import { INITIAL_CALLER_STATE } from '../../../character/caller-store.ts';
import { slideMove } from '../../../character/locomotion.ts';
import { BODY_RADIUS, createWalkQueries } from '../../walkability.ts';
import { createAuthoredBuildingBlocker } from './building-colliders.ts';
import { VD_BLOCKS } from './data/manifest.ts';

const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../../../data/harlem-apollo.json', import.meta.url), 'utf8')));
const source = createAuthoredBuildingBlocker(VD_BLOCKS.structures);
const mapped = createCameraBlocker(dataset.buildings);
const walk = createWalkQueries(dataset);
const combined = (x: number, y: number, z: number, radius: number) => mapped(x, y, z, radius) || source(x, y, z, radius);

test('real Apollo rightward movement keeps the player and rendered eye outside authored walls at 30 and 120 Hz', () => {
  const original = constrainChaseCameraPose(cameraPose({ x: -28, z: 21.93, yaw: Math.PI / 2, distance: 8 }), mapped);
  assert.equal(source(...original.position, CAMERA_CLEARANCE), true, 'the OSM-only camera entered a rendered source wall');
  assert.equal(walk.isWalkable(-40, 12.5), true);
  assert.equal(source(-40, 1, 12.5, BODY_RADIUS), true, 'OSM also allowed the player into a source building');
  for (const fps of [30, 120]) {
    let player = { x: -28, z: 22 };
    const isWalkable = (x: number, z: number) => walk.isWalkable(x, z) && !source(x, walk.groundHeight(x, z) + 0.9, z, BODY_RADIUS);
    for (let frame = 0; frame < fps * 10; frame++) {
      player = slideMove(player.x, player.z, 0, -4.2 / fps, isWalkable);
      assert.equal(source(player.x, 1, player.z, BODY_RADIUS), false);
      const actual = constrainChaseCameraPose(cameraPose({ ...player, yaw: Math.PI / 2, distance: 8 }), combined);
      assert.equal(combined(...actual.position, CAMERA_CLEARANCE), false, `eye clear at ${fps}Hz/frame${frame}`);
      assert.equal(actual.distance, 8, 'saved orbit distance remains unchanged');
    }
  }
});

test('authored volumes preserve concave footprints and their actual vertical range without inventing box solids', () => {
  const blocked = createAuthoredBuildingBlocker([{ owned: [[[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]]], box: [0, 2, 0, 4, 10, 4] },
    { owned: [], box: [-10, 0, -10, 10, 30, 10] }]);
  assert.equal(blocked(0.5, 3, 3, 0.2), true);
  assert.equal(blocked(3, 3, 3, 0.2), false, 'concave recess is open');
  assert.equal(blocked(0.5, 1, 3, 0.2), false, 'space below a raised volume stays open');
  assert.equal(blocked(0.5, 11, 3, 0.2), false, 'above its roof stays open');
  assert.equal(blocked(-5, 3, -5, 0.2), false, 'non-footprint structure is not turned into a box');
});

test('a resumed OSM-valid location inside an authored building is relocated before its first chase frame', () => {
  const isWalkable = (x: number, z: number) => walk.isWalkable(x, z) && !source(x, walk.groundHeight(x, z) + 0.9, z, BODY_RADIUS);
  const frame = spawnCaller(INITIAL_CALLER_STATE, { x: -40, z: 12.5, yaw: Math.PI / 2, distance: 8 },
    { isWalkable, groundHeight: walk.groundHeight });
  assert.ok(frame);
  assert.equal(isWalkable(frame.caller.x, frame.caller.z), true);
  assert.notDeepEqual([frame.caller.x, frame.caller.z], [-40, 12.5]);
  const eye = constrainChaseCameraPose(cameraPose(frame.camera), combined);
  assert.equal(combined(...eye.position, CAMERA_CLEARANCE), false);
});

test('actual native failure positions retain a visible third-person arm instead of an eight-centimetre eye', () => {
  const samples = [
    [-37.40610371910775, 14.441505920513041, -37.162471510119104, 14.577963356316971],
    [-40.82195358380568, 12.050198831381039, -40.572961883247075, 12.190196629962408],
    [-44.41560883102585, 10.082900388634554, -44.16355671586957, 10.212919878710034],
  ];
  for (const [playerX, playerZ, targetX, targetZ] of samples) {
    const requested = { x: targetX!, z: targetZ!, yaw: Math.PI / 2, distance: 8 };
    const actual = constrainChaseCameraPose(cameraPose(requested), combined);
    assert.ok(Math.hypot(actual.position[0] - playerX!, actual.position[1] - 1.2, actual.position[2] - playerZ!) >= 3,
      'collision clearance alone must not put the eye inside the avatar');
    assert.equal(combined(...actual.position, CAMERA_CLEARANCE), false);
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      assert.equal(combined(actual.target[0] + (actual.position[0] - actual.target[0]) * t,
        actual.target[1] + (actual.position[1] - actual.target[1]) * t,
        actual.target[2] + (actual.position[2] - actual.target[2]) * t, 0), false);
    }
    assert.deepEqual(requested, { x: targetX, z: targetZ, yaw: Math.PI / 2, distance: 8 });
  }
});
