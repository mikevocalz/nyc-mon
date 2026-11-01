// Phase 4 slice 1 host proof for r187's MeshletDrawingPipeline
// (docs/implementation/meshlet-pipeline-eval.md). The recording GPUDevice
// (render-runtime/recording-gpu.test-support.ts) accepts every call and
// counts pipelines, buffers and draws, so a whole frame of the GPU-driven
// pipeline — meshopt meshlet builds, node builds, compute and indirect
// draws — runs on the host. Nothing is shaded; the device only counts.
//
// What this file proves on the host:
//   * the pipeline claims a supported Mesh/InstancedMesh and replaces its
//     per-object draws with compute pipelines plus one indirect draw batch
//     per (geometry, material, shadow) entry;
//   * a plain Mesh over an InstancedBufferGeometry (the vd-instanced and
//     pool-instancer shape) — claimed and silently drawn as a single
//     instance on the unpatched r187 gate — is now REJECTED by the
//     isInstancedBufferGeometry hunk in patches/three@0.187.0.patch and
//     falls back to the standard per-object path;
//   * our blocks cell geometry shape (no `normal` attribute; shells also
//     carry a finite drawRange) is rejected and stays on the standard path;
//   * reversedDepthBuffer (physicalRendererParams under the default
//     EXPO_PUBLIC_WORLD_PHYSICAL) disables the pipeline entirely;
//   * createMeshlets' cost on a cell-sized merged geometry, for the
//     stream-in hitch estimate.
//
// Post-render _isMeshlet() is always false — the gate holds only inside a
// projection (beginRenderList/finishRenderList own _depth). The observable
// that a geometry was claimed is _hasClusters(): prepareAsync and the
// per-frame _getClusters trickle fill it for supported objects only.
import '../classic-flags.test-support.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { VD_XFORM_ATTRIBUTE, vdInstancedGeometry, vdXformPositionNode, writeVdXform } from './vd-instanced.ts';

const loadPipeline = () => import('three/examples/jsm/pipelines/MeshletDrawingPipeline.js');
const loadUtils = () => import('three/examples/jsm/utils/MeshletGeometryUtils.js');

type Pipeline = {
  _hasClusters(geometry: unknown, group: unknown): boolean;
  _isSupportedMaterial(material: unknown): boolean;
  info: { clusters: number; triangles: number };
};

interface GpuRecord {
  shaders: string[];
  renderPipelines: number;
  computePipelines: number;
  bufferBytes: number;
  textureBytes: number;
  writes: number;
  draws: number;
}

async function makeRenderer(opts: { reversedDepth?: boolean; meshlets?: boolean } = {}) {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({
    canvas: recordingCanvas(320, 240),
    device,
    ...(opts.reversedDepth ? { reversedDepthBuffer: true } : {}),
  } as never);
  await renderer.init();
  let pipeline: Pipeline | null = null;
  if (opts.meshlets) {
    const { MeshletDrawingPipeline } = await loadPipeline();
    pipeline = new MeshletDrawingPipeline({ occlusionCulling: false }) as unknown as Pipeline;
    (renderer as unknown as { drawingPipeline: unknown }).drawingPipeline = pipeline;
  }
  return { renderer, record: record as unknown as GpuRecord, pipeline };
}

const camera = () => {
  const c = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 1000);
  c.position.set(0, 5, 20);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
};

/**
 * Four meshes sharing ONE geometry+material (one batch under the pipeline),
 * one InstancedMesh (its own batch), one transparent mesh (material fallback).
 */
function supportedScene() {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardNodeMaterial();
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(i * 3 - 4, 0, 0);
    scene.add(m);
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), material, 8);
  im.count = 8;
  scene.add(im);
  const translucent = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.5 }),
  );
  translucent.position.set(0, 3, 0);
  scene.add(translucent);
  return { scene, geometry, material, instanced: im, translucent };
}

test('supported meshes share one indirect draw batch; unsupported stay per-object', async () => {
  const base = await makeRenderer();
  const s1 = supportedScene();
  base.renderer.render(s1.scene, camera());
  base.renderer.render(s1.scene, camera());
  const standardDraws = base.record.draws;

  const next = await makeRenderer({ meshlets: true });
  const s2 = supportedScene();
  await next.renderer.compileAsync(s2.scene, camera());
  next.renderer.render(s2.scene, camera());
  next.renderer.render(s2.scene, camera());

  // Claimed = meshlets built for the geometry (prepareAsync only processes
  // objects that pass isSupportedObject + _isSupportedMaterial).
  assert.equal(next.pipeline!._hasClusters(s2.geometry, null), true, 'the shared box geometry was meshletized');
  assert.equal(next.pipeline!._hasClusters(s2.instanced.geometry, null), true, 'the InstancedMesh geometry was meshletized');
  assert.equal(next.pipeline!._hasClusters(s2.translucent.geometry, null), false, 'the transparent geometry was not touched');

  // Four identical meshes + an 8-instance mesh collapse to two batches: one
  // indirect draw each, plus the transparent fallback's regular draw.
  assert.ok(next.record.computePipelines > 0, `expected culling compute pipelines, got ${next.record.computePipelines}`);
  assert.ok(next.record.draws < standardDraws, `meshlet draws ${next.record.draws} should be fewer than standard ${standardDraws}`);
  console.info('[meshlet-eval]', JSON.stringify({
    standardDraws,
    meshletDraws: next.record.draws,
    computePipelines: next.record.computePipelines,
    renderPipelines: next.record.renderPipelines,
    standardRenderPipelines: base.record.renderPipelines,
  }));
});

test('the InstancedBufferGeometry reject hunk: the vd-instanced shape falls back to the standard path', async () => {
  const { renderer, pipeline } = await makeRenderer({ meshlets: true });
  const material = new THREE.MeshStandardNodeMaterial();
  material.positionNode = vdXformPositionNode(THREE as never);
  const made = vdInstancedGeometry(THREE as never, new THREE.BoxGeometry(1, 1, 1) as never, 8, [[VD_XFORM_ATTRIBUTE, 4]]);
  writeVdXform(made.buffer.array as Float32Array, 0, made.stride, 0, 10, 0, 0);
  writeVdXform(made.buffer.array as Float32Array, 1, made.stride, 0, -10, 0, 0);
  made.geometry.instanceCount = 2;
  const mesh = new THREE.Mesh(made.geometry, material);
  const scene = new THREE.Scene();
  scene.add(mesh);
  const cam = camera();
  let threw: string | null = null;
  try {
    // The first projection claims the first new geometry it meets; the frame
    // draws it through the batch as mesh.count = 1 instance.
    renderer.render(scene, cam);
    renderer.render(scene, cam);
  } catch (error) {
    threw = error instanceof Error ? error.message : String(error);
  }
  // r187 Mesh.count = 1: the unpatched gate claimed this shape and the
  // batch drew it as a single instance — every other slot silently dropped.
  // The isInstancedBufferGeometry hunk in patches/three@0.187.0.patch
  // rejects it at isSupportedObject, so the object takes the per-object
  // fallback (super.pushRenderItem) and draws through the standard path.
  assert.equal(pipeline!._hasClusters(made.geometry, null), false, 'the patched gate rejects the vd-instanced shape');
  assert.equal(threw, null, 'the standard-path fallback draws without throwing');
  assert.equal(made.geometry.instanceCount, 2, 'the geometry carries two live slots');
});

test('blocks cell geometry (position/color/emissive/uv, no normal) is not meshletized', async () => {
  const { renderer, pipeline } = await makeRenderer({ meshlets: true });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  g.setAttribute('emissive', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  g.boundingSphere = new THREE.Sphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicNodeMaterial());
  const scene = new THREE.Scene();
  scene.add(mesh);
  renderer.render(scene, camera());
  renderer.render(scene, camera());
  assert.equal(pipeline!._hasClusters(g, null), false, 'no normal attribute: the pipeline passes on VDN cells');

  // The shell shape adds a finite drawRange; that alone is a second rejection.
  const shell = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) shell.setAttribute(name, a as never);
  shell.setIndex(g.index);
  shell.setDrawRange(0, 3);
  shell.boundingSphere = new THREE.Sphere();
  shell.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3));
  const shellMesh = new THREE.Mesh(shell, new THREE.MeshBasicNodeMaterial());
  scene.add(shellMesh);
  renderer.render(scene, camera());
  renderer.render(scene, camera());
  assert.equal(pipeline!._hasClusters(shell, null), false, 'a finite drawRange rejects the shell shape too');
});

test('reversedDepthBuffer (the physical lane) disables the whole meshlet path', async () => {
  const base = await makeRenderer();
  const s1 = supportedScene();
  base.renderer.render(s1.scene, camera());
  base.renderer.render(s1.scene, camera());

  const { renderer, pipeline, record } = await makeRenderer({ meshlets: true, reversedDepth: true });
  const s2 = supportedScene();
  await renderer.compileAsync(s2.scene, camera());
  renderer.render(s2.scene, camera());
  renderer.render(s2.scene, camera());
  assert.equal((renderer as unknown as { reversedDepthBuffer: boolean }).reversedDepthBuffer, true);
  // Wasted work worth pinning: prepareAsync ignores _meshletsSupported and
  // builds the meshlets anyway; the render path then never uses them — same
  // draws as the standard pipeline and no culling compute.
  assert.equal(pipeline!._hasClusters(s2.geometry, null), true, 'prepareAsync built unused meshlets');
  assert.equal(record.computePipelines, 0, 'no culling compute ran');
  assert.equal(record.draws, base.record.draws, 'every object drew through the standard path');
});

test('createMeshlets cost on a cell-sized merged geometry (stream-in hitch estimate)', async () => {
  const { ready } = await loadUtils();
  await ready;
  const { createMeshlets } = await loadUtils();
  // ~150k triangles, the order of a busy near/lite VDN cell merged geometry.
  const tris = 150_000;
  const pos = new Float32Array(tris * 9);
  const nrm = new Float32Array(tris * 9);
  for (let i = 0; i < tris; i++) {
    const x = (i % 400) * 0.3, y = Math.floor(i / 400) % 60 * 3, z = Math.floor(i / 24000) * 0.3;
    pos.set([x, y, z, x + 0.29, y, z, x, y + 2.9, z], i * 9);
    nrm.set([0, 0, 1, 0, 0, 1, 0, 0, 1], i * 9);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const t0 = performance.now();
  const clusters = createMeshlets(g as never, null);
  const ms = performance.now() - t0;
  console.info('[meshlet-eval] createMeshlets', JSON.stringify({ tris, ms: Math.round(ms), chunks: clusters.chunkCount, lods: clusters.lodCount }));
  assert.ok(clusters.chunkCount > 0);
  assert.ok(ms < 30_000, 'absurdly slow');
});
