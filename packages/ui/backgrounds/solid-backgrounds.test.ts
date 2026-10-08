import assert from 'node:assert/strict';
import test from 'node:test';
import { citySkylineLayers } from './city-skyline-model.ts';
import { DISTRICTS, skyBands, THEMES } from './district-theme.ts';
import { blockHeight, FLOORS_PER_BLOCK, heightfieldLayers } from './heightfield-model.ts';
import { glyphMask, glyphPixels, glyphPool } from './pixel-font.ts';
import { composeLayers, Kind, QUAD_STRIDE, QuadWriter, type Layer } from './quad-writer.ts';
import { paneColumns, rainWindowLayers, streakAt } from './rain-window-model.ts';
import { crestY, riverTideLayers } from './river-tide-model.ts';
import { headRow, rainColumns, signRainLayers, STREET_CHARACTERS } from './sign-rain-model.ts';
import { buildSkyline } from './skyline-model.ts';
import { depthY, gridSceneLayers, streetFloorLayers } from './street-floor-model.ts';
import { pulsePath, slicePath, streetPulseLayers } from './street-pulse-model.ts';
import { buildRoutes, pointAlong, subwayLayers } from './subway-model.ts';

const frame = (width: number, height: number, time = 1) => ({ width, height, time, pointer: { x: width / 2, y: height * 0.7, inside: true } });

function paint(layers: Layer[], width = 800, height = 500, time = 1) {
  const out = new QuadWriter();
  composeLayers(out, layers, frame(width, height, time), new WeakMap(), new QuadWriter());
  return out;
}

function kinds(w: QuadWriter) {
  const seen = new Set<number>();
  for (let i = 0; i < w.count; i++) seen.add(w.data[i * QUAD_STRIDE + 16]!);
  return seen;
}

test('pixel font: masks are 15 bits and expand to the right pixels', () => {
  assert.equal(glyphMask(' '), 0);
  assert.equal(glyphMask('a'), glyphMask('A'));
  // "-" is the middle row only.
  assert.deepEqual(glyphPixels(glyphMask('-')), [[0, 2], [1, 2], [2, 2]]);
  assert.equal(glyphPixels(glyphMask('8')).length, 13);
  assert.ok(glyphPool(STREET_CHARACTERS).every((m) => m > 0 && m < 2 ** 15));
});

test('quad writer: grows, snapshots and skips transparent quads', () => {
  const w = new QuadWriter(1);
  w.rect(0, 0, 10, 10, [1, 0, 0, 1]);
  w.rect(0, 0, 10, 10, [1, 0, 0, 0]);
  w.disc(5, 5, 3, [0, 1, 0, 1]);
  assert.equal(w.count, 2);
  assert.equal(w.data[QUAD_STRIDE + 16], Kind.ROUND);
  assert.equal(w.snapshot().data.length, 2 * QUAD_STRIDE);
});

test('static layers are painted once per size; moving layers every frame', () => {
  let staticCalls = 0;
  let movingCalls = 0;
  const layers: Layer[] = [
    { static: true, paint: (w) => { staticCalls++; w.rect(0, 0, 1, 1, [1, 1, 1, 1]); } },
    { paint: (w) => { movingCalls++; w.rect(0, 0, 1, 1, [1, 1, 1, 1]); } },
  ];
  const cache = new WeakMap();
  const out = new QuadWriter();
  const scratch = new QuadWriter();
  for (let t = 0; t < 3; t++) composeLayers(out, layers, frame(100, 100, t), cache, scratch);
  composeLayers(out, layers, frame(200, 100), cache, scratch);
  assert.equal(staticCalls, 2);
  assert.equal(movingCalls, 4);
  assert.equal(out.count, 2);
});

test('skylines: deterministic, district-shaped, empty before layout', () => {
  const input = { x0: 0, x1: 900, ground: 500, maxHeight: 400, seed: 3 };
  for (const district of DISTRICTS) {
    const a = buildSkyline({ ...input, district });
    assert.deepEqual(a, buildSkyline({ ...input, district }));
    assert.ok(a.parts.length > 10, district);
  }
  // Downtown and Mega City carry spires and masts; Harlem's front rows don't.
  assert.ok(buildSkyline({ ...input, district: 'downtown' }).beacons.length > 0);
  assert.ok(buildSkyline({ ...input, district: 'megacity' }).beacons.length > 0);
  assert.equal(buildSkyline({ ...input, district: 'harlem' }).beacons.length, 0);
  // Harlem stays low; Downtown reaches higher.
  assert.ok(buildSkyline({ ...input, district: 'downtown' }).top < buildSkyline({ ...input, district: 'harlem' }).top);
  // A 1 x 1 canvas (before the first layout) builds nothing instead of looping.
  assert.equal(buildSkyline({ ...input, x1: 1, ground: 1, maxHeight: 1, district: 'midtown' }).parts.length, 0);
});

test('sky bands step from the top colour to the horizon', () => {
  const bands = skyBands(THEMES.midtown, 6);
  assert.equal(bands.length, 6);
  assert.equal(bands[0], THEMES.midtown.sky[0]!.toUpperCase());
});

test('sign rain: heads advance one row at a time and wrap', () => {
  const [col] = rainColumns(1, { speed: 33, windowShare: 0, seed: 1 });
  const rows = 40;
  const a = headRow(col!, rows, 0);
  const b = headRow(col!, rows, 1 / col!.rate);
  assert.equal((b - a + rows + col!.trail + 8) % (rows + col!.trail + 8), 1);
  assert.ok(headRow(col!, rows, 1e4) < rows + col!.trail + 8);
});

test('subway: routes run on 0/45/90 degree segments; pointAlong stays on the line', () => {
  const routes = buildRoutes(900, 600, 50, { district: 'downtown', color: null, seed: 1 });
  assert.ok(routes.length >= 4);
  for (const r of routes) {
    for (let k = 1; k < r.points.length; k++) {
      const dx = Math.abs(r.points[k]![0] - r.points[k - 1]![0]);
      const dy = Math.abs(r.points[k]![1] - r.points[k - 1]![1]);
      // Side-by-side offsets shift whole routes, so angles hold exactly.
      assert.ok(dx < 1e-6 || dy < 1e-6 || Math.abs(dx - dy) < 1e-6, `${dx},${dy}`);
    }
    const total = r.lengths[r.lengths.length - 1]!;
    const p = pointAlong(r, total / 2);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.deepEqual(pointAlong(r, total + 10), pointAlong(r, 10));
  }
});

test('street pulse: paths start off-grid, move on streets, slices sum to their span', () => {
  const path = pulsePath(800, 500, 50, 42);
  for (const [x, y] of path.points) assert.ok(x % 50 === 0 && y % 50 === 0, `${x},${y}`);
  const slice = slicePath(path.points, 100, 250);
  const len = slice.reduce((s, [a, b, c, d]) => s + Math.hypot(c - a, d - b), 0);
  assert.ok(Math.abs(len - Math.min(150, path.length - 100)) < 1e-6);
});

test('heightfield: heights snap to whole floors and the pointer lifts blocks', () => {
  const o = { district: 'midtown' as const, waveAmplitude: 0.8, waveFrequency: 1.5, waveSpeed: 1, bumpRadius: 3.5, bumpStrength: 2.5 };
  for (let x = -5; x < 5; x++) {
    const h = blockHeight(o, x, 10, 2, null);
    assert.equal(h * FLOORS_PER_BLOCK, Math.round(h * FLOORS_PER_BLOCK));
    assert.ok(h >= 1);
  }
  assert.ok(blockHeight(o, 0, 10, 2, { x: 0, z: 10 }) > blockHeight(o, 0, 10, 2, null));
});

test('river: bands crowd towards the far shore and stay in order', () => {
  const o = { amplitude: 0, frequency: 0.55, speed: 0.5, origin: 'top-right' as const };
  const ys = [0, 1, 2, 3, 4, 5, 6].map((k) => crestY(o, k, 7, 400, 200, 800, 0));
  for (let k = 1; k < ys.length; k++) assert.ok(ys[k]! > ys[k - 1]!);
  assert.ok(ys[1]! - ys[0]! < ys[6]! - ys[5]!);
});

test('rain window: streaks fall at the requested angle; panes follow the width', () => {
  const o = { speed: 12, angle: -15, dropMinLength: 15, dropMaxLength: 40, seed: 1 };
  const s = streakAt(o, 3, 800, 600, 0.5);
  const angle = (Math.atan2(s.hx - s.tx, s.hy - s.ty) * 180) / Math.PI;
  assert.ok(Math.abs(angle - -15) < 1e-6);
  assert.equal(paneColumns(390), 2);
  assert.equal(paneColumns(1280), 3);
});

test('street floor: the depth curve runs from edge to viewer', () => {
  assert.equal(depthY(300, 800, 0), 300);
  assert.equal(depthY(300, 800, 1), 800);
  assert.equal(depthY(300, 0, 1), 0);
});

test('every background paints solid shapes in every district', () => {
  for (const district of DISTRICTS) {
    const theme = THEMES[district];
    const sets: Layer[][] = [
      citySkylineLayers({ district, seed: 1, depth: 3, light: theme.light, vehicleColor: 'carolina', beaconColor: theme.beacon, skyColor: null, windowLights: true, showVehicles: true, blinkingLights: true, speed: 1 }),
      signRainLayers({ district, textColor: theme.accent, signColor: 'leaf', bgColor: '#00041C', fontSize: 18, speed: 33, characters: STREET_CHARACTERS, windowShare: 0.25, skyline: true, seed: 1 }),
      subwayLayers({ district, color: null, lineThickness: 2, dotSize: 3, dotType: 'filled', glowColor: 'white', glowIntensity: 'medium', trains: true, speed: 1, seed: 1 }),
      streetPulseLayers({ district, lineColor: theme.accent, shadowColor: theme.accent, bgGridColor: theme.block, cellSize: 50, maxLines: 12, baseSpeed: 2, lineLength: 150, spawnProbability: 0.1, overlay: true, seed: 1, hoverEffect: true, hoverColor: 'orange' }),
      heightfieldLayers({ district, lineColor: theme.accent, bgColor: '#00041C', waveAmplitude: 0.8, waveFrequency: 1.5, waveSpeed: 1, bumpRadius: 3.5, bumpStrength: 2.5, gridSegments: 10, cameraHeight: 10, fog: true, hoverEffect: true, windowLights: true }),
      riverTideLayers({ district, colorA: null, colorB: null, bgColor: '#00041C', origin: 'top-right', speed: 0.5, amplitude: 1.2, frequency: 0.55, glow: 0.9, gloss: 0.6, bands: 7, shore: true, horizon: 0.34, hoverEffect: true, hoverRadius: 4, hoverStrength: 1.4, seed: 1 }),
      rainWindowLayers({ district, dropColor: 'carolina', dropCount: 150, speed: 12, angle: -15, dropMinLength: 15, dropMaxLength: 40, dropWidth: 1, opacity: 0.75, backgroundColor: '#00041C', frame: true, seed: 1 }),
      streetFloorLayers({ district, horizon: 0.45, columns: 24, rows: 18, lineColor: theme.accent, glowColor: 'royal', horizonGlowColor: 'carolina', bgColor: '#00041C', speed: 0.6, lineWidth: 1, skyline: true, seed: 1 }),
      gridSceneLayers({ district, horizon: 0.5, gap: 0.08, columns: 24, rows: 18, lineColor: theme.accent, glowColor: 'carolina', bgColor: '#00041C', speed: 0.6, lineWidth: 1, showCeiling: true, showFloor: true }),
    ];
    for (const layers of sets) {
      const w = paint(layers);
      assert.ok(w.count > 20, `${district}: ${w.count}`);
      assert.ok(kinds(w).has(Kind.FLAT), district);
      for (let i = 0; i < w.count * QUAD_STRIDE; i++) assert.ok(Number.isFinite(w.data[i]), `${district} NaN at ${i}`);
    }
  }
});

test('street pulse lights the block under the pointer, and only when hovering a block', () => {
  const opts = { district: 'midtown' as const, lineColor: 'orange', shadowColor: 'orange', bgGridColor: '#1f2a44', cellSize: 50, maxLines: 0, baseSpeed: 2, lineLength: 150, spawnProbability: 0.1, overlay: false, seed: 1, hoverColor: 'orange' };
  const at = (layers: Layer[], x: number, y: number, inside = true) => {
    const out = new QuadWriter();
    composeLayers(out, layers, { width: 800, height: 500, time: 1, pointer: { x, y, inside } }, new WeakMap(), new QuadWriter());
    return out.count;
  };
  const base = at(streetPulseLayers({ ...opts, hoverEffect: false }), 125, 125);
  const hovering = streetPulseLayers({ ...opts, hoverEffect: true });
  // Inside the block at column 2, row 2: two extra quads (plate and kerb).
  assert.equal(at(hovering, 125, 125), base + 2);
  // On the street between blocks, or with the pointer outside: no plate.
  assert.equal(at(hovering, 100, 125), base);
  assert.equal(at(hovering, 125, 125, false), base);
});
