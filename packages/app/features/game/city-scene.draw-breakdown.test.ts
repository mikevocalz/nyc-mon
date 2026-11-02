// Phase 4 (PR 4), slice 5: the real-scene draw-call breakdown on the
// recording GPUDevice (docs/implementation/draw-call-eval.md). Pins the
// steady-state split — scene pass, sun shadow cascades, post chain — and the
// draw drop EXPO_PUBLIC_WORLD_SHADOW_INTERVAL=2 measures in a child process
// (the flag is read at import, so a second config needs its own).
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
delete process.env.EXPO_PUBLIC_WORLD_VD;
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_TIER;
delete process.env.EXPO_PUBLIC_WORLD_DROP;

const { measureDrawBreakdown, measureDrawBreakdownInChild } = await import('./city-scene.draw-breakdown.test-support.ts');

test('draw-call breakdown: physical + vd steady-state frame by category', async () => {
  const b = await measureDrawBreakdown();
  const { calls: _calls, ...rest } = b;
  console.info('[draw-breakdown]', JSON.stringify(rest, null, 1));
  // Measured 2026-11 (node 24, three 0.187.0 + patch, iPad buffer, camera
  // distance 200): 177 draws = 105 sun-shadow cascade draws (two cascades,
  // passDraws 41 + 64) + 59 scene + 12 post quads + 1 output.
  assert.equal(b.draws, 177, 'total draws changed — re-measure the table in draw-call-eval.md');
  assert.equal(b.shadowDraws, 105, 'shadow cascade draws changed');
  assert.equal(b.sceneDraws, 59, 'scene-pass draws changed');
  assert.equal(b.draws - b.shadowDraws - b.sceneDraws, 13, 'post chain draws changed');
  // Frustum culling holds: 51 vd block meshes in the scene, 8 draw in the
  // scene pass (the rest cull); they still cast 38 draws across the cascades.
  const blocks = b.categories.find((c) => c.key.startsWith('vd blocks'));
  assert.equal(blocks?.sceneDraws, 8);
  assert.equal(blocks?.shadowDraws, 38);
  assert.deepEqual(b.late?.drift ?? {}, {}, 'draws grew without new objects — find the source before trusting the table');
});

test('EXPO_PUBLIC_WORLD_SHADOW_INTERVAL=2: the cascades re-render every other frame', async () => {
  const base = await measureDrawBreakdown();
  const throttled = measureDrawBreakdownInChild({ EXPO_PUBLIC_WORLD_SHADOW_INTERVAL: '2' });
  console.info('[shadow-interval]', JSON.stringify({ base: base.draws, throttled: throttled.frameDraws }));
  // The full stack minus the cascades draws 72: throttled frames alternate
  // refresh (177) and skip (72). The average drops 105 -> ~52.5.
  const refreshes = throttled.frameDraws.filter((d) => d === base.draws).length;
  const skips = throttled.frameDraws.filter((d) => d === base.draws - base.shadowDraws).length;
  assert.ok(refreshes >= 3 && skips >= 3, `expected refresh/skip alternation in ${JSON.stringify(throttled.frameDraws)}`);
  assert.equal(refreshes + skips, throttled.frameDraws.length, `a frame drew neither ${base.draws} nor ${base.draws - base.shadowDraws}`);
});
