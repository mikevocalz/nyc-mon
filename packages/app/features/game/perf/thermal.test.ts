// PR5.1 thermal monitor: the classification boundaries between 'ok',
// 'warm' and 'hot' are pure — tests assert the status/headroom thresholds
// the down-step input fires on. The poller itself is device-side glue;
// the stub gamePerf() keeps this file loadable under node --test.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSkyRigFlag } from '../world/sky-rig.ts';
import {
  classifyThermal,
  EXPERIMENTAL_WORLD_THERMAL,
  THERMAL_HOT_HEADROOM,
  THERMAL_MODERATE_STATUS,
  THERMAL_SEVERE_STATUS,
  THERMAL_WARM_HEADROOM,
  thermalSignal,
  thermalWorsened,
} from './thermal.ts';
import { gamePerf } from '@acme/ui/game-perf';

const snap = (status: number, headroom: number | null, headroomForecast: number | null = null) => ({
  status,
  headroom,
  headroomForecast,
});

test('flag is opt-in and shares the rig-flag truth table', () => {
  for (const on of ['1', 'true', 'on', 'yes', ' TRUE ']) {
    assert.equal(parseSkyRigFlag(on), true, on);
  }
  for (const off of [undefined, null, '', '0', 'false', 'off']) {
    assert.equal(parseSkyRigFlag(off), false, String(off));
  }
  assert.equal(EXPERIMENTAL_WORLD_THERMAL, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_THERMAL));
});

test('the stub anchor answers no module so tests stay device-free', () => {
  assert.equal(gamePerf(), null);
});

test('nominal device reads as ok', () => {
  assert.equal(classifyThermal(snap(0, 0.0)), 'ok'); // THERMAL_STATUS_NONE, no headroom yet
  assert.equal(classifyThermal(snap(0, 0.5, 0.4)), 'ok');
  assert.equal(classifyThermal(snap(1, null, null)), 'ok'); // LIGHT below the moderate line
});

test('moderate status or 0.7 headroom is the warm edge — the early down-step', () => {
  assert.equal(classifyThermal(snap(THERMAL_MODERATE_STATUS, null)), 'warm');
  assert.equal(classifyThermal(snap(0, THERMAL_WARM_HEADROOM)), 'warm');
  assert.equal(classifyThermal(snap(0, 0.69)), 'ok', 'just below the warm headroom');
  assert.equal(classifyThermal(snap(0, null, THERMAL_WARM_HEADROOM)), 'warm', 'forecast counts');
});

test('severe status or 0.9 headroom is hot', () => {
  assert.equal(classifyThermal(snap(THERMAL_SEVERE_STATUS, null)), 'hot');
  assert.equal(classifyThermal(snap(6, null)), 'hot'); // EMERGENCY+
  assert.equal(classifyThermal(snap(0, THERMAL_HOT_HEADROOM)), 'hot');
  assert.equal(classifyThermal(snap(0, 0.5, THERMAL_HOT_HEADROOM)), 'hot', 'forecast counts');
});

test('signal starts empty so a first sample always fires', () => {
  assert.equal(thermalSignal.seq, 0);
  assert.equal(thermalSignal.level, 'ok');
});

test('thermalWorsened steps on a move to a worse level only, never on a repeat or recovery', () => {
  assert.equal(thermalWorsened('ok', 'warm'), true);
  assert.equal(thermalWorsened('warm', 'hot'), true);
  assert.equal(thermalWorsened('ok', 'hot'), true);
  assert.equal(thermalWorsened('warm', 'warm'), false);
  assert.equal(thermalWorsened('hot', 'warm'), false);
  assert.equal(thermalWorsened('ok', 'ok'), false);
});
