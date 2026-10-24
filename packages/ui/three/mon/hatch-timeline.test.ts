import assert from 'node:assert/strict';
import test from 'node:test';
import { HATCH_CLIP_SECONDS, hatchDuration, hatchFrame, REDUCED_SECONDS, type HatchPhase } from './hatch-timeline.ts';

const FPS = 60;
const frames = (reduced: boolean) =>
  Array.from({ length: Math.ceil(hatchDuration(reduced) * FPS) + 30 }, (_, i) => ({ t: i / FPS, ...hatchFrame(i / FPS, reduced) }));

test('full motion runs the rig phases in order and ends on the Baby alone', () => {
  const order: HatchPhase[] = [];
  for (const f of frames(false)) if (order.at(-1) !== f.phase) order.push(f.phase);
  assert.deepEqual(order, ['stir', 'pressure', 'crack', 'burst', 'emerge', 'done']);
  const end = hatchFrame(HATCH_CLIP_SECONDS, false);
  assert.equal(end.eggOpacity, 0);
  assert.equal(end.monOpacity, 1);
  assert.equal(end.monScale, 1);
  assert.equal(end.camera, 1);
  assert.equal(end.glow, 0);
});

test('the Baby is hidden until the shell bursts, and the egg stays whole through the crack', () => {
  for (const f of frames(false).filter((f) => f.t < 4.2)) {
    assert.equal(f.monOpacity, 0, `t=${f.t}`);
    assert.equal(f.eggOpacity, 1, `t=${f.t}`);
    assert.equal(f.clipTime, f.t);
  }
});

test('reduced motion: no clip, no glow, a quick cross-fade', () => {
  assert.equal(hatchDuration(true), REDUCED_SECONDS);
  assert.ok(REDUCED_SECONDS <= 1);
  for (const f of frames(true)) {
    assert.equal(f.clipTime, null);
    assert.equal(f.glow, 0);
    assert.equal(f.monScale, 1);
  }
  assert.equal(hatchFrame(REDUCED_SECONDS, true).phase, 'done');
  assert.equal(hatchFrame(REDUCED_SECONDS, true).monOpacity, 1);
});

test('light changes direction at most twice in any one second (no more than one flash)', () => {
  for (const reduced of [false, true]) {
    const f = frames(reduced);
    const turns: number[] = [];
    for (let i = 2; i < f.length; i++) {
      const a = f[i - 1]!.glow - f[i - 2]!.glow;
      const b = f[i]!.glow - f[i - 1]!.glow;
      if (a * b < 0) turns.push(f[i]!.t);
    }
    for (const t of turns) assert.ok(turns.filter((u) => u >= t && u < t + 1).length <= 2, `reduced=${reduced} t=${t}`);
  }
});

test('opacities and scale stay in range and move one way', () => {
  const f = frames(false);
  for (let i = 1; i < f.length; i++) {
    assert.ok(f[i]!.eggOpacity <= f[i - 1]!.eggOpacity);
    assert.ok(f[i]!.monOpacity >= f[i - 1]!.monOpacity);
    assert.ok(f[i]!.monScale >= f[i - 1]!.monScale && f[i]!.monScale <= 1);
  }
});
