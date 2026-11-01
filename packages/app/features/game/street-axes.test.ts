import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INITIAL_CITY_CAMERA } from './city-camera.ts';
import { parseCityDataset } from './city-dataset.ts';
import {
  MANHATTAN_GRID_BEARING_DEG,
  axisMisalignment,
  axisYawFor,
  createStreetAxisIndex,
  gridAxisYaw,
  shortestTurn,
  streetAxisNear,
  yawAlongAxis,
} from './street-axes.ts';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const deg = (d: number) => (d * Math.PI) / 180;
/** Compass bearing (mod 180) of an axis yaw: bearing b looks along yaw -b. */
const bearingOf = (axisYaw: number) => ((((-axisYaw * 180) / Math.PI) % 180) + 180) % 180;

test('a street running along x is yaw π/2; one along z is yaw 0; direction does not matter', () => {
  assert.ok(near(axisYawFor(-10, 0), Math.PI / 2));
  assert.ok(near(axisYawFor(10, 0), Math.PI / 2));
  assert.ok(near(axisYawFor(0, -10), 0));
  assert.ok(near(axisYawFor(0, 10), 0));
  assert.ok(near(axisMisalignment(Math.PI / 2 + Math.PI, Math.PI / 2), 0));
  assert.ok(near(axisMisalignment(0, Math.PI / 2), Math.PI / 2));
});

test('the picker snaps to the way down the axis nearer the current view', () => {
  assert.ok(near(yawAlongAxis(Math.PI / 2 + 0.3, Math.PI / 2), Math.PI / 2));
  assert.ok(near(yawAlongAxis(3 * Math.PI / 2 - 0.3, Math.PI / 2), 3 * Math.PI / 2));
  // A right-angle tie goes to the way that looks along the preferred yaw.
  assert.ok(near(yawAlongAxis(Math.PI / 2, 0, 0, deg(20)), 0));
  assert.ok(near(yawAlongAxis(Math.PI / 2, 0, Math.PI, deg(20)), Math.PI));
});

const crossroads = createStreetAxisIndex([
  { class: 'primary', points: [-200, 0, 200, 0] },
  { class: 'secondary', points: [0, -200, 0, 200] },
  { class: 'crossing', points: [50, -10, 50, 10] },
  { class: 'service', points: [-40, 10, -10, 40] },
  { class: 'residential', points: [100, 100, 101, 101] },
]);

test('only street-run classes and segments over 4 m are indexed', () => {
  assert.equal(crossroads.segmentCount, 2);
});

test('nearest street axis: the one along the reference wins at a corner; distance breaks ties', () => {
  // At the corner, looking roughly north picks the north-south avenue; roughly west picks the east-west street.
  assert.ok(near(streetAxisNear(crossroads, 1, 1, deg(10))!.axisYaw, 0));
  assert.ok(near(streetAxisNear(crossroads, 1, 1, deg(80))!.axisYaw, Math.PI / 2));
  // Mid-block on the east-west street, the crossing over it is ignored, and the far avenue is out of reach.
  const midBlock = streetAxisNear(crossroads, 50, 3, 0)!;
  assert.ok(near(midBlock.axisYaw, Math.PI / 2));
  assert.ok(near(midBlock.distance, 3));
  assert.equal(streetAxisNear(crossroads, 150, 150, 0), null, 'nothing within 30 m');
  assert.equal(streetAxisNear(crossroads, Number.NaN, 0, 0), null);
});

test('the grid fallback runs at 29° and 119°', () => {
  assert.ok(near(bearingOf(gridAxisYaw(-deg(30))), MANHATTAN_GRID_BEARING_DEG, 1e-6));
  assert.ok(near(bearingOf(gridAxisYaw(-deg(120))), MANHATTAN_GRID_BEARING_DEG + 90, 1e-6));
});

test('on the bundled tile, the Apollo sidewalk settles onto West 125th Street', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')));
  const index = createStreetAxisIndex(dataset.roads);
  const hit = streetAxisNear(index, INITIAL_CITY_CAMERA.x, INITIAL_CITY_CAMERA.z, INITIAL_CITY_CAMERA.yaw)!;
  assert.ok(hit !== null);
  // 125th runs at about 119° (grid 29° + 90°).
  assert.ok(Math.abs(bearingOf(hit.axisYaw) - 119) < 3, `bearing ${bearingOf(hit.axisYaw)}`);
  // The starting view (due west) is 29° off the street, so a settle turns it about 29° onto the street.
  const target = yawAlongAxis(INITIAL_CITY_CAMERA.yaw, hit.axisYaw);
  const turn = Math.abs(shortestTurn(INITIAL_CITY_CAMERA.yaw, target));
  assert.ok(turn > deg(20) && turn < deg(35), `turn ${(turn * 180) / Math.PI}°`);
});
