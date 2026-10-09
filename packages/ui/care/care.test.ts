import assert from 'node:assert/strict';
import test from 'node:test';
import {
  arcMidpoint, arcPath, careRingName, clamp01, countdownProgress, gapDegrees, minuteSteppedProgress, percentOf, pointAt,
  stepStop, stopArcs,
} from './ring-model.ts';
import { lifecycleSlots, lifecycleSlotSpoken } from './lifecycle-model.ts';
import {
  canShift, compareMonth, dayKind, daysInMonth, daysTogetherCount, monthGrid, shiftMonth,
} from './days-model.ts';
import { roundDots } from './round-dots-model.ts';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('countdown progress is elapsed over span, clamped, and stored nowhere', () => {
  assert.equal(countdownProgress(0, 0, 1000), 0);
  assert.equal(countdownProgress(500, 0, 1000), 0.5);
  assert.equal(countdownProgress(-5, 0, 1000), 0);
  assert.equal(countdownProgress(2000, 0, 1000), 1);
  // Degenerate span reads as done rather than dividing by zero.
  assert.equal(countdownProgress(0, 10, 10), 1);
  assert.equal(clamp01(Number.NaN), 0);
});

test('reduced motion steps the ring once per minute', () => {
  const start = 0;
  const end = 15 * 60_000;
  assert.equal(minuteSteppedProgress(59_999, start, end), 0);
  assert.equal(minuteSteppedProgress(60_000, start, end), 1 / 15);
  assert.equal(minuteSteppedProgress(119_000, start, end), 1 / 15);
  assert.equal(minuteSteppedProgress(end, start, end), 1);
});

test('stop arcs share the circle with equal gaps and the first gap at 12 o\'clock', () => {
  const r = 100;
  const arcs = stopArcs(3, 8, r);
  const gap = gapDegrees(8, r);
  assert.equal(arcs.length, 3);
  close(arcs.reduce((s, a) => s + a.sweepDeg, 0) + gap * 3, 360);
  close(arcs[0]!.startDeg, gap / 2);
  close(arcs[1]!.startDeg - (arcs[0]!.startDeg + arcs[0]!.sweepDeg), gap);
  // One stop is a full ring with no gap.
  assert.deepEqual(stopArcs(1, 8, r), [{ startDeg: 0, sweepDeg: 360 }]);
  assert.deepEqual(stopArcs(0, 8, r), []);
});

test('points run clockwise from 12 o\'clock', () => {
  const top = pointAt(50, 50, 10, 0);
  close(top.x, 50);
  close(top.y, 40);
  const right = pointAt(50, 50, 10, 90);
  close(right.x, 60);
  close(right.y, 50);
  const mid = arcMidpoint(50, 50, 10, { startDeg: 80, sweepDeg: 20 });
  close(mid.x, 60);
});

test('arc paths: empty, partial and a full ring drawn in two halves', () => {
  assert.equal(arcPath(0, 0, 10, 0, 0), '');
  assert.match(arcPath(0, 0, 10, 0, 90), /^M 0 -10 A 10 10 0 0 1 10 0$/);
  assert.match(arcPath(0, 0, 10, 0, 270), / 0 1 1 /);
  assert.equal(arcPath(0, 0, 10, 0, 360).split('A').length, 3);
});

test('trackpad steps: from none +1 is the first stop, -1 the last; ends hold', () => {
  assert.equal(stepStop(3, null, 1), 0);
  assert.equal(stepStop(3, null, -1), 2);
  assert.equal(stepStop(3, 0, -1), 0);
  assert.equal(stepStop(3, 1, 1), 2);
  assert.equal(stepStop(3, 2, 1), 2);
  assert.equal(stepStop(0, null, 1), null);
});

test('care ring speaks its caption and the low word; the percent rides on the value', () => {
  assert.equal(percentOf(0.224), 22);
  assert.equal(percentOf(1.4), 100);
  assert.equal(careRingName('Fullness', true, 'low'), 'Fullness, low');
  assert.equal(careRingName('Fullness', false, 'low'), 'Fullness');
});

test('lifecycle track: Egg done, Baby current, three unnamed later slots', () => {
  const slots = lifecycleSlots(['Metro Egg', 'Squeaklet'], 3);
  assert.deepEqual(slots, [
    { state: 'done', label: 'Metro Egg' },
    { state: 'current', label: 'Squeaklet' },
    { state: 'later' },
    { state: 'later' },
    { state: 'later' },
  ]);
  // A later slot never carries text.
  for (const s of slots.slice(2)) assert.equal('label' in s, false);
  assert.equal(lifecycleSlotSpoken(slots[0]!), 'Metro Egg');
  const words = { done: 'done', current: 'now', later: 'Later stage' };
  assert.equal(lifecycleSlotSpoken(slots[1]!, words), 'Squeaklet, now');
  assert.equal(lifecycleSlotSpoken(slots[2]!, words), 'Later stage');
  assert.deepEqual(lifecycleSlots([], -2), []);
});

test('days calendar: month grid pads to whole weeks', () => {
  // October 2026 starts on a Thursday.
  const weeks = monthGrid({ year: 2026, month: 10 });
  assert.equal(weeks[0]!.indexOf('2026-10-01'), 4);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks.flat().filter(Boolean).length, 31);
  assert.equal(monthGrid({ year: 2026, month: 10 }, 1)[0]!.indexOf('2026-10-01'), 3);
  assert.equal(daysInMonth({ year: 2028, month: 2 }), 29);
});

test('days calendar: a missed day is drawn like a future day', () => {
  const days = new Set(['2026-10-01', '2026-10-03']);
  assert.equal(dayKind('2026-10-01', days), 'together');
  // Oct 2 is in the past with no entry; Oct 20 is in the future. Same kind.
  assert.equal(dayKind('2026-10-02', days), dayKind('2026-10-20', days));
});

test('days together only rises as entries are added', () => {
  const days = new Set<string>();
  let last = 0;
  for (const d of ['2026-10-01', '2026-10-03', '2026-10-03', '2026-10-09']) {
    days.add(d);
    const n = daysTogetherCount(days, '2026-10-31');
    assert.ok(n >= last);
    last = n;
  }
  assert.equal(last, 3);
  // Future-dated entries do not count yet.
  assert.equal(daysTogetherCount(new Set(['2026-11-01']), '2026-10-31'), 0);
});

test('month navigation stays between the hatch month and today', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  const min = { year: 2026, month: 9 };
  assert.equal(canShift({ year: 2026, month: 9 }, -1, min, '2026-10-08'), false);
  assert.equal(canShift({ year: 2026, month: 10 }, -1, min, '2026-10-08'), true);
  assert.equal(canShift({ year: 2026, month: 10 }, 1, min, '2026-10-08'), false);
  assert.equal(canShift({ year: 2026, month: 9 }, 1, min, '2026-10-08'), true);
  assert.ok(compareMonth({ year: 2025, month: 12 }, { year: 2026, month: 1 }) < 0);
});

test('round dots: done, current and ahead, clamped to the round count', () => {
  assert.deepEqual(roundDots(6, 3), ['done', 'done', 'current', 'ahead', 'ahead', 'ahead']);
  assert.deepEqual(roundDots(3, 0), ['current', 'ahead', 'ahead']);
  assert.deepEqual(roundDots(3, 9), ['done', 'done', 'current']);
  assert.deepEqual(roundDots(0, 1), []);
});
