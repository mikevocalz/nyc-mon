import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LED_BREATH_MAX, LED_BREATH_MIN, LED_BREATH_PERIOD_MS, breathIntensity, breathPhaseAt, canPulse, inhaleStarted, padGlowAt,
} from './breath-clock.ts';
import { resolveForcedLayout } from './layout.ts';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('the breath period comes from motion-led-breath', () => {
  assert.equal(LED_BREATH_PERIOD_MS, 4000);
});

test('phase is the wall clock modulo the period, so readers agree', () => {
  assert.equal(breathPhaseAt(0), 0);
  assert.equal(breathPhaseAt(1000), 0.25);
  assert.equal(breathPhaseAt(4000 * 1234 + 2000), 0.5);
  assert.equal(breathPhaseAt(-1000), 0.75);
  assert.equal(breathPhaseAt(5, 0), 0);
});

test('intensity matches the LED keyframes: bright, dim at half, bright', () => {
  close(breathIntensity(0), LED_BREATH_MAX);
  close(breathIntensity(0.5), LED_BREATH_MIN);
  close(breathIntensity(1), LED_BREATH_MAX);
});

test('pad glow runs 0.25 to 1 on the breath, steady 1 when reduced', () => {
  close(padGlowAt(0, false), 1);
  close(padGlowAt(0.5, false), 0.25);
  assert.equal(padGlowAt(0.5, true), 1);
});

test('one inhale per period, and the haptic gate holds 4000 ms', () => {
  assert.equal(inhaleStarted(0.49, 0.51), true);
  assert.equal(inhaleStarted(0.51, 0.6), false);
  assert.equal(inhaleStarted(0.1, 0.4), false);
  // A late sample that wraps across the period still catches the inhale.
  assert.equal(inhaleStarted(0.4, 0.05), true);
  assert.equal(inhaleStarted(0.9, 0.05), false);
  let inhales = 0;
  let prev = breathPhaseAt(0);
  for (let t = 16; t <= 4000 * 3; t += 16) {
    const p = breathPhaseAt(t);
    if (inhaleStarted(prev, p)) inhales += 1;
    prev = p;
  }
  assert.equal(inhales, 3);
  assert.equal(canPulse(undefined, 0), true);
  assert.equal(canPulse(1000, 4999), false);
  assert.equal(canPulse(1000, 5000), true);
});

test('the shell goes compact while the keyboard is up unless a screen forces a layout', () => {
  assert.equal(resolveForcedLayout(undefined, false), undefined);
  assert.equal(resolveForcedLayout(undefined, true), 'compact');
  assert.equal(resolveForcedLayout('standard', true), 'standard');
});

test('both haptics forks expose the same verbs, including warm and the hatch score', async () => {
  const native = (await import('../haptics.native.ts')).haptics;
  const web = (await import('../haptics.web.ts')).haptics;
  const verbs = ['tap', 'success', 'warning', 'selection', 'warm', 'hatchLatch', 'hatchCrack', 'hatchBloom', 'hatchEmerge', 'firstLook'];
  assert.deepEqual(Object.keys(native).sort(), [...verbs].sort());
  assert.deepEqual(Object.keys(web).sort(), Object.keys(native).sort());
});
