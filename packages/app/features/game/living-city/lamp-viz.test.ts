import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CityDatasetV3, CityRoad } from '../city-dataset.ts';
import { placeStreetFurniture } from '../world/street-furniture.ts';
import { createStreetClearance } from '../world/walkability.ts';
import { LAMP_RAIN_BOOST, lampDrive, lampPlacements } from './lamp-viz.ts';

// --- Env → lamp drive ---------------------------------------------------------------

test('lamp drive follows the clock: off by day, full at night, clamped', () => {
  assert.equal(lampDrive(0, 0), 0, 'daylight keeps the glow layer dark');
  assert.equal(lampDrive(1, 0), 1, 'night lights the lamps fully');
  assert.equal(lampDrive(0.5, 0), 0.5, 'mid-dusk passes the fade through');
  assert.equal(lampDrive(2, 0), 1, 'clamped at full');
});

test('rain boosts the lamp drive — brighter halos, stronger pools — and never dims', () => {
  const level = 0.6;
  const wet = lampDrive(level, 1);
  assert.equal(wet, level * (1 + LAMP_RAIN_BOOST), 'rain multiplies the drive by the boost');
  assert.ok(wet > lampDrive(level, 0));
  assert.equal(lampDrive(level, 0.5), level * (1 + LAMP_RAIN_BOOST * 0.5), 'the boost scales with intensity');
  assert.equal(lampDrive(0, 1), 0, 'rain alone never lights the lamps — the clock rules');
  assert.equal(lampDrive(1, 1), 1, 'the drive still clamps at full');
  assert.ok(lampDrive(0.5, -0.5) <= lampDrive(0.5, 0) + 1e-9, 'negative rain is clamped, never a dimmer');
});

// --- Placement parity with the world's own furniture ---------------------------------

function tile(roads: CityRoad[]): CityDatasetV3 {
  return {
    version: 3, id: 't', origin: [-73.95, 40.81], extentMeters: 400,
    sources: [{ url: 'https://www.openstreetmap.org/copyright', attribution: 't', license: 'ODbL-1.0', retrievedAt: '2026-10-16T00:00:00Z' }],
    notes: [], buildings: [], areas: [], landmarks: [], roads,
    trees: { census: [], fill: [] }, transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
  };
}

const road = (id: string, cls: CityRoad['class'], points: number[], width: number): CityRoad => ({
  id, class: cls, widthMeters: width, sidewalkMeters: 3, points, widthEstimated: false,
});

test('lamp placements reuse the world streetlight layout pole-for-pole', () => {
  const dataset = tile([
    road('a', 'residential', [-150, 0, 150, 0], 10),
    road('b', 'residential', [0, -150, 0, 150], 10),
  ]);
  const clearance = createStreetClearance(dataset);
  const world = placeStreetFurniture(dataset, clearance);
  const lamps = lampPlacements(dataset, clearance);
  assert.ok(world.lights.length > 0, 'the fixture actually places streetlights');
  assert.equal(lamps.length, world.lights.length, 'one glow+pool per world streetlight — no second placement pass');
  for (let i = 0; i < lamps.length; i++) {
    const l = lamps[i]!;
    const w = world.lights[i]!;
    assert.equal(l.x, w.x, `pole x agrees on lamp ${i}`);
    assert.equal(l.z, w.z, `pole z agrees on lamp ${i}`);
    assert.equal(l.faceX, w.face[0]);
    assert.equal(l.faceZ, w.face[1]);
    // The halo sits at the head (over the carriageway, pole height minus the head drop).
    assert.ok(l.glowY > 6, 'the glow reads at lamp-head height');
    assert.ok(Math.abs(l.glowX - (l.x + l.faceX * 0.6)) < 1e-9);
    assert.ok(Math.abs(l.poolX - (l.x + l.faceX * 1.8)) < 1e-9, 'the pool sits where the world pools it');
  }
});
