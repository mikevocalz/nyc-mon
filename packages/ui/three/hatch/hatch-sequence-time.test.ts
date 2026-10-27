import assert from 'node:assert/strict';
import test from 'node:test';
import { BEATS, CRACKS, HATCH_SECONDS, REDUCED_SECONDS, hatchFrame } from '../mon/hatch-timeline.ts';
import { sequenceSpan, sequenceTime, type SequencePhase } from './hatch-sequence-time.ts';

const ORDER: readonly SequencePhase[] = ['stir', 'pressure', 'crack', 'burst', 'emerge', 'attention'];

test('the phases tile the whole timeline in order, with no gap or overlap', () => {
  for (const reduced of [false, true]) {
    let at = 0;
    for (const phase of ORDER) {
      const [from, to] = sequenceSpan(phase, reduced);
      assert.ok(to >= from, `${phase} runs forward`);
      // The pause after the tension is the white-out's start: burst begins exactly there.
      assert.equal(from, at, `${phase} starts where the last ended (reduced ${reduced})`);
      at = to;
    }
    assert.equal(at, reduced ? REDUCED_SECONDS : HATCH_SECONDS);
  }
});

test('each crack lands in its own phase, and the white-out belongs to burst', () => {
  const within = (t: number, phase: SequencePhase) => {
    const [from, to] = sequenceSpan(phase, false);
    return t >= from && t < to;
  };
  assert.ok(within(CRACKS[0]!, 'stir'));
  assert.ok(within(CRACKS[1]!, 'pressure'));
  assert.ok(within(CRACKS[2]!, 'crack'));
  assert.ok(within(BEATS.whiteout[0], 'burst'));
  assert.equal(hatchFrame(sequenceTime('burst', 10_000, 500, false), false).white > 0.9, true, 'burst ends under the white');
  assert.equal(hatchFrame(sequenceTime('attention', 0, 1500, false), false).phase, 'done');
});

test('time scales to the screen phase length and holds at the end', () => {
  const [from, to] = sequenceSpan('crack', false);
  assert.equal(sequenceTime('crack', 0, 2400, false), from);
  assert.equal(sequenceTime('crack', 1200, 2400, false), from + (to - from) / 2);
  assert.equal(sequenceTime('crack', 9_999, 2400, false), to);
  assert.equal(sequenceTime('crack', -5, 2400, false), from);
});

test('reduced motion: the egg holds until burst cross-fades, then the Baby holds', () => {
  assert.equal(sequenceTime('crack', 400, 450, true), 0);
  assert.equal(hatchFrame(sequenceTime('crack', 400, 450, true), true).eggOpacity, 1);
  assert.equal(sequenceTime('burst', 300, 300, true), REDUCED_SECONDS);
  assert.equal(hatchFrame(sequenceTime('emerge', 0, 400, true), true).monOpacity, 1);
});
