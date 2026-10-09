import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BURST_PEAK_AT, CRACK_AT, FRAMING, LID_OPEN_DEG, burstOpacity, burstScale, crackStage, emergePose, firstLookPose,
  lidAngle, reactionPose, triptychKey,
} from './hatch-model.ts';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('cracks appear at 0.25, 0.55 and 0.85', () => {
  assert.deepEqual([...CRACK_AT], [0.25, 0.55, 0.85]);
  assert.equal(crackStage(0), 0);
  assert.equal(crackStage(0.249), 0);
  assert.equal(crackStage(0.25), 1);
  assert.equal(crackStage(0.6), 2);
  assert.equal(crackStage(1), 3);
});

test('burst peaks at 0.36 at the cap and never exceeds it', () => {
  for (const cap of [0.6, 0.4]) {
    close(burstOpacity(BURST_PEAK_AT, cap), cap);
    assert.equal(burstOpacity(0, cap), 0);
    close(burstOpacity(1, cap), 0);
    for (let i = 0; i <= 100; i += 1) assert.ok(burstOpacity(i / 100, cap) <= cap + 1e-9);
  }
  assert.ok(burstScale(1) > burstScale(0.5) && burstScale(0.5) > burstScale(0));
});

test('lid: shut, overshoots past open while opening, settles open', () => {
  assert.equal(lidAngle('closed', 0.7), 0);
  assert.equal(lidAngle('open', 0), LID_OPEN_DEG);
  assert.equal(lidAngle('opening', 0), 0);
  close(lidAngle('opening', 0.8), LID_OPEN_DEG + 12);
  close(lidAngle('opening', 1), LID_OPEN_DEG);
});

test('creature framing: home is identity; hatch close-up is bigger', () => {
  assert.deepEqual(FRAMING.home, { scale: 1, translateY: 0 });
  assert.ok(FRAMING['hatch-closeup'].scale > 1);
  assert.equal(emergePose(0).opacity, 0);
  assert.equal(emergePose(1).opacity, 1);
  assert.equal(emergePose(1).translateY, 0);
});

test('first look: a hesitation never turns away and resolves to the lean-in', () => {
  const h = firstLookPose('hesitate', false);
  assert.ok(Math.abs(h.rotateDeg) < 10);
  assert.ok(h.scale > 0.9);
  assert.deepEqual(firstLookPose('hesitate', true), firstLookPose('lean-in', false));
});

test('still reactions start and end at rest, so restarts never stack', () => {
  for (const r of ['tilt', 'lift'] as const) {
    close(reactionPose(r, 0).rotateDeg, 0);
    close(reactionPose(r, 1).rotateDeg, 0);
    close(reactionPose(r, 1).translateYPt, 0);
  }
  assert.ok(reactionPose('tilt', 0.5).rotateDeg > 0);
  assert.ok(reactionPose('lift', 0.5).translateYPt < 0);
});

test('triptych keys: no default, arrows wrap, Escape clears, other keys pass', () => {
  assert.equal(triptychKey('ArrowRight', null, 3), 0);
  assert.equal(triptychKey('ArrowLeft', null, 3), 2);
  assert.equal(triptychKey('ArrowRight', 2, 3), 0);
  assert.equal(triptychKey('Home', 1, 3), 0);
  assert.equal(triptychKey('End', 0, 3), 2);
  assert.equal(triptychKey('Escape', 1, 3), null);
  assert.equal(triptychKey('Escape', null, 3), undefined);
  assert.equal(triptychKey('Enter', 1, 3), undefined);
});

test('case and triptych motion read the theme tokens', async () => {
  const { bezierPoints, easingPoints, tokenMs } = await import('./motion-curves.ts');
  assert.deepEqual(bezierPoints('cubic-bezier(0.3, 0, 0, 1)'), [0.3, 0, 0, 1]);
  assert.deepEqual(bezierPoints('nonsense'), [0.2, 0, 0, 1]);
  assert.deepEqual(easingPoints('emphasized'), [0.3, 0, 0, 1]);
  assert.equal(tokenMs('motion-enter', false), 300);
  assert.equal(tokenMs('motion-enter', true), 200);
  assert.equal(tokenMs('motion-scheme', true), 0);
});
