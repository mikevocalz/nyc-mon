import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CAMERA_CLEARANCE, constrainChaseCameraPose, createCameraBlocker, createChaseCameraConstraint } from './camera-collision.ts';
import { cameraPose, type CameraPose } from './city-camera-pose.ts';
import { INITIAL_CITY_CAMERA } from './city-camera.ts';
import { parseCityDataset } from './city-dataset.ts';

const building = (x0: number, z0: number, x1: number, z1: number, heightMeters = 12, holes: number[][] = []) => ({
  ring: [x0, z0, x1, z0, x1, z1, x0, z1], holes, heightMeters,
});
const pose = (position: [number, number, number], target: [number, number, number] = [0, 1.2, 0], distance = 8): CameraPose => ({ position, target, distance, pitch: 0.35 });

test('the real Apollo first chase eye stays outside the building that hid the player', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')));
  const blocked = createCameraBlocker(dataset.buildings);
  const value = { ...INITIAL_CITY_CAMERA, distance: 8 };
  const desired = cameraPose(value);
  assert.equal(blocked(...desired.position, 0), true, 'regression: authored eye was inside osm:way:271798755');
  const actual = constrainChaseCameraPose(desired, blocked);
  assert.equal(blocked(...actual.position, CAMERA_CLEARANCE), false);
  assert.deepEqual(actual.target, [-28, 1.2, 22]);
  assert.equal(actual.distance, 8, 'render correction never changes requested/saved zoom');
  assert.ok(actual.position[0] > -28 + 3, 'the initial player still has third-person framing');
  for (let t = 0; t <= 1; t += 0.01) {
    assert.equal(blocked(actual.target[0] + (actual.position[0] - actual.target[0]) * t,
      actual.target[1] + (actual.position[1] - actual.target[1]) * t,
      actual.target[2] + (actual.position[2] - actual.target[2]) * t, 0), false, 'clear player-to-eye sightline');
  }
});

test('unobstructed and overview poses keep their authored coordinates exactly', () => {
  const blocked = createCameraBlocker([building(10, 10, 20, 20)]);
  const clear = cameraPose({ x: 0, z: 0, yaw: 0, distance: 8 });
  const expected = structuredClone(clear);
  assert.equal(constrainChaseCameraPose(clear, blocked), clear);
  assert.deepEqual(clear, expected);
  const overview = cameraPose({ x: 12, z: 12, yaw: 0, distance: 220 });
  const overviewExpected = structuredClone(overview);
  constrainChaseCameraPose(overview, blocked);
  assert.deepEqual(overview, overviewExpected);
});

test('a thin wall and a diagonal corner cannot be crossed by the swept eye', () => {
  const blocked = createCameraBlocker([building(3, -1, 3.01, 4), building(4, 4, 7, 7)]);
  const thin = constrainChaseCameraPose(pose([8, 3, 0]), blocked);
  assert.ok(thin.position[0] < 3 - CAMERA_CLEARANCE);
  assert.equal(blocked(...thin.position, CAMERA_CLEARANCE), false);
  const corner = constrainChaseCameraPose(pose([8, 3, 8]), blocked);
  assert.equal(blocked(...corner.position, CAMERA_CLEARANCE), false);
  assert.ok(corner.position[0] < 4 && corner.position[2] < 4);
});

test('near-plane clearance scales with the clipped distance in a narrow corridor', () => {
  const blocked = createCameraBlocker([building(-2, -10, 50, -0.5), building(-2, 0.5, 50, 10)]);
  const actual = constrainChaseCameraPose(pose([40, 4, 0], [0, 1.2, 0], 40), blocked, 1.2);
  assert.ok(actual.position[0] > 8 && actual.position[0] < 20, 'keeps a useful eye distance instead of collapsing to the player');
  assert.equal(blocked(...actual.position, 1.2 * actual.position[0] / 40), false);
});

test('building heights and courtyard holes leave genuinely open sightlines alone', () => {
  const low = createCameraBlocker([building(2, -2, 6, 2, 2)]);
  const above = pose([8, 5, 0], [0, 3, 0]);
  const expected = structuredClone(above);
  constrainChaseCameraPose(above, low);
  assert.deepEqual(above, expected, 'a raised target and camera clear the low roof');
  const tall = createCameraBlocker([building(2, -2, 6, 2, 8)]);
  const clipped = constrainChaseCameraPose(pose([8, 5, 0], [0, 3, 0]), tall);
  assert.ok(clipped.position[0] < 2);
  const courtyard = createCameraBlocker([building(-5, -5, 5, 5, 12, [[-2, -2, 2, -2, 2, 2, -2, 2]])]);
  assert.equal(courtyard(0, 1, 0, CAMERA_CLEARANCE), false);
  const inCourtyard = pose([1.5, 2, 0]);
  const courtyardExpected = structuredClone(inCourtyard);
  constrainChaseCameraPose(inCourtyard, courtyard);
  assert.deepEqual(inCourtyard, courtyardExpected);
});

test('stationary render frames reuse collision work, while orbit changes resolve again', () => {
  let checks = 0;
  const constrain = createChaseCameraConstraint(() => { checks++; return false; });
  constrain(pose([8, 4, 0]));
  const first = checks;
  constrain(pose([8, 4, 0]));
  assert.equal(checks, first);
  constrain(pose([0, 4, 8]));
  assert.ok(checks > first);
});
