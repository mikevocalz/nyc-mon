import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCityDataset } from './city-dataset.ts';
import { BODY_RADIUS, createWalkQueries } from './world/walkability.ts';
import { syntheticTileV2 } from './world/synthetic-tile.ts';

const walk = createWalkQueries(parseCityDataset(syntheticTileV2()));

test('roads and their sidewalks are walkable', () => {
  assert.equal(walk.isWalkable(30, 10), true, 'carriageway');
  assert.equal(walk.isWalkable(30, 10 + 4.5 + 4), true, 'sidewalk, 4.5 m + 4 m from the centreline');
  assert.equal(walk.isWalkable(30, 10 + 4.5 + 4.5 + 1), false, 'past the sidewalk, inside the block');
});

test('parks are walkable, building footprints are not, and walls keep the body radius', () => {
  assert.equal(walk.isWalkable(-25, 55), true, 'park');
  assert.equal(walk.isWalkable(10, -7), false, 'inside a building');
  assert.equal(walk.isWalkable(10, 0 + BODY_RADIUS / 2), false, 'shoulder in the wall');
});

test('outside the tile and non-finite input are blocked; ground is flat', () => {
  assert.equal(walk.isWalkable(5000, 0), false);
  assert.equal(walk.isWalkable(Number.NaN, 0), false);
  assert.equal(walk.groundHeight(1, 2), 0);
  assert.ok(Number.isNaN(walk.groundHeight(Number.NaN, 0)));
});
