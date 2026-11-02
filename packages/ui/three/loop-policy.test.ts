import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AMBIENT_FPS, loopPlan, sceneMotion, tickDue, type SceneMotion } from './loop-policy.ts';
import { createFrameStats, setFrameStatsReporter, type FrameStats } from './mon/frame-stats.ts';

describe('loopPlan', () => {
  it('stops when still or out of view, caps ambient at 30, runs active at the display rate', () => {
    assert.deepEqual(loopPlan('still'), { paused: true, maxFps: undefined });
    assert.deepEqual(loopPlan('active', false), { paused: true, maxFps: undefined });
    assert.deepEqual(loopPlan('ambient'), { paused: false, maxFps: AMBIENT_FPS });
    assert.deepEqual(loopPlan('active'), { paused: false, maxFps: undefined });
  });

  it('sceneMotion: active wins, then ambient, else still', () => {
    assert.equal(sceneMotion({ active: true, ambient: true }), 'active');
    assert.equal(sceneMotion({ active: false, ambient: true }), 'ambient');
    assert.equal(sceneMotion({ active: false, ambient: false }), 'still');
  });

  it('tickDue keeps a 60 Hz display at exactly 30 fps under the ambient cap', () => {
    let last = 0;
    let draws = 0;
    for (let i = 1; i <= 600; i++) {
      const now = (i * 1000) / 60;
      if (tickDue(now, last, AMBIENT_FPS)) {
        last = now;
        draws++;
      }
    }
    assert.equal(draws, 300);
  });
});

/**
 * Measurement harness: a 60 Hz display driving ThreeCanvas's run rule
 * (running = !paused && !reducedMotion && onScreen; tickDue for the cap)
 * through a scripted home-stage session, under the policy before this change
 * (paused only when `resting`, which the live beam never allowed and
 * compiling never reported; 30 fps always) and after (loopPlan). Draw counts
 * stand in for CPU and GPU work per frame. frame-stats.ts reads the frame
 * intervals while the loop runs. Simulated time, not a device.
 */
interface Segment {
  readonly name: string;
  readonly seconds: number;
  readonly motion: SceneMotion;
  /** What the old scene reported: it rested only with nothing moving AND no live beam. */
  readonly oldResting: boolean;
  readonly onScreen: boolean;
}

type Policy = (s: Segment) => { paused: boolean; maxFps: number | undefined };
const before: Policy = (s) => ({ paused: s.oldResting, maxFps: 30 });
const after: Policy = (s) => loopPlan(s.motion);

function run(segments: readonly Segment[], policy: Policy) {
  const HZ = 60;
  let clock = 0;
  const stats: FrameStats[] = [];
  setFrameStatsReporter((st) => stats.push(st));
  const fs = createFrameStats(() => clock);
  const perSegment: { name: string; draws: number; fps: number }[] = [];
  let lastDraw = -Infinity;
  let prevDraw: number | null = null;
  for (const s of segments) {
    const { paused, maxFps } = policy(s);
    const running = !paused && s.onScreen;
    let draws = 0;
    const ticks = Math.round(s.seconds * HZ);
    for (let i = 0; i < ticks; i++) {
      clock += 1000 / HZ;
      if (!running || !tickDue(clock, lastDraw, maxFps)) continue;
      lastDraw = clock;
      draws++;
      if (prevDraw !== null) fs.frame(clock - prevDraw, 0, 0, 'idle');
      prevDraw = clock;
    }
    // A paused loop restarts with a fresh interval (ThreeCanvas zeroes `last`).
    if (!running) prevDraw = null;
    perSegment.push({ name: s.name, draws, fps: +(draws / s.seconds).toFixed(1) });
  }
  setFrameStatsReporter(null);
  const total = perSegment.reduce((n, s) => n + s.draws, 0);
  return { total, perSegment, p50Ms: stats.at(-1)?.p50Ms ?? 0, p95Ms: stats.at(-1)?.p95Ms ?? 0 };
}

const HOME_SESSION: readonly Segment[] = [
  // Pipelines compiling and the Baby GLB still parsing: the old loop drew an empty scene.
  { name: 'compiling', seconds: 4, motion: 'still', oldResting: false, onScreen: true },
  { name: 'intro', seconds: 2.4, motion: 'active', oldResting: false, onScreen: true },
  { name: 'idle (Baby + beam)', seconds: 23.6, motion: 'ambient', oldResting: false, onScreen: true },
  { name: 'touch tilt', seconds: 2, motion: 'active', oldResting: false, onScreen: true },
  { name: 'idle (Baby + beam)', seconds: 28, motion: 'ambient', oldResting: false, onScreen: true },
  { name: 'backgrounded', seconds: 30, motion: 'ambient', oldResting: false, onScreen: false },
];

const BEAM_OFF_SESSION: readonly Segment[] = [
  { name: 'compiling', seconds: 4, motion: 'still', oldResting: false, onScreen: true },
  { name: 'intro', seconds: 2.4, motion: 'active', oldResting: false, onScreen: true },
  // No model on the glass and the beam off: nothing moves. The old scene had no beam switch.
  { name: 'idle, beam off, no model', seconds: 53.6, motion: 'still', oldResting: false, onScreen: true },
];

describe('idle CPU harness (simulated 60 Hz, not device numbers)', () => {
  it('home stage, beam on: no draws while compiling, 30 fps idle, display rate for input, none backgrounded', () => {
    const old = run(HOME_SESSION, before);
    const now = run(HOME_SESSION, after);
    console.log('[loop-policy] home stage, beam on', JSON.stringify({ before: old, after: now }));
    const seg = (r: typeof now, name: string) => r.perSegment.find((s) => s.name === name)!;
    assert.equal(seg(old, 'compiling').draws, 120);
    assert.equal(seg(now, 'compiling').draws, 0);
    assert.equal(seg(now, 'idle (Baby + beam)').fps, 30);
    assert.equal(seg(now, 'intro').fps, 60);
    assert.equal(seg(now, 'touch tilt').fps, 60);
    assert.equal(seg(now, 'backgrounded').draws, 0);
    assert.equal(seg(old, 'backgrounded').draws, 0);
  });

  it('beam off with no model: the loop stops after the intro', () => {
    const old = run(BEAM_OFF_SESSION, before);
    const now = run(BEAM_OFF_SESSION, after);
    console.log('[loop-policy] beam off, no model', JSON.stringify({ before: old, after: now }));
    assert.equal(now.perSegment.at(-1)!.draws, 0);
    assert.ok(now.total < old.total / 5, `after ${now.total} draws vs before ${old.total}`);
  });
});
