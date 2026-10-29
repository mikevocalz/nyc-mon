// Holds the streamed city to a bounded, flat residency on a two-minute run
// along 125th Street and back (cell-stream.walk.test-support.ts), at the iPad
// Pro 12.9" drawing buffer with the default physical + vd stack, against the
// same walk with streaming off (EXPO_PUBLIC_WORLD_STREAM=0), each in its own
// child process. The walk stands at its start at 60 and 120 s and at the far
// end at 30 and 90 s, so residency that grows with time, rather than with
// where the camera is, shows as a difference between the two visits.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { measureWalkInChild } = await import('./cell-stream.walk.test-support.ts');
const { WORLD_PRESETS } = await import('../../perf/tier-presets.ts');
const { NEAR_BUDGET } = await import('../vd-port/blocks/index.ts');

const BASE = {
  EXPO_PUBLIC_WORLD_PHYSICAL: '1',
  EXPO_PUBLIC_WORLD_VD: undefined,
  EXPO_PUBLIC_WORLD_PROBE: undefined,
  EXPO_PUBLIC_WORLD_TIER: undefined,
  EXPO_PUBLIC_WORLD_RELEASE_UPLOADED: undefined,
  EXPO_PUBLIC_WORLD_PRESET: 'ipad-a12x',
};

test('125th walk: streamed residency is flat by place, under the preset budget, and costs no pipeline', () => {
  const on = measureWalkInChild({ ...BASE, EXPO_PUBLIC_WORLD_STREAM: '1' });
  const off = measureWalkInChild({ ...BASE, EXPO_PUBLIC_WORLD_STREAM: '0' });
  console.info('[walk] stream off', JSON.stringify(off));
  console.info('[walk] stream on', JSON.stringify(on));
  assert.ok(on.stream && !off.stream, 'the flag reached both runs');
  const at = (t: number) => {
    const s = on.samples.find((x) => x.t === t);
    assert.ok(s, `sample at ${t} s`);
    return s;
  };
  // Same place, a minute apart: the same cells, the same GPU buffers, the same render objects.
  for (const [a, b] of [[30, 90], [60, 120]] as const) {
    const x = at(a), y = at(b);
    assert.equal(y.cells, x.cells, `resident cells at ${a} and ${b} s`);
    assert.equal(y.cellBytes, x.cellBytes, `resident cell bytes at ${a} and ${b} s`);
    assert.equal(y.liveBufferBytes, x.liveBufferBytes, `live GPU buffer bytes at ${a} and ${b} s`);
    assert.equal(y.renderObjects, x.renderObjects, `render objects at ${a} and ${b} s`);
    assert.equal(y.geometries, x.geometries, `geometries at ${a} and ${b} s`);
    assert.ok(y.heapUsed <= x.heapUsed * 1.05, `heap ${x.heapUsed} at ${a} s -> ${y.heapUsed} at ${b} s`);
  }
  assert.ok(at(120).evictions > 0 && at(120).loads > at(1).loads, 'the walk streamed cells in and out');
  // Under the budget, and the budget never had to refuse a wanted cell. The preset's budget holds the near-detail layers;
  // a layer with its own budget (the vd port's blocks, vd-port/blocks NEAR_BUDGET) is held to that one instead.
  const budget = WORLD_PRESETS['ipad-a12x'].budget;
  for (const s of on.samples) {
    assert.equal(s.overBudget, 0, `refused loads at ${s.t} s`);
    const cells = s.cells - s.own.cells, bytes = s.cellBytes - s.own.bytes, tris = s.cellTriangles - s.own.triangles;
    assert.ok(bytes <= budget.geometryBytes && cells <= budget.cellDraws && tris <= budget.triangles, `budget at ${s.t} s: ${cells} cells, ${bytes} B, ${tris} triangles`);
    assert.ok(s.own.bytes <= NEAR_BUDGET.geometryBytes && s.own.cells <= NEAR_BUDGET.cellDraws && s.own.triangles <= NEAR_BUDGET.triangles, `the blocks' near budget at ${s.t} s: ${JSON.stringify(s.own)}`);
  }
  // Fewer GPU buffer bytes than the whole tile, everywhere on the walk.
  for (let i = 0; i < on.samples.length; i++) {
    assert.ok(on.samples[i]!.liveBufferBytes < off.samples[i]!.liveBufferBytes, `live GPU buffers at ${on.samples[i]!.t} s`);
  }
  // Cells draw through pipelines the START compile built (the layer templates): the walk builds no module or pipeline
  // the whole-tile walk does not. Both build four late, the vd mid-tier trees' colour and shadow pipelines: that pool
  // is hidden while the physical rig's environment lands (about frame 27) and re-keys every lit material, so it
  // builds on its first use.
  assert.ok(on.newShaderModulesAfterFrame0 <= off.newShaderModulesAfterFrame0, `${on.newShaderModulesAfterFrame0} modules after frame 0, whole tile ${off.newShaderModulesAfterFrame0}`);
  assert.ok(on.newPipelinesAfterFrame0 <= off.newPipelinesAfterFrame0, `${on.newPipelinesAfterFrame0} pipelines after frame 0, whole tile ${off.newPipelinesAfterFrame0}`);
});
