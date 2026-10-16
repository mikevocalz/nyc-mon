import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampIntoRegion, largestClearRect, regionFor, usableRegions, type Rect } from './geometry.ts';
import {
  CONTROL_SCALE_MAX,
  CONTROL_SCALE_MIN,
  EMPTY_SAVED_LAYOUTS,
  MAX_OFFSET_DP,
  clampControlOffset,
  clampControlScale,
  parseControlOffset,
  parseSavedControlLayouts,
  parseSavedProfileLayout,
  revalidatePosition,
} from './revalidate-positions.ts';

const none = { top: 0, right: 0, bottom: 0, left: 0 };

/* ---------- shape validation: invalid saved data is never trusted ---------- */

test('parseSavedControlLayouts drops unknown profiles, non-objects and invalid fields', () => {
  const parsed = parseSavedControlLayouts({
    'phone-portrait': { stick: { dx: 10, dy: -20 }, cluster: 'nope', scale: 1.1 },
    'fold-book': { stick: { dx: Number.NaN, dy: 0 } },
    tablet: { scale: 9 },
    'not-a-profile': { stick: { dx: 1, dy: 1 } },
    web: null,
  });
  assert.deepEqual(parsed, { 'phone-portrait': { stick: { dx: 10, dy: -20 }, scale: 1.1 } });
});

test('parseSavedControlLayouts returns the empty map for anything that is not an object', () => {
  for (const raw of [null, undefined, 42, 'x', [], true]) {
    assert.equal(parseSavedControlLayouts(raw), EMPTY_SAVED_LAYOUTS);
  }
});

test('parseControlOffset rejects strings, infinities, and offsets beyond the sane range', () => {
  assert.equal(parseControlOffset({ dx: '1', dy: 2 }), undefined);
  assert.equal(parseControlOffset({ dx: Infinity, dy: 2 }), undefined);
  assert.equal(parseControlOffset({ dx: MAX_OFFSET_DP + 1, dy: 0 }), undefined);
  assert.deepEqual(parseControlOffset({ dx: -MAX_OFFSET_DP, dy: MAX_OFFSET_DP }), { dx: -MAX_OFFSET_DP, dy: MAX_OFFSET_DP });
  assert.deepEqual(parseControlOffset({ dx: 1, dy: 2, extra: true }), { dx: 1, dy: 2 });
});

test('parseSavedProfileLayout returns undefined when nothing valid remains', () => {
  assert.equal(parseSavedProfileLayout({ stick: {}, scale: 'big' }), undefined);
  assert.equal(parseSavedProfileLayout({ scale: CONTROL_SCALE_MIN - 0.01 }), undefined);
  assert.deepEqual(parseSavedProfileLayout({ scale: CONTROL_SCALE_MAX }), { scale: CONTROL_SCALE_MAX });
});

test('clampControlOffset and clampControlScale clamp finite values and throw on non-finite ones', () => {
  assert.deepEqual(clampControlOffset({ dx: 99999, dy: -99999 }), { dx: MAX_OFFSET_DP, dy: -MAX_OFFSET_DP });
  assert.equal(clampControlScale(3), CONTROL_SCALE_MAX);
  assert.equal(clampControlScale(0.1), CONTROL_SCALE_MIN);
  assert.throws(() => clampControlOffset({ dx: Number.NaN, dy: 0 }), RangeError);
  assert.throws(() => clampControlScale(Infinity), RangeError);
});

/* ---------- geometry revalidation on metrics change ---------- */

const regions = usableRegions(840, 700, none, [
  { orientation: 'vertical', state: 'halfOpened', posture: 'book', separating: true, x: 420, y: 0, width: 0, height: 700 },
]);
const stickDefault: Rect = { x: 16, y: 556, width: 128, height: 128 };

test('no offset: the default rect is kept inside its region without an extra margin', () => {
  assert.deepEqual(revalidatePosition(stickDefault, undefined, regions, 16), stickDefault);
  const tooBig: Rect = { x: 0, y: 0, width: 1000, height: 50 };
  const fitted = revalidatePosition(tooBig, undefined, regions, 16);
  assert.equal(fitted.width, 420);
});

test('an offset across the hinge stops at the hinge-side margin of the segment the rect mostly lands in', () => {
  const nudged = revalidatePosition(stickDefault, { dx: 300, dy: 0 }, regions, 16);
  assert.equal(nudged.x + nudged.width, 420 - 16);
  // Mostly over the hinge onto the second segment: it lands in that segment, clear of the hinge.
  const crossed = revalidatePosition(stickDefault, { dx: 380, dy: 0 }, regions, 16);
  assert.equal(crossed.x, 420 + 16);
});

test('an offset far off-screen comes back inside the nearest region', () => {
  const lost = revalidatePosition(stickDefault, { dx: -4000, dy: 4000 }, regions, 16);
  assert.deepEqual(lost, { x: 16, y: 700 - 16 - 128, width: 128, height: 128 });
});

test('no regions at all: a zero-size rect at the default origin, never a throw', () => {
  assert.deepEqual(revalidatePosition(stickDefault, { dx: 5, dy: 5 }, [], 16), { ...stickDefault, width: 0, height: 0 });
});

test('regionFor picks the largest overlap, then the nearest centre', () => {
  const a: Rect = { x: 0, y: 0, width: 100, height: 100 };
  const b: Rect = { x: 100, y: 0, width: 100, height: 100 };
  assert.equal(regionFor({ x: 70, y: 0, width: 80, height: 10 }, [a, b]), b);
  assert.equal(regionFor({ x: 50, y: 0, width: 80, height: 10 }, [a, b]), a);
  assert.equal(regionFor({ x: 500, y: 0, width: 10, height: 10 }, [a, b]), b);
  assert.equal(regionFor({ x: 0, y: 0, width: 1, height: 1 }, []), null);
});

test('clampIntoRegion keeps the margin and shrinks only what cannot fit', () => {
  const region: Rect = { x: 100, y: 100, width: 200, height: 100 };
  assert.deepEqual(clampIntoRegion({ x: 0, y: 0, width: 50, height: 50 }, region, 10), { x: 110, y: 110, width: 50, height: 50 });
  assert.deepEqual(clampIntoRegion({ x: 0, y: 0, width: 500, height: 50 }, region, 10), { x: 110, y: 110, width: 180, height: 50 });
});

test('largestClearRect avoids every obstacle with the gap and reports zero area when nothing is clear', () => {
  const region: Rect = { x: 0, y: 0, width: 400, height: 800 };
  const stage = largestClearRect(region, [{ x: 0, y: 700, width: 400, height: 100 }, { x: 116, y: 16, width: 168, height: 48 }], 8);
  assert.deepEqual(stage, { x: 0, y: 72, width: 400, height: 620 });
  const full = largestClearRect(region, [{ x: -8, y: -8, width: 416, height: 816 }], 0);
  assert.equal(full.width * full.height, 0);
});
