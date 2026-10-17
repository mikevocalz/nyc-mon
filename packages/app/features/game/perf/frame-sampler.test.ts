import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FrameSampleWindow, FRAME_SAMPLE_CAP, ACTIVE_INTERVAL_MAX_MS, SIXTY_HZ_BUDGET_MS,
} from './frame-sampler.ts';

test('one bounded window yields exact order-statistic CPU distribution', () => {
  const sampler = new FrameSampleWindow();
  let report = null;
  for (let i = 1; i <= FRAME_SAMPLE_CAP; i++) {
    report = sampler.push({ cpuMs: i, intervalMs: 16 });
    if (i < FRAME_SAMPLE_CAP) assert.equal(report, null);
  }
  assert.ok(report);
  assert.equal(report.samples, 120);
  assert.equal(report.cpuP50Ms, 60);
  assert.equal(report.cpuP90Ms, 108);
  assert.equal(report.cpuWorstMs, 120);
  assert.equal(report.slowIntervals, 0);
  assert.equal(report.parkedIntervals, 0);
});
test('on-demand gaps are excluded from simulated frame cadence', () => {
  const sampler = new FrameSampleWindow();
  let r = null;
  for (let i = 0; i < FRAME_SAMPLE_CAP; i++) r = sampler.push({
    cpuMs: 5,
    intervalMs: i === 0 ? null : i % 3 === 0 ? 300 : 20,
  });
  assert.ok(r);
  assert.equal(r.parkedIntervals, 39);
  assert.equal(r.activeIntervals, 80);
  assert.equal(r.slowIntervals, 80);
  assert.equal(ACTIVE_INTERVAL_MAX_MS, 250);
  assert.ok(SIXTY_HZ_BUDGET_MS > 16 && SIXTY_HZ_BUDGET_MS < 17);
});
test('invalid frame readings are refused and do not consume samples', () => {
  const sampler = new FrameSampleWindow();
  for (const cpuMs of [-1, NaN, Infinity, 60001]) assert.equal(sampler.push({ cpuMs, intervalMs: 16 }), null);
  let r = null;
  for (let i = 0; i < FRAME_SAMPLE_CAP; i++) r = sampler.push({ cpuMs: 8, intervalMs: 16 });
  assert.equal(r?.samples, FRAME_SAMPLE_CAP);
  assert.equal(r?.cpuP90Ms, 8);
});
test('window starts fresh after a completed report', () => {
  const s = new FrameSampleWindow();
  for (let i = 0; i < FRAME_SAMPLE_CAP; i++) s.push({ cpuMs: 19, intervalMs: 17 });
  let out = null;
  for (let i = 0; i < FRAME_SAMPLE_CAP; i++) out = s.push({ cpuMs: 1, intervalMs: 16 });
  assert.equal(out?.cpuP50Ms, 1);
  assert.equal(out?.slowIntervals, 0);
});
