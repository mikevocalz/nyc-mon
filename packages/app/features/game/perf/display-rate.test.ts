// PR4.2 display-rate vote: mode picking is pure — tests assert the
// smallest-rate-that-reaches-the-target rule and the top-rate fallback.
// The vote itself is a window attribute the module sets on-device.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSkyRigFlag } from '../world/sky-rig.ts';
import { EXPERIMENTAL_WORLD_FRAME_RATE, pickDisplayMode } from './display-rate.ts';
import type { GamePerfDisplayMode } from '@acme/ui/game-perf';

const mode = (id: number, refreshRate: number, current = false): GamePerfDisplayMode => ({
  id,
  width: 2700,
  height: 1800,
  refreshRate,
  current,
});

test('flag is opt-in and shares the rig-flag truth table', () => {
  for (const on of ['1', 'true', 'on', 'yes', ' TRUE ']) {
    assert.equal(parseSkyRigFlag(on), true, on);
  }
  for (const off of [undefined, null, '', '0', 'false', 'off']) {
    assert.equal(parseSkyRigFlag(off), false, String(off));
  }
  assert.equal(EXPERIMENTAL_WORLD_FRAME_RATE, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_FRAME_RATE));
});

test('picks the smallest supported rate that reaches the target', () => {
  const modes = [mode(1, 120), mode(2, 60), mode(3, 90)];
  assert.equal(pickDisplayMode(modes, 60)?.id, 2);
  assert.equal(pickDisplayMode(modes, 90)?.id, 3);
  // Between steps rounds up: a 70Hz target takes the 90Hz mode.
  assert.equal(pickDisplayMode(modes, 70)?.id, 3);
});

test('falls back to the top rate when the target is unreachable', () => {
  const duo = [mode(1, 60.000004, true)]; // the gen-1 Duo's single mode
  assert.equal(pickDisplayMode(duo, 60)?.id, 1);
  assert.equal(pickDisplayMode(duo, 120)?.id, 1, 'single-mode device stays put');
  const modes = [mode(1, 60), mode(2, 90)];
  assert.equal(pickDisplayMode(modes, 120)?.id, 2);
});

test('empty mode list picks nothing', () => {
  assert.equal(pickDisplayMode([], 60), null);
});

test('pickDisplayMode keeps the current resolution and never switches size for a faster rate', () => {
  const modes = [
    { id: 1, width: 1080, height: 2400, refreshRate: 60, current: true },
    { id: 2, width: 1440, height: 3200, refreshRate: 120, current: false },
    { id: 3, width: 1080, height: 2400, refreshRate: 90, current: false },
  ];
  assert.equal(pickDisplayMode(modes, Number.POSITIVE_INFINITY)?.id, 3);
  assert.equal(pickDisplayMode(modes, 60)?.id, 1);
});
