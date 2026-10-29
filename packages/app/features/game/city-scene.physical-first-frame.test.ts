// The default build's first frame on the bundled Harlem tile: the physical
// stack with the vd lane (Valdrada's facades, ground, trees and weather) on,
// through a recording GPUDevice at the iPad Pro 12.9" drawing buffer
// (2732 x 2048). On the iPad the full stack once never reached this frame:
// every lit material's shader build coerced ClusteredLightsNode's
// light-index buffer to a string (patches/three@0.186.1.patch). These budgets
// pin that fix and hold physical + vd to the physical-only frame
// (city-scene.physical-first-frame.vd-off.test.ts): the iPad was killed at
// 2.56 GiB with an earlier physical + vd build and held at 2.50 GiB without vd.
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
delete process.env.EXPO_PUBLIC_WORLD_VD;
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_TIER;
delete process.env.EXPO_PUBLIC_WORLD_DROP;
// The release pass is opt-in (world/release-uploaded.ts); these budgets measure it on.
process.env.EXPO_PUBLIC_WORLD_RELEASE_UPLOADED = '1';

const { logFirstFrame, measureFirstFrame, measureFirstFrameInChild } = await import('./city-scene.physical-first-frame.test-support.ts');
const { MAX_VERTEX_BUFFERS } = await import('./render-runtime/recording-gpu.test-support.ts');

// Measured 2026-10-28 (node 26, three 0.186.1 + patch, the harness advancing
// the node frame as the app does), physical-only -> physical + vd:
// 131 -> 150 shader modules, 1.74 -> 1.80 MB WGSL, 73 -> 89 render pipelines,
// 32 -> 38 materials, GPU textures 213.50 -> 217.89 MB, GPU buffers 125.30 ->
// 128.55 MB, CPU arrays after the first frame 134.0 -> 146.7 MB, and 39.7 ->
// 47.2 MB once the opt-in release pass (world/release-uploaded.ts) has run.
// The release pass is off by default, so the iPad holds the 146.7 MB. Every
// pipeline binds at most 7 vertex buffers (the iPad allows 8); the vd far
// trees bound 9 before their card streams were interleaved (vd-trees-mesh.ts).
//
// New vehicles only (2026-10-28, later): every parked and moving vehicle is a
// Valdrada baked body at a distance level (vd-vehicles-only.test.ts): 34
// vehicle meshes (6 parked bodies x near/mid/far, 8 fleet bodies x near/mid)
// where there were 17. As InstancedMeshes that cost 150 -> 168 shader modules
// and 89 -> 115 render pipelines, and on the iPad START timed out ("world not
// ready: 20000 ms without progress") and the app was killed at about 60 s.
// three@0.186.1 puts `object.uuid` in an InstancedMesh's render cache key, so
// each one ran its own node build (about 22 ms of JS and its own WGSL, colour
// and shadow pass), drawn or not. The vehicles are now plain Meshes over an
// InstancedBufferGeometry with the pose in one instance attribute
// (world/vd-instanced.ts): all parked bodies share one build and pipeline, all
// fleet bodies another. Same harness, same Mac, before -> after the fix:
// 168 -> 114 shader modules, 115 -> 63 render pipelines, frame-0 wall
// 1.31 -> 0.62 s, CPU 1.91 -> 0.98 s, V8 allocation 0.80 -> 0.40 GB; the
// physical-only frame below measured 1.00 s, 1.53 s and 0.61 GB.
const BUDGET = {
  shaderModules: 150, wgslBytes: 2_100_000, renderPipelines: 90, materials: 45,
  /** GPU texture bytes: vd adds 4.4 MB of 256 px data layers to the physical frame's targets. */
  textureBytes: 222_000_000,
  bufferBytes: 133_000_000,
  /** CPU typed arrays after the second frame, once the uploaded ones are released. */
  retainedAfterReleaseBytes: 60_000_000,
};

/**
 * Frame-0 wall clock and V8 allocation may exceed the reference frame's by this factor at most. The reference is the
 * physical-only frame (EXPO_PUBLIC_WORLD_VD=0), measured in a child process on the same machine in the same run, so
 * the check does not depend on the machine's speed. The pre-change default build (17 vehicle InstancedMeshes) no
 * longer exists to measure; the physical-only frame builds fewer materials than it did (131 vs 150 modules), so it is
 * the stricter reference.
 */
const FRAME0_VS_REFERENCE = 1.15;

test('physical + vd first frame: vd mounted, no typed array becomes a string, WGSL and pipelines in budget', async () => {
  const frame = await measureFirstFrame();
  logFirstFrame('physical+vd', frame);
  assert.ok(frame.clustered, 'the full stack mounts ClusteredLighting');
  assert.ok([...frame.names].some((n) => n.startsWith('city:trees-vd')), 'the vd lane is on by default');
  assert.deepEqual(frame.stringified, { calls: 0, elements: 0 }, 'a typed array was joined into a string during the frame');
  assert.ok(frame.shaderModules > 0 && frame.renderPipelines > 0, 'the frame built shaders and pipelines');
  assert.ok(frame.shaderModules <= BUDGET.shaderModules, `${frame.shaderModules} shader modules`);
  assert.ok(frame.wgslBytes <= BUDGET.wgslBytes, `${frame.wgslBytes} bytes of WGSL`);
  assert.ok(frame.renderPipelines <= BUDGET.renderPipelines, `${frame.renderPipelines} render pipelines`);
  assert.equal(frame.distinctShaderModules, frame.shaderModules, 'every shader module is distinct WGSL');
  assert.ok(frame.materials <= BUDGET.materials, `${frame.materials} materials in the scene`);
  assert.ok(frame.textureBytes <= BUDGET.textureBytes, `${frame.textureBytes} GPU texture bytes`);
  assert.ok(frame.bufferBytes <= BUDGET.bufferBytes, `${frame.bufferBytes} GPU buffer bytes`);
  assert.ok(frame.retainedAfterReleaseBytes <= BUDGET.retainedAfterReleaseBytes, `${frame.retainedAfterReleaseBytes} CPU array bytes held after release`);
  // of what the GPU received, the release pass dropped most (an array never uploaded, a mesh not yet in view, stays)
  const uploaded = frame.retainedArrayBytes - frame.retainedNeverUploadedBytes;
  assert.ok(frame.retainedAfterReleaseBytes - frame.retainedNeverUploadedBytes < uploaded / 2, `the release pass dropped most uploaded arrays: ${JSON.stringify({ first: frame.retainedArrayBytes, after: frame.retainedAfterReleaseBytes, neverUploaded: frame.retainedNeverUploadedBytes })}`);
  // The frames after the first now re-render the scene (the harness advances the node frame as the app does),
  // so they write uniforms; a re-sent geometry or texture would be megabytes, and would read a trapped array.
  assert.ok(frame.secondFrameWriteBytes < 256_000, `${frame.secondFrameWriteBytes} bytes uploaded after the first frame: uniforms only`);
  assert.deepEqual(frame.releasedReads, {}, 'nothing read a released array');
  const over = frame.pipelines.filter((p) => p.buffers > MAX_VERTEX_BUFFERS);
  assert.deepEqual(over, [], `pipelines over the iPad's ${MAX_VERTEX_BUFFERS} vertex buffers`);

  const reference = measureFirstFrameInChild({ EXPO_PUBLIC_WORLD_VD: '0' });
  console.info('[first-frame] physical reference (child)', JSON.stringify(reference));
  assert.ok(reference.shaderModules > 0 && reference.frame0Ms > 0, 'the reference frame ran');
  // Wall-clock time on shared CI runners swings well past 15% between two runs of
  // the same build, so the time cap holds locally only; CI still enforces the
  // allocation cap below, which tracks the same regression without the noise.
  assert.ok(
    process.env.CI === 'true' || frame.frame0Ms <= reference.frame0Ms * FRAME0_VS_REFERENCE,
    `frame 0 took ${frame.frame0Ms.toFixed(0)} ms, the physical-only reference ${reference.frame0Ms.toFixed(0)} ms (cap x${FRAME0_VS_REFERENCE})`,
  );
  // Allocation comes from the V8 heap profiler, which some CI runners don't expose
  // (the child reports 0, the parent NaN); compare only when both measured.
  const measured = Number.isFinite(frame.frame0AllocatedBytes) && reference.frame0AllocatedBytes > 0;
  assert.ok(
    !measured || frame.frame0AllocatedBytes <= reference.frame0AllocatedBytes * FRAME0_VS_REFERENCE,
    `frame 0 allocated ${(frame.frame0AllocatedBytes / 1e6).toFixed(0)} MB, the reference ${(reference.frame0AllocatedBytes / 1e6).toFixed(0)} MB (cap x${FRAME0_VS_REFERENCE})`,
  );
});
