// The Caller cannot walk through parked cars, poles or trunks; open sidewalk stays walkable.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset } from '../city-dataset.ts';
import { buildObstacles } from './obstacles.ts';
import { placeStreetFurniture } from './street-furniture.ts';
import { placeStreetProps } from './street-props.ts';
import { createStreetClearance } from './walkability.ts';

test('poles, parked cars and trunks block; a step off them is clear', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const clearance = createStreetClearance(dataset);
  const index = buildObstacles(dataset, clearance);
  const { signs, lights } = placeStreetFurniture(dataset, clearance);
  const { cars } = placeStreetProps(dataset, clearance, signs, lights);
  assert.ok(index.count > 1000, `${index.count} obstacles`);
  for (const l of lights.slice(0, 20)) assert.ok(index.blocked(l.x, l.z), 'a lamp pole blocks');
  for (const c of cars.slice(0, 20)) {
    assert.ok(index.blocked(c.x, c.z), 'a parked car blocks at its centre');
    assert.ok(index.blocked(c.x + c.dir[0] * 2, c.z + c.dir[1] * 2), 'and near its bumper');
  }
  const l = lights[0]!;
  assert.ok(!index.blocked(l.x + 2, l.z) || !index.blocked(l.x - 2, l.z), 'two metres off a pole is clear on one side');
});
