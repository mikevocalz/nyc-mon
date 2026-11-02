// Adaptive tier policy — deterministic tests. Synthetic frame sequences are
// fed through a real FrameSampleWindow (no sampler mocks): 120 pushes close
// one report, the policy sees exactly the probe's own order statistics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FRAME_SAMPLE_CAP, type FrameTimingSample } from './frame-sampler.ts';
import {
  ADAPTIVE_TIER,
  ADAPTIVE_TIER_BUDGETS,
  adaptiveFrameBridge,
  createAdaptiveTierController,
  EXPERIMENTAL_WORLD_ADAPTIVE,
  type AdaptiveAction,
  type AdaptiveTierOptions,
} from './adaptive-tiers.ts';
import { CITY_FRAME_SINK_ENABLED, onCityFrame } from './on-city-frame.ts';
import { parseSkyRigFlag } from '../world/sky-rig.ts';

type Controller = ReturnType<typeof createAdaptiveTierController>;

/** Push one full closed window of samples; returns the actions the window produced. */
function windowOf(c: Controller, sample: FrameTimingSample | (() => FrameTimingSample)): readonly AdaptiveAction[] {
  const before = c.actions.length;
  const f = typeof sample === 'function' ? sample : () => sample;
  for (let i = 0; i < FRAME_SAMPLE_CAP; i++) c.push(f());
  return c.actions.slice(before);
}

const overCpu = (cpuMs = 20): FrameTimingSample => ({ cpuMs, intervalMs: 16, renderMs: cpuMs });
const underCpu = (): FrameTimingSample => ({ cpuMs: 4, intervalMs: 16, renderMs: 4 });

function make(over: Partial<AdaptiveTierOptions> = {}): { c: Controller; applied: AdaptiveAction[] } {
  const applied: AdaptiveAction[] = [];
  const c = createAdaptiveTierController({
    startPreset: 'high',
    scaleChannel: 'renderScale',
    apply: (a) => applied.push(a),
    log: () => {},
    ...over,
  });
  return { c, applied };
}

test('flag is opt-in, off by default, and the sink stays detached', () => {
  assert.equal(EXPERIMENTAL_WORLD_ADAPTIVE, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_ADAPTIVE));
  assert.equal(EXPERIMENTAL_WORLD_ADAPTIVE, false, 'test env must not set the flag');
  // No consumer is enabled in this process, so GameScreen attaches no onFrameTiming at all.
  assert.equal(CITY_FRAME_SINK_ENABLED, false);
  assert.equal(adaptiveFrameBridge.push, null);
});

test('flag-off seam: onCityFrame forwards nothing to the bridge', () => {
  let seen = 0;
  const prior = adaptiveFrameBridge.push;
  adaptiveFrameBridge.push = () => {
    seen++;
  };
  try {
    onCityFrame({ cpuMs: 9, intervalMs: 16, backend: 'webgpu' });
  } finally {
    adaptiveFrameBridge.push = prior;
  }
  assert.equal(seen, 0, 'EXPERIMENTAL_WORLD_ADAPTIVE off ⇒ the bridge is never called');
});

test('sustained cpu overage downgrades one tier after K windows, then holds for cooldown', () => {
  const { c, applied } = make();
  assert.deepEqual(windowOf(c, overCpu()), []); // window 1: overStreak 1 < K=2
  const fired = windowOf(c, overCpu()); // window 2: fires
  assert.equal(fired.length, 1);
  assert.equal(fired[0]!.kind, 'tier');
  assert.equal(fired[0]!.from, 'high');
  assert.equal(fired[0]!.to, 'ipad-a12x');
  assert.deepEqual(applied, [...fired], 'the emitted action ran through apply');
  assert.equal(c.preset, 'ipad-a12x');
  assert.equal(c.bound, 'encode');
  assert.match(fired[0]!.reason, /encode-bound/);
  // Cooldown: windows 3-4 count nothing even though still over.
  assert.deepEqual(windowOf(c, overCpu()), []);
  assert.deepEqual(windowOf(c, overCpu()), []);
  // Two fresh over windows: the next rung.
  assert.deepEqual(windowOf(c, overCpu()), []);
  const second = windowOf(c, overCpu());
  assert.equal(second.length, 1);
  assert.equal(second[0]!.kind, 'tier');
  assert.equal(second[0]!.to, 'phone');
  assert.equal(c.preset, 'phone');
});

test('at the preset floor the encode ladder continues to shadow interval, then scale', () => {
  const { c } = make({ startPreset: 'phone' });
  assert.deepEqual(windowOf(c, overCpu()), []);
  const s1 = windowOf(c, overCpu());
  assert.equal(s1[0]!.kind, 'shadowInterval');
  assert.equal(s1[0]!.from, 1);
  assert.equal(s1[0]!.to, 2);
  for (const want of [4, 8]) {
    windowOf(c, overCpu());
    windowOf(c, overCpu()); // cooldown drains
    windowOf(c, overCpu());
    const step = windowOf(c, overCpu());
    assert.equal(step[0]!.kind, 'shadowInterval');
    assert.equal(step[0]!.to, want);
  }
  // Interval capped at 8: the ladder's last encode remedy is the scale step.
  windowOf(c, overCpu());
  windowOf(c, overCpu());
  windowOf(c, overCpu());
  const scale = windowOf(c, overCpu());
  assert.equal(scale[0]!.kind, 'renderScale');
  assert.equal(scale[0]!.from, 1);
  assert.ok(Math.abs((scale[0]!.to as number) - ADAPTIVE_TIER.scaleDownFactor) < 1e-9);
});

test('sustained headroom restores one step, most recent first, then stops', () => {
  const { c } = make({ startPreset: 'phone' });
  windowOf(c, overCpu());
  const fired = windowOf(c, overCpu());
  assert.equal(fired[0]!.kind, 'shadowInterval');
  assert.equal(fired[0]!.to, 2);
  windowOf(c, underCpu());
  windowOf(c, underCpu()); // cooldown drains
  windowOf(c, underCpu());
  windowOf(c, underCpu());
  windowOf(c, underCpu()); // under streak 3 — one short of M=4
  const restored = windowOf(c, underCpu()); // M=4 headroom windows
  assert.equal(restored.length, 1);
  assert.equal(restored[0]!.kind, 'shadowInterval');
  assert.equal(restored[0]!.from, 2);
  assert.equal(restored[0]!.to, 1);
  assert.equal(c.shadowInterval, 1);
  // Nothing left on the stack: more headroom emits nothing.
  windowOf(c, underCpu());
  windowOf(c, underCpu());
  windowOf(c, underCpu());
  windowOf(c, underCpu());
  assert.deepEqual(windowOf(c, underCpu()), []);
  assert.equal(c.actions.length, 2, 'history keeps both the step down and the restore');
});

test('hysteresis: alternating over and flat windows never reach K', () => {
  const { c } = make();
  const flat = { cpuMs: 12, intervalMs: 16, renderMs: 12 }; // between high's 10 restore and 13 over
  for (let i = 0; i < 6; i++) {
    assert.deepEqual(windowOf(c, i % 2 === 0 ? overCpu() : flat), []);
  }
  assert.equal(c.actions.length, 0);
});

test('a populated gpu channel that dominates picks the scale step first (render-bound)', () => {
  const { c } = make({ scaleChannel: 'upscaleScale', startScale: 0.5, scaleFloor: 0.25 });
  const gpuBound: FrameTimingSample = { cpuMs: 8, intervalMs: 16, renderMs: 8, gpuMs: 20 };
  assert.deepEqual(windowOf(c, gpuBound), []);
  const fired = windowOf(c, gpuBound);
  assert.equal(c.bound, 'render');
  assert.equal(fired[0]!.kind, 'upscaleScale', 'gpu dominating ⇒ the input-scale step moves first');
  assert.equal(fired[0]!.from, 0.5);
  assert.ok(Math.abs((fired[0]!.to as number) - 0.5 * ADAPTIVE_TIER.scaleDownFactor) < 1e-9);
});

test('a sparse gpu channel cannot classify: cpu alone takes the encode order', () => {
  const { c } = make({ scaleChannel: 'renderScale' });
  // gpuMs on 5 of 120 samples — under minGpuSamples, the window classifies on cpu alone.
  let pushed = 0;
  const sparse = (): FrameTimingSample => ({ cpuMs: 20, intervalMs: 16, renderMs: 20, gpuMs: ++pushed % 24 === 0 ? 30 : null });
  assert.deepEqual(windowOf(c, sparse), []);
  const fired = windowOf(c, sparse);
  assert.equal(c.bound, 'encode');
  assert.equal(fired[0]!.kind, 'tier');
});

test('a mostly parked window is inconclusive and counts nothing', () => {
  const { c } = make();
  const parked: FrameTimingSample = { cpuMs: 30, intervalMs: 300, renderMs: 30 }; // every interval parked
  assert.deepEqual(windowOf(c, parked), []);
  assert.deepEqual(windowOf(c, parked), []);
  assert.equal(c.actions.length, 0, 'two over-budget windows of a parked canvas still emit nothing');
});

test('explicit picks suppress their remedy: tier off ⇒ shadow steps first; everything off ⇒ silence', () => {
  const { c: noTier } = make({ startPreset: 'high', tier: false });
  windowOf(noTier, overCpu());
  const fired = windowOf(noTier, overCpu());
  assert.equal(fired[0]!.kind, 'shadowInterval', 'a pinned preset keeps its row; the ladder skips tier');

  const { c: muted } = make({ tier: false, shadowInterval: false, scale: false });
  for (let i = 0; i < 6; i++) assert.deepEqual(windowOf(muted, overCpu()), []);
  assert.equal(muted.actions.length, 0);
});

test('the scale floor clamps, then the exhausted ladder emits nothing more', () => {
  const { c } = make({ startPreset: 'phone', tier: false, shadowInterval: false });
  const seen: number[] = [];
  // Enough windows for every scale step: each needs cooldown(2) + K(2) windows.
  for (let w = 0; w < 40; w++) {
    for (const a of windowOf(c, overCpu())) seen.push(a.to as number);
    if (seen.length > 6) break;
  }
  const last = seen[seen.length - 1]!;
  assert.equal(last, ADAPTIVE_TIER.scaleFloor, 'the last step clamps at the floor');
  // At the floor with every remedy exhausted, further overage emits nothing.
  windowOf(c, overCpu());
  windowOf(c, overCpu());
  windowOf(c, overCpu());
  const n = c.actions.length;
  windowOf(c, overCpu());
  assert.equal(c.actions.length, n, 'floor holds: no further actions');
});

test('lastSummary carries the closed report for the perf log', () => {
  const { c } = make();
  const beforeFirstWindow = c.lastSummary;
  assert.ok(beforeFirstWindow === null);
  windowOf(c, overCpu());
  const summary = c.lastSummary;
  assert.ok(summary);
  assert.equal(summary.samples, FRAME_SAMPLE_CAP);
  assert.equal(summary.cpuP50Ms, 20);
  assert.ok(ADAPTIVE_TIER_BUDGETS.high.cpuOverMs < 20);
});
