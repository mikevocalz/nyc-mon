import assert from 'node:assert/strict';
import test from 'node:test';
import { NUDGE, nudgeHop, nudgePulse, nudgeRock, nudgeSlide } from './nudge.ts';

test('the wobble is a short, visible, decaying rock that ends level', () => {
  let peak = 0;
  let crossings = 0;
  let prev = 0;
  for (let t = 0; t <= NUDGE.seconds; t += 0.005) {
    const r = nudgeRock(t);
    peak = Math.max(peak, Math.abs(r));
    if (prev !== 0 && Math.sign(r) !== Math.sign(prev) && r !== 0) crossings++;
    prev = r;
  }
  assert.ok(NUDGE.seconds >= 0.6 && NUDGE.seconds <= 0.8, '0.6 to 0.8 s');
  const deg = (peak * 180) / Math.PI;
  assert.ok(deg >= 18 && deg <= 25, `peak ${deg.toFixed(1)} degrees reads at arm's length`);
  assert.ok(crossings >= 4 && crossings <= 5, `${crossings} reversals: four or five rocks`);
  assert.ok(Math.abs(nudgeRock(0.07)) > Math.abs(nudgeRock(0.55)), 'it decays');
  const slide = Math.max(...Array.from({ length: 140 }, (_, i) => Math.abs(nudgeSlide(i * 0.005))));
  assert.ok(slide >= 0.035 && slide <= 0.06, `slide ${slide} of the egg's height`);
  assert.equal(nudgeRock(NUDGE.seconds), 0);
  assert.equal(nudgeRock(-1), 0);
  assert.equal(nudgeRock(Infinity), 0);
});

test('the hop is on the first beat only, and the pulse fades from the press', () => {
  assert.ok(nudgeHop(NUDGE.hopSeconds / 2) > 0);
  assert.ok(NUDGE.pulse >= 1, 'the pulse at least doubles the resting glow');
  assert.equal(nudgeHop(NUDGE.hopSeconds + 0.01), 0);
  assert.equal(nudgePulse(0), 1);
  assert.ok(nudgePulse(NUDGE.pulseSeconds / 2) > 0 && nudgePulse(NUDGE.pulseSeconds / 2) < 1);
  assert.equal(nudgePulse(NUDGE.pulseSeconds), 0);
  assert.equal(nudgePulse(Infinity), 0);
});
