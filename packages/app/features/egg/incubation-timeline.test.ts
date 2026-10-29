import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { incubationTimeline } from './incubation-timeline.ts';

const clock = (ms: number) => `t${ms}`;

describe('incubationTimeline', () => {
  it('M10 before a pick: the wait is current and asks for a time', () => {
    const steps = incubationTimeline({ eggName: 'Metro Egg', stage: 'choosing', duration: null, startedAt: null, readyAt: null, clock });
    assert.equal(steps.length, 4);
    assert.equal(steps[0]?.title, 'You chose the Metro Egg');
    assert.deepEqual(steps.map((s) => s.active), [false, true, false, false]);
    assert.equal(steps[1]?.description, 'Pick how long the egg incubates.');
    assert.equal(steps[2]?.date, undefined);
  });

  it('M10 with a pick: the projected ready time shows', () => {
    const steps = incubationTimeline({ eggName: 'Corner Egg', stage: 'choosing', duration: '30 minutes', startedAt: null, readyAt: 1800, clock });
    assert.equal(steps[1]?.description, 'For 30 minutes.');
    assert.equal(steps[2]?.date, 't1800');
  });

  it('M11 counting down, then ready', () => {
    const counting = incubationTimeline({ eggName: 'Prism Egg', stage: 'incubating', duration: '1 hour', startedAt: 10, readyAt: 3610, clock });
    assert.equal(counting[1]?.date, 'Started t10');
    assert.deepEqual(counting.map((s) => s.active), [false, true, false, false]);
    const ready = incubationTimeline({ eggName: 'Prism Egg', stage: 'ready', duration: '1 hour', startedAt: 10, readyAt: 3610, clock });
    assert.deepEqual(ready.map((s) => s.active), [false, false, true, false]);
  });

  it('exactly one step is current in every stage', () => {
    for (const stage of ['choosing', 'incubating', 'ready'] as const) {
      const steps = incubationTimeline({ eggName: 'E', stage, duration: null, startedAt: null, readyAt: null, clock });
      assert.equal(steps.filter((s) => s.active).length, 1, stage);
    }
  });
});
