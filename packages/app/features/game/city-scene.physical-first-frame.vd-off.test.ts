// The physical city's first frame with the vd lane killed
// (EXPO_PUBLIC_WORLD_VD=0): the reference the default build
// (city-scene.physical-first-frame.test.ts, physical + vd) is held against.
// On the iPad Pro 12.9" 3rd gen this config held at about 2.50 GiB footprint
// and stayed alive (2026-10-28).
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
process.env.EXPO_PUBLIC_WORLD_VD = '0';
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_TIER;
delete process.env.EXPO_PUBLIC_WORLD_DROP;
// The release pass is opt-in (world/release-uploaded.ts); these budgets measure it on.
process.env.EXPO_PUBLIC_WORLD_RELEASE_UPLOADED = '1';

const { logFirstFrame, measureFirstFrame } = await import('./city-scene.physical-first-frame.test-support.ts');
const { MAX_VERTEX_BUFFERS } = await import('./render-runtime/recording-gpu.test-support.ts');

// Measured 2026-10-28 (node 26, three 0.186.1 + patch): 131 shader modules,
// 1.74 MB WGSL, 73 render pipelines, 32 materials, GPU textures 213.50 MB,
// GPU buffers 125.30 MB, CPU arrays 134.0 MB after the first frame and
// 39.7 MB once the opt-in release pass (world/release-uploaded.ts) has run.
const PHYSICAL_ONLY_BUDGET = {
  shaderModules: 150, wgslBytes: 2_100_000, renderPipelines: 90, materials: 45,
  textureBytes: 216_000_000, bufferBytes: 128_000_000, retainedAfterReleaseBytes: 50_000_000,
};

test('physical first frame, vd off: no typed array becomes a string, WGSL and pipelines in budget', async () => {
  const frame = await measureFirstFrame();
  logFirstFrame('physical', frame);
  assert.ok(frame.clustered, 'the full stack mounts ClusteredLighting');
  assert.deepEqual(frame.stringified, { calls: 0, elements: 0 }, 'a typed array was joined into a string during the frame');
  assert.ok(![...frame.names].some((n) => n.startsWith('city:trees-vd')), 'no vd trees with the lane killed');
  assert.ok(frame.shaderModules > 0 && frame.renderPipelines > 0, 'the frame built shaders and pipelines');
  assert.ok(frame.shaderModules <= PHYSICAL_ONLY_BUDGET.shaderModules, `${frame.shaderModules} shader modules`);
  assert.ok(frame.wgslBytes <= PHYSICAL_ONLY_BUDGET.wgslBytes, `${frame.wgslBytes} bytes of WGSL`);
  assert.ok(frame.renderPipelines <= PHYSICAL_ONLY_BUDGET.renderPipelines, `${frame.renderPipelines} render pipelines`);
  assert.equal(frame.distinctShaderModules, frame.shaderModules, 'every shader module is distinct WGSL');
  assert.ok(frame.materials <= PHYSICAL_ONLY_BUDGET.materials, `${frame.materials} materials in the scene`);
  assert.ok(frame.textureBytes <= PHYSICAL_ONLY_BUDGET.textureBytes, `${frame.textureBytes} GPU texture bytes`);
  assert.ok(frame.bufferBytes <= PHYSICAL_ONLY_BUDGET.bufferBytes, `${frame.bufferBytes} GPU buffer bytes`);
  assert.ok(frame.retainedAfterReleaseBytes <= PHYSICAL_ONLY_BUDGET.retainedAfterReleaseBytes, `${frame.retainedAfterReleaseBytes} CPU array bytes held after release`);
  // The frames after the first now re-render the scene (the harness advances the node frame as the app does),
  // so they write uniforms; a re-sent geometry or texture would be megabytes, and would read a trapped array.
  assert.ok(frame.secondFrameWriteBytes < 256_000, `${frame.secondFrameWriteBytes} bytes uploaded after the first frame: uniforms only`);
  assert.deepEqual(frame.releasedReads, {}, 'nothing read a released array');
  const over = frame.pipelines.filter((p) => p.buffers > MAX_VERTEX_BUFFERS);
  assert.deepEqual(over, [], `pipelines over the iPad's ${MAX_VERTEX_BUFFERS} vertex buffers`);
});
