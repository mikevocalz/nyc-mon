// Phase 4 slice 4 host proof for the GPU timestamp channel
// (docs/implementation/profiling.md, @acme/ui/three/gpu-timestamps.ts).
// The recording GPUDevice (recording-gpu.test-support.ts) accepts every
// call; the timestamp result buffer hands back scripted u64 clock values,
// so the resolved gpuMs is MOCK data — proof the query path is plumbed,
// not a measurement of GPU time.
//
// What this file proves on the host:
//   * a device granted 'timestamp-query' arms the channel, writes
//     timestampWrites into its render passes, and a resolve reports the
//     scripted pair's delta as gpuMs (and renderer.info.render.timestamp);
//   * a device without the feature never arms — the channel and the
//     summary's gpu block stay null while every JS stat is identical;
//   * the flag const is default-off in a test environment.
import '../classic-flags.test-support.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { armGpuTimestamps, kickGpuTimestampResolve, WORLD_PERF_GPU_TIMESTAMPS, type GpuTimestampChannel } from '@acme/ui/three/gpu-timestamps';
import { FrameSampleWindow, FRAME_SAMPLE_CAP } from '../perf/frame-sampler.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from './recording-gpu.test-support.ts';

async function makeRenderer(options?: Parameters<typeof recordingGpuDevice>[0]) {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice(options);
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(320, 240), device } as never);
  await renderer.init();
  return { renderer, record };
}

const scene = () => {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicNodeMaterial()));
  const c = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 1000);
  c.position.set(0, 0, 5);
  c.updateMatrixWorld();
  return { scene: s, camera: c };
};

test('EXPO_PUBLIC_WORLD_PERF defaults off in a test environment', () => {
  assert.equal(WORLD_PERF_GPU_TIMESTAMPS, false);
});

test('a timestamp-query device arms and resolves the scripted gpuMs', async () => {
  // Slots are begin/end u64 nanosecond pairs per render context; the first
  // pair reads 1ms → 5ms = a 4 ms GPU frame. MOCK values — nothing was drawn.
  const { renderer } = await makeRenderer({
    features: ['timestamp-query'],
    timestampValues: [1_000_000, 5_000_000],
  });
  const channel = armGpuTimestamps(renderer);
  assert.ok(channel, 'the channel armed on a timestamp-query device');
  assert.equal(channel.gpuMs, null, 'nothing resolved before the first frame');

  const { scene: s, camera } = scene();
  renderer.render(s, camera);
  await kickGpuTimestampResolve(renderer, channel);

  assert.equal(channel.gpuMs, 4, 'the pool resolved the scripted pair as milliseconds');
  assert.equal(renderer.info.render.timestamp, 4, 'three stamps info.render.timestamp with the same resolve');
  assert.equal(channel.pending, false, 'the resolve settled');

  // A second frame resolves through the same scripted slots — the pool
  // resets queryOffsets per resolve, so every frame's first pair is
  // offsets 0,1 on this mock.
  renderer.render(s, camera);
  await kickGpuTimestampResolve(renderer, channel);
  assert.equal(channel.gpuMs, 4, 'each resolve re-reads the scripted pair — mock data, asserted honestly');
});

test('a second kick while a resolve is in flight does not stack promises', async () => {
  const { renderer } = await makeRenderer({ features: ['timestamp-query'], timestampValues: [2_000_000, 9_000_000] });
  const channel = armGpuTimestamps(renderer)!;
  const { scene: s, camera } = scene();
  renderer.render(s, camera);
  const first = kickGpuTimestampResolve(renderer, channel);
  assert.equal(channel.pending, true);
  const skipped = kickGpuTimestampResolve(renderer, channel);
  await Promise.all([first, skipped]);
  assert.equal(channel.gpuMs, 7);
});

test('a device without timestamp-query never arms; JS stats are untouched', async () => {
  const { renderer } = await makeRenderer();
  const channel: GpuTimestampChannel | null = armGpuTimestamps(renderer);
  assert.equal(channel, null, 'no timestamp-query feature, no channel');

  // The draw path then never touches gpuMs — the window's JS stats are
  // byte-identical to a run that never heard of the channel.
  const plain = new FrameSampleWindow();
  let plainReport = null;
  for (let i = 1; i <= FRAME_SAMPLE_CAP; i++) {
    plainReport = plain.push({ cpuMs: i, intervalMs: 16, renderMs: i, gpuMs: null });
  }
  assert.ok(plainReport);
  assert.equal(plainReport.gpu, null, 'armed-but-unresolved gpuMs never populates the block');
  assert.equal(plainReport.cpuP50Ms, 60);
  assert.equal(plainReport.stages?.renderP50Ms, 60);
});

test('the sampler keeps gpuMs in its own channel beside the JS stats', () => {
  const sampler = new FrameSampleWindow();
  let report = null;
  for (let i = 1; i <= FRAME_SAMPLE_CAP; i++) {
    // Sparse channel: only every third sample carries a resolved value —
    // the backlog resolve shape under GPU pressure.
    report = sampler.push({
      cpuMs: i, intervalMs: 16, renderMs: i,
      gpuMs: i % 3 === 0 ? 2 + i / 10 : null,
    });
  }
  assert.ok(report);
  assert.ok(report.gpu);
  assert.equal(report.gpu.samples, 40);
  assert.equal(report.gpu.p50Ms, 8); // values 2.3..14.3 step 0.3 → 20th of 40 = 8.0
  assert.equal(report.gpu.worstMs, 14);
  assert.equal(report.cpuP50Ms, 60, 'cpuMs stats do not move when gpuMs rides along');
  assert.equal(report.stages?.renderP50Ms, 60);
});
