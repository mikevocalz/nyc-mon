import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CONTROLLER_PROFILE, type StickTuning } from './contract.ts';
import {
  DIRECTION_VECTORS,
  NEUTRAL_STICK,
  direction8,
  isSameReading,
  leverOffsetDp,
  leverTiltDeg,
  readStick,
  stickOrigin,
  thumbOffsetDp,
  toDigitalReading,
} from './stick-math.ts';

const tuning: StickTuning = DEFAULT_CONTROLLER_PROFILE.stick; // deadZone 0.15, sensitivity 1, clamp 56

const close = (actual: number, expected: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} expected ${expected}, got ${actual}`);

describe('readStick dead zone', () => {
  it('reads neutral inside the radial dead zone', () => {
    const edge = tuning.deadZone * tuning.clampRadiusDp;
    assert.deepEqual(readStick(0, 0, tuning), NEUTRAL_STICK);
    assert.deepEqual(readStick(edge * 0.99, 0, tuning), NEUTRAL_STICK);
    assert.deepEqual(readStick(edge, 0, tuning), NEUTRAL_STICK);
    assert.deepEqual(readStick(edge * 0.707, edge * 0.707, tuning), NEUTRAL_STICK); // hypot = 0.9998 × edge
  });

  it('is radial, not square: a diagonal just inside the circle stays neutral', () => {
    const edge = tuning.deadZone * tuning.clampRadiusDp;
    const r = readStick(edge * 0.7, edge * 0.7, tuning); // hypot = 0.99 * edge
    assert.equal(r.engaged, false);
  });

  it('ramps from 0 at the dead-zone edge to 1 at the clamp radius', () => {
    const edge = tuning.deadZone * tuning.clampRadiusDp;
    const halfway = edge + (tuning.clampRadiusDp - edge) / 2;
    const r = readStick(halfway, 0, tuning);
    close(r.x, 0.5);
    assert.equal(r.y, 0);
    assert.equal(r.engaged, true);
    assert.equal(r.direction, 'e');
  });
});

describe('readStick axes and clamp', () => {
  it('maps screen down to −y (contract: +y is up)', () => {
    const r = readStick(0, tuning.clampRadiusDp, tuning);
    close(r.x, 0);
    close(r.y, -1);
    assert.equal(r.direction, 's');
  });

  it('clamps magnitude at the clamp radius', () => {
    const r = readStick(0, -500, tuning);
    close(r.y, 1);
    assert.equal(r.direction, 'n');
  });

  it('never reads a (1, 1) corner: diagonals stay on the unit circle', () => {
    const r = readStick(500, -500, tuning);
    close(Math.hypot(r.x, r.y), 1, 'magnitude');
    close(r.x, Math.SQRT1_2);
    close(r.y, Math.SQRT1_2);
    assert.equal(r.direction, 'ne');
  });

  it('applies sensitivity after the dead zone and still clamps', () => {
    const hot: StickTuning = { ...tuning, sensitivity: 2 };
    const edge = hot.deadZone * hot.clampRadiusDp;
    const quarter = edge + (hot.clampRadiusDp - edge) / 4;
    close(readStick(quarter, 0, hot).x, 0.5);
    close(readStick(hot.clampRadiusDp, 0, hot).x, 1);
    const soft: StickTuning = { ...tuning, sensitivity: 0.5 };
    close(readStick(soft.clampRadiusDp, 0, soft).x, 0.5);
  });

  it('reads neutral for non-finite input and a bad clamp radius instead of throwing', () => {
    assert.deepEqual(readStick(Number.NaN, 0, tuning), NEUTRAL_STICK);
    assert.deepEqual(readStick(0, Number.POSITIVE_INFINITY, tuning), NEUTRAL_STICK);
    assert.deepEqual(readStick(10, 10, { ...tuning, clampRadiusDp: 0 }), NEUTRAL_STICK);
  });
});

describe('direction8', () => {
  it('centres each 45° sector on its compass point', () => {
    assert.equal(direction8(1, 0), 'e');
    assert.equal(direction8(1, 1), 'ne');
    assert.equal(direction8(0, 1), 'n');
    assert.equal(direction8(-1, 1), 'nw');
    assert.equal(direction8(-1, 0), 'w');
    assert.equal(direction8(-1, -1), 'sw');
    assert.equal(direction8(0, -1), 's');
    assert.equal(direction8(1, -1), 'se');
  });

  it('switches sector at ±22.5° from the cardinal', () => {
    const at = (deg: number) => direction8(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180));
    assert.equal(at(22), 'e');
    assert.equal(at(23), 'ne');
    assert.equal(at(-22), 'e');
    assert.equal(at(-23), 'se');
    assert.equal(at(180), 'w');
  });

  it('is none for a zero or non-finite vector', () => {
    assert.equal(direction8(0, 0), 'none');
    assert.equal(direction8(Number.NaN, 1), 'none');
  });
});

describe('toDigitalReading', () => {
  it('snaps an engaged reading to the unit vector of its direction', () => {
    const analog = readStick(40, -10, tuning);
    const digital = toDigitalReading(analog);
    assert.equal(digital.direction, analog.direction);
    assert.deepEqual({ x: digital.x, y: digital.y }, DIRECTION_VECTORS[analog.direction]);
    close(Math.hypot(digital.x, digital.y), 1);
  });

  it('keeps neutral neutral', () => {
    assert.deepEqual(toDigitalReading(NEUTRAL_STICK), NEUTRAL_STICK);
  });

  it('gives every direction a unit vector', () => {
    for (const [direction, v] of Object.entries(DIRECTION_VECTORS)) {
      if (direction === 'none') continue;
      close(Math.hypot(v.x, v.y), 1, direction);
    }
  });
});

describe('visual helpers', () => {
  it('thumbOffsetDp flips y back to layout space and scales by the clamp radius', () => {
    const r = readStick(0, -tuning.clampRadiusDp, tuning); // finger up → y = 1
    assert.deepEqual(thumbOffsetDp(r, 56), { x: 0, y: -56 });
    assert.deepEqual(thumbOffsetDp(NEUTRAL_STICK, 56), { x: 0, y: 0 });
  });

  it('isSameReading compares every field', () => {
    assert.ok(isSameReading(NEUTRAL_STICK, { ...NEUTRAL_STICK }));
    assert.ok(!isSameReading(NEUTRAL_STICK, { ...NEUTRAL_STICK, engaged: true }));
  });
});

describe('stickOrigin', () => {
  const bounds = { width: 200, height: 200 };

  it('fixed placement always centres', () => {
    assert.deepEqual(stickOrigin('fixed', 10, 10, bounds, 56), { x: 100, y: 100 });
  });

  it('floating placement starts where the finger lands', () => {
    assert.deepEqual(stickOrigin('floating', 90, 120, bounds, 56), { x: 90, y: 120 });
  });

  it('floating placement keeps the whole clamp circle inside the bounds', () => {
    assert.deepEqual(stickOrigin('floating', 5, 195, bounds, 56), { x: 56, y: 144 });
  });

  it('centres an axis the bounds cannot hold', () => {
    assert.deepEqual(stickOrigin('floating', 5, 5, { width: 100, height: 300 }, 56), { x: 50, y: 56 });
  });

  it('falls back to the centre for a non-finite touch', () => {
    assert.deepEqual(stickOrigin('floating', Number.NaN, 5, bounds, 56), { x: 100, y: 100 });
  });
});

describe('leverOffsetDp (arcade lever pad)', () => {
  const analog = { mode: 'analog' as const, clampRadiusDp: 56, travelDp: 36 };
  const dpad = { mode: 'dpad' as const, clampRadiusDp: 56, travelDp: 36 };

  it('follows the finger inside the dead zone while the reading stays neutral', () => {
    const offset = leverOffsetDp(4, 0, readStick(4, 0, tuning), analog);
    close(offset.x, 4 * (36 / 56));
    close(offset.y, 0);
    assert.deepEqual(readStick(4, 0, tuning), NEUTRAL_STICK);
  });

  it('reaches the gate exactly at the clamp radius and stops there', () => {
    close(leverOffsetDp(56, 0, readStick(56, 0, tuning), analog).x, 36);
    const far = leverOffsetDp(300, -400, readStick(300, -400, tuning), analog);
    close(Math.hypot(far.x, far.y), 36);
    close(far.x / far.y, 300 / -400, 'direction kept');
  });

  it('keeps screen axes: +y down in, +y down out', () => {
    const offset = leverOffsetDp(0, 20, readStick(0, 20, tuning), analog);
    assert.ok(offset.y > 0);
  });

  it('snaps to eight notches on the octagonal gate in D-pad mode, centre inside the dead zone', () => {
    const ne = toDigitalReading(readStick(30, -30, tuning));
    const offset = leverOffsetDp(30, -30, ne, dpad);
    close(offset.x, 36 * Math.SQRT1_2);
    close(offset.y, -36 * Math.SQRT1_2);
    close(Math.hypot(offset.x, offset.y), 36, 'diagonal notch on the same radius');
    const east = leverOffsetDp(10, 3, toDigitalReading(readStick(10, 3, tuning)), dpad);
    assert.deepEqual(east, { x: 36, y: 0 });
    assert.deepEqual(leverOffsetDp(2, 0, toDigitalReading(readStick(2, 0, tuning)), dpad), { x: 0, y: 0 });
  });

  it('centres on bad input', () => {
    assert.deepEqual(leverOffsetDp(Number.NaN, 0, NEUTRAL_STICK, analog), { x: 0, y: 0 });
    assert.deepEqual(leverOffsetDp(10, 0, NEUTRAL_STICK, { ...analog, clampRadiusDp: 0 }), { x: 0, y: 0 });
  });
});

describe('leverTiltDeg', () => {
  it('leans toward the push and reaches maxDeg at the gate', () => {
    assert.deepEqual(leverTiltDeg({ x: 36, y: 0 }, 36, 14), { rotateX: 0, rotateY: 14 });
    assert.deepEqual(leverTiltDeg({ x: 0, y: -36 }, 36, 14), { rotateX: 14, rotateY: 0 });
    assert.deepEqual(leverTiltDeg({ x: 0, y: 0 }, 36, 14), { rotateX: 0, rotateY: 0 });
    assert.deepEqual(leverTiltDeg({ x: 5, y: 5 }, 0, 14), { rotateX: 0, rotateY: 0 });
  });
});
