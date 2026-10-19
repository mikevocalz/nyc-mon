import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STOP_HOLD_MS } from './contract.ts';
import { STOP_HOLD_MS as HARDWARE_STOP_HOLD_MS } from './hardware/hold-to-stop.ts';
import { STOP_HOLD_MS as PARTS_STOP_HOLD_MS } from './parts.ts';
import { holdDurationSpoken, pillHint, quantizeHoldProgress, stopHoldHint } from './start-stop-pill-copy.ts';

describe('M9: one stop-hold number', () => {
  it('touch, hardware and the parts barrel read the same constant, 1000 ms', () => {
    assert.equal(STOP_HOLD_MS, 1000);
    assert.equal(HARDWARE_STOP_HOLD_MS, STOP_HOLD_MS);
    assert.equal(PARTS_STOP_HOLD_MS, STOP_HOLD_MS);
  });

  it('the spoken hint is derived from the hold, so it cannot drift from the gesture', () => {
    assert.equal(stopHoldHint(), 'Hold for one second to stop. Your last save is kept');
    assert.equal(pillHint('stopConfirm'), stopHoldHint(STOP_HOLD_MS));
    assert.equal(holdDurationSpoken(600), '0.6 seconds');
    assert.equal(holdDurationSpoken(2000), 'two seconds');
    assert.match(pillHint('stopConfirm', 1500), /1\.5 seconds/);
  });
});

describe('C2: hold-ring quantization written to pill/holdProgress', () => {
  it('reduced motion writes quarter steps only', () => {
    const seen = new Set<number>();
    for (let i = 0; i <= 100; i += 1) seen.add(quantizeHoldProgress(i / 100, true));
    assert.deepEqual([...seen].sort((a, b) => a - b), [0, 0.25, 0.5, 0.75, 1]);
  });

  it('full motion writes twentieths; the ring is full only when the hold is', () => {
    assert.equal(quantizeHoldProgress(0.5, false), 0.5);
    assert.equal(quantizeHoldProgress(0.999, false), 0.95);
    assert.equal(quantizeHoldProgress(1, false), 1);
  });

  it('clamps and treats non-finite input as empty', () => {
    assert.equal(quantizeHoldProgress(-1, false), 0);
    assert.equal(quantizeHoldProgress(7, true), 1);
    assert.equal(quantizeHoldProgress(Number.NaN, true), 0);
  });
});
