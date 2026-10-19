import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CSNAP_HEADER,
  CSNAP_STRIDE,
  CityClock,
  cityClockSkyName,
  dayFactorAt,
  packEnvSection,
  readEnvSection,
} from './clock.ts';

// --- The daylight curve ----------------------------------------------------------

test('dayFactor: 1 midday, 0 overnight, smooth ramps through dawn and dusk', () => {
  assert.equal(dayFactorAt(12), 1);
  assert.equal(dayFactorAt(2), 0);
  assert.equal(dayFactorAt(23), 0);
  const dawn = dayFactorAt(6.5);
  assert.ok(dawn > 0.3 && dawn < 0.7, `dawn centre sits mid-ramp (got ${dawn})`);
  const dusk = dayFactorAt(19.5);
  assert.ok(dusk > 0.3 && dusk < 0.7, `dusk centre sits mid-ramp (got ${dusk})`);
  // Monotone through each ramp: the curve never flickers.
  let prev = dayFactorAt(4);
  for (let h = 4; h <= 9; h += 0.25) {
    const v = dayFactorAt(h);
    assert.ok(v >= prev - 1e-9, `dawn ramp is monotone at ${h}`);
    prev = v;
  }
  prev = dayFactorAt(18);
  for (let h = 18; h <= 23; h += 0.25) {
    const v = dayFactorAt(h);
    assert.ok(v <= prev + 1e-9, `dusk ramp is monotone at ${h}`);
    prev = v;
  }
});

// --- Lamp + headlight thresholds ---------------------------------------------------

test('lamp level: off in daylight, fully lit at night, smooth through dusk', () => {
  const noon = new CityClock({ startHour: 12 });
  assert.equal(noon.state().lampLevel, 0, 'lamps off at noon');
  const night = new CityClock({ startHour: 2 });
  assert.equal(night.state().lampLevel, 1, 'lamps fully lit overnight');
  const dusk = new CityClock({ startHour: 20.0 });
  const level = dusk.state().lampLevel;
  assert.ok(level > 0 && level < 1, `dusk sits mid-fade (got ${level})`);
  // Monotone with the clock: stepping from 17:00 to 21:00 only brightens the lamps.
  const sweep = new CityClock({ startHour: 17, hoursPerSimSecond: 1 / 60 });
  let last = -1;
  for (let i = 0; i < 60 * 4 + 1; i++) {
    const l = sweep.state().lampLevel;
    assert.ok(l >= last - 1e-9, 'lamp level never dips through dusk');
    last = l;
    sweep.step(1);
  }
  assert.equal(last, 1);
});

test('headlights: required at night and through dusk, off in daylight', () => {
  assert.equal(new CityClock({ startHour: 12 }).state().headlights, 0);
  assert.equal(new CityClock({ startHour: 2 }).state().headlights, 1);
  assert.equal(new CityClock({ startHour: 19.4 }).state().headlights, 1, 'evening gloom requires headlights');
});

// --- Rain toggle -------------------------------------------------------------------

test('rain darkens the effective day: lamps and headlights arrive early in a storm', () => {
  const dry = new CityClock({ startHour: 19.5 });
  const wet = new CityClock({ startHour: 19.5, rain: 0.8 });
  const d = dry.state();
  const w = wet.state();
  assert.equal(d.dayFactor, w.dayFactor, 'rain never touches the sun itself');
  assert.ok(w.effectiveDayFactor < d.effectiveDayFactor, 'gloom lowers what lamps read');
  assert.ok(w.lampLevel > d.lampLevel, 'rain boosts the lamp drive through dusk');
  // A mid-afternoon storm pushes the effective day under the headlight rule.
  const storm = new CityClock({ startHour: 16.0, rain: 1 });
  const clear = new CityClock({ startHour: 16.0 });
  assert.equal(clear.state().headlights, 0, 'dry 16:00 still has daylight headlights off');
  assert.equal(storm.state().headlights, 1, 'a heavy 16:00 storm wants headlights');
});

// --- Env section codec --------------------------------------------------------------

test('env section round-trips the clock state byte-for-byte', () => {
  const clock = new CityClock({ startHour: 19.2, rain: 0.35 });
  const state = clock.state();
  const packed = packEnvSection(state, 42.5);
  assert.equal(packed.length, CSNAP_HEADER + CSNAP_STRIDE);
  const snap = new Array(64).fill(-7);
  packed.forEach((v, i) => {
    snap[40 + i] = v;
  });
  const env = readEnvSection(snap, 40, 0);
  assert.equal(env.hour, state.hour);
  assert.equal(env.dayFactor, state.dayFactor);
  assert.equal(env.lampLevel, state.lampLevel);
  assert.equal(env.headlights, state.headlights);
  assert.equal(env.rain, state.rain);
  assert.equal(env.simTime, 42.5);
  // Derived, not packed: the reader recomputes the rain-gloom factor identically.
  assert.ok(Math.abs(env.effectiveDayFactor - state.effectiveDayFactor) < 1e-9);
});

test('a snapshot that predates the env section reads the daytime default', () => {
  const env = readEnvSection([0, 0, 0], 0, 9.5);
  assert.equal(env.lampLevel, 0, 'old buffers read lamps-off daylight');
  assert.equal(env.headlights, 0);
  assert.equal(env.rain, 0);
  assert.equal(env.simTime, 9.5, 'simTime falls back to the caller (the vehicle header)');
});

test('clock determinism: equal options and equal steps land on identical states', () => {
  const a = new CityClock({ startHour: 18.5, hoursPerSimSecond: 1 / 60, rain: 0.2 });
  const b = new CityClock({ startHour: 18.5, hoursPerSimSecond: 1 / 60, rain: 0.2 });
  for (let i = 0; i < 500; i++) {
    a.step(1 / 24);
    b.step(1 / 24);
  }
  assert.deepEqual(a.state(), b.state());
});

test('sky pick: the hour maps onto the rig presets', () => {
  assert.equal(cityClockSkyName(12), 'morning');
  assert.equal(cityClockSkyName(18.66), 'dusk', 'the slice opens on the dusk preset');
  assert.equal(cityClockSkyName(2), 'night');
  assert.equal(cityClockSkyName(22.5), 'night');
});
