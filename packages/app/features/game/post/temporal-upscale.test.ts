// Phase 4 slice 2 host proof for r187's temporal/spatial upscaling nodes
// (docs/implementation/upscaling-eval.md). The recording GPUDevice
// (render-runtime/recording-gpu.test-support.ts) accepts every call and
// counts pipelines, buffers, textures and draws, so a whole pipeline frame —
// MRT scene pass, velocity output, TAAU/TRAA/FSR1 resolve quads — runs on the
// host. Nothing is shaded; the device only counts.
//
// What this file proves on the host:
//   * TAAU mounts inside a RenderPipeline on our pass node, renders frames
//     without throwing, claims the pipeline's viewOffsetOwner (the camera
//     jitter seam), and allocates its history/resolve/previous-depth targets;
//   * the velocity MRT output is the wiring cost — a second colour
//     attachment on the scene pass plus per-object previous-transform
//     tracking (mrt.has('velocity') flips every render object to a FULL
//     refresh per frame — NodeMaterialObserver.needsVelocity, asserted
//     structurally here, the JS/JSI cost belongs to the device run);
//   * MSAA: TAAU/TRAA docs require it off. antialias:true sets
//     renderer.samples = 4, but WebGPUBackend compatibility mode forces it
//     to 0 — the recording device is compat, so this test pins that the
//     pass target follows renderer.samples and that {samples:0} exists as
//     the opt-out a core-features device needs;
//   * stacking two temporal nodes in one pipeline leaves only the first as
//     viewOffsetOwner — the "do not stack conflicting temporal systems"
//     rule, pinned;
//   * FSR1 needs no velocity and no jitter owner — the non-temporal option.
import '../classic-flags.test-support.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { mountCityPostPipeline } from './pipeline.ts';
import { PHYSICAL_GRADE, parseWorldUpscale, physicalFeaturesFor, type PhysicalPostSettings } from '../world/physical-look.ts';

type GpuRecord = {
  shaders: string[];
  renderPipelines: number;
  computePipelines: number;
  bufferBytes: number;
  textureBytes: number;
  writes: number;
  draws: number;
  textures: { label: string; format: string; width: number; height: number; layers: number; mipLevelCount: number }[];
};

const loadTaau = () => import('three/examples/jsm/tsl/display/TAAUNode.js');
const loadTraa = () => import('three/examples/jsm/tsl/display/TRAANode.js');
const loadFsr1 = () => import('three/examples/jsm/tsl/display/FSR1Node.js');

async function makeRenderer() {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({
    canvas: recordingCanvas(320, 240) as HTMLCanvasElement,
    device: device as never,
    antialias: true,
  } as never);
  await renderer.init();
  return { renderer, record: record as unknown as GpuRecord };
}

const camera = () => {
  const c = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 1000);
  c.position.set(0, 5, 20);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
};

function smallScene() {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardNodeMaterial();
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(i * 2 - 2, 0, 0);
    scene.add(m);
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), material, 4);
  scene.add(im);
  return scene;
}

type ScenePassT = ReturnType<typeof THREE.TSL.pass>;
type PipelineInternals = {
  _contextData: { renderPipelineState: { viewOffsetOwner: unknown } };
};

test('TAAU mounts on the pass node: jitter owner claimed, history targets allocated, frames render', async () => {
  const { taau } = await loadTaau();
  const { renderer, record } = await makeRenderer();
  const scene = smallScene();
  const cam = camera();
  const T = THREE.TSL;

  const scenePass = T.pass(scene, cam, { samples: 0 } as never) as ScenePassT;
  scenePass.setResolutionScale(0.5);
  scenePass.setMRT(T.mrt({ output: T.output, velocity: T.velocity }) as never);

  const beauty = scenePass.getTextureNode('output');
  const taauNode = taau(
    beauty as never,
    scenePass.getTextureNode('depth') as never,
    scenePass.getTextureNode('velocity') as never,
    cam,
  );

  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputNode = taauNode.getTextureNode() as never;

  // First frame rebases the camera to the WebGPU NDC projection; the
  // jitter invariant is "same projection before and after each frame".
  pipeline.render();
  const settled = cam.projectionMatrix.clone();
  pipeline.render();
  pipeline.render();

  // The pipeline's single jitter owner is the TAAU node — the seam the
  // "do not stack temporal systems" rule is about.
  const state = (pipeline as unknown as PipelineInternals)._contextData.renderPipelineState;
  assert.equal(state.viewOffsetOwner, taauNode, 'TAAU should own the view offset');

  // Jitter applies inside the pipeline frame and clears after: between
  // frames the projection is identical and view.offset is disabled.
  assert.ok(cam.projectionMatrix.equals(settled), 'camera projection restored after pipeline frames');
  assert.ok(cam.view === null || cam.view.enabled === false, 'no live view offset between frames');

  // The scene pass renders at half resolution …
  assert.equal(scenePass.renderTarget.texture.width, 160, 'scene pass honours setResolutionScale(0.5)');
  // … while TAAU's history/resolve targets are output-sized.
  const taauTargets = record.textures.filter((t) => t.label.includes('TAAUNode'));
  const names = taauTargets.map((t) => t.label).sort();
  assert.ok(
    names.some((n) => n.includes('resolve')) && names.some((n) => n.includes('history')),
    `TAAU targets recorded: ${names.join(', ')}`,
  );
  assert.ok(
    taauTargets.some((t) => t.width === 320 && t.height === 240),
    'TAAU history/resolve at drawing-buffer size',
  );
  // The velocity MRT shows up as a second attachment on the scene pass —
  // and it is what turns every render object into a per-frame FULL refresh
  // (NodeMaterialObserver.needsVelocity, r176) — the hidden JS cost.
  assert.equal(scenePass.renderTarget.textures.length, 2, 'scene pass has output + velocity attachments');

  console.info('[upscale-eval]', JSON.stringify({
    draws: record.draws,
    renderPipelines: record.renderPipelines,
    textures: record.textures.map((t) => `${t.label}:${t.format}:${t.width}x${t.height}x${t.layers}@${t.mipLevelCount}m`),
    textureBytes: record.textureBytes,
  }));
});

test('MSAA follows renderer.samples; {samples:0} is the temporal opt-out', async () => {
  const { renderer } = await makeRenderer();
  const scene = smallScene();
  const cam = camera();
  const T = THREE.TSL;

  const defaulted = T.pass(scene, cam) as ScenePassT;
  const explicit0 = T.pass(scene, cam, { samples: 0 } as never) as ScenePassT;

  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputNode = defaulted.getTextureNode('output') as never;
  pipeline.render();

  const pipeline0 = new THREE.RenderPipeline(renderer);
  pipeline0.outputNode = explicit0.getTextureNode('output') as never;
  pipeline0.render();

  // The recording device is compatibility-mode (no core-features-and-limits
  // feature), which forces renderer.samples to 0 on it — on a core-features
  // device antialias:true leaves it at 4 and the scene pass MSAA-ifies.
  assert.equal(defaulted.renderTarget.samples, renderer.samples, 'scene pass inherits renderer.samples');
  assert.equal(explicit0.renderTarget.samples, 0, '{samples:0} opts the pass out for a temporal resolve');
});

test('two temporal nodes, one pipeline: only the first owns the view offset', async () => {
  const { taau } = await loadTaau();
  const { traa } = await loadTraa();
  const { renderer } = await makeRenderer();
  const scene = smallScene();
  const cam = camera();
  const T = THREE.TSL;

  const scenePass = T.pass(scene, cam, { samples: 0 } as never) as ScenePassT;
  scenePass.setMRT(T.mrt({ output: T.output, velocity: T.velocity }) as never);

  const beauty = scenePass.getTextureNode('output');
  const depth = scenePass.getTextureNode('depth');
  const vel = scenePass.getTextureNode('velocity');
  const traaNode = traa(beauty as never, depth as never, vel as never, cam);
  const taauNode = taau(beauty as never, depth as never, vel as never, cam);

  // Both in the output chain — TRAA first.
  const pipeline = new THREE.RenderPipeline(renderer);
  // TRAANode.getTextureNode exists at runtime but is missing from the
  // @types/three declaration (TAAUNode's is declared; TRAANode's is not).
  const traaOut = (traaNode as unknown as { getTextureNode(): { add(n: unknown): unknown } }).getTextureNode();
  pipeline.outputNode = traaOut.add(taauNode.getTextureNode()) as never;
  pipeline.render();

  const state = (pipeline as unknown as PipelineInternals)._contextData.renderPipelineState;
  assert.equal(state.viewOffsetOwner, traaNode, 'first temporal node claims the jitter seam');
  assert.notEqual(state.viewOffsetOwner, taauNode, 'the second never jitters — stacking is silently asymmetric');
});

test('FSR1 upscales without velocity, MRT or a jitter owner', async () => {
  const { fsr1 } = await loadFsr1();
  const { renderer, record } = await makeRenderer();
  const scene = smallScene();
  const cam = camera();
  const T = THREE.TSL;

  const scenePass = T.pass(scene, cam) as ScenePassT;
  scenePass.setResolutionScale(0.5);

  const fsrNode = fsr1(scenePass.getTextureNode('output') as never);
  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputNode = (fsrNode as unknown as { getTextureNode(): unknown }).getTextureNode() as never;
  pipeline.render();
  pipeline.render();

  const state = (pipeline as unknown as PipelineInternals)._contextData.renderPipelineState;
  assert.equal(state.viewOffsetOwner, null, 'FSR1 claims no temporal owner');
  assert.equal(scenePass.renderTarget.textures.length, 1, 'no velocity attachment needed');
  const fsrTargets = record.textures.filter((t) => t.label.includes('FSR1Node'));
  assert.ok(fsrTargets.length >= 2, `EASU + RCAS targets: ${fsrTargets.map((t) => t.label).join(', ')}`);

  console.info('[upscale-eval-fsr1]', JSON.stringify({
    draws: record.draws,
    renderPipelines: record.renderPipelines,
    fsrTargets: fsrTargets.map((t) => `${t.label}:${t.width}x${t.height}`),
  }));
});

// ---- Phase 4 slice 3: the EXPO_PUBLIC_WORLD_UPSCALE slot ------------------
//
// The same harness through the real mount — mountCityPostPipeline with
// request.physical.upscale (post/pipeline.ts mountPhysical): flag parsing,
// the stage truth table, TAAU's documented invariants on the pass itself,
// the temporal-exclusivity guard, and the flag-off byte-identical claim.

const minimalSettings = (): PhysicalPostSettings => ({
  look: PHYSICAL_GRADE.twilight,
  ssr: null,
  bloomResolutionScale: 0.5,
});

const barePhysical = (upscale: 'fsr1' | 'taau' | null = null) => ({
  mrt: false,
  ssr: false,
  bloom: false,
  grade: false,
  msaaDiscard: false,
  upscale,
  upscaleScale: 0.5,
  settings: minimalSettings(),
});

test('flag parsing: fsr1 and taau are the only picks, injected into the full stack only', () => {
  assert.equal(parseWorldUpscale('fsr1'), 'fsr1');
  assert.equal(parseWorldUpscale(' TAAU '), 'taau');
  assert.equal(parseWorldUpscale(undefined), null);
  assert.equal(parseWorldUpscale('1'), null, 'a truthy-flag value is not a pick — the selector names the stage');
  assert.equal(parseWorldUpscale('off'), null);
  // The features field: the full stack takes the pick, a probe keeps null
  // (one feature per probe), and the master flag off is today's path.
  assert.equal(physicalFeaturesFor(true, null, false, 'fsr1')?.upscale, 'fsr1');
  assert.equal(physicalFeaturesFor(true, 'ssr', false, 'taau')?.upscale, null, 'a probe isolates one feature');
  assert.equal(physicalFeaturesFor(false, null, true, 'taau'), null);
  process.env.EXPO_PUBLIC_WORLD_DROP = 'upscale';
  try {
    assert.equal(physicalFeaturesFor(true, null, true, 'taau')?.upscale, null, 'WORLD_DROP sheds the slot');
  } finally {
    delete process.env.EXPO_PUBLIC_WORLD_DROP;
  }
});

test('flag off: the mounted chain is byte-identical — no stage, scale 1, inherited samples', async () => {
  const { renderer } = await makeRenderer();
  const scene = smallScene();
  const cam = camera();
  const post = mountCityPostPipeline(THREE, { renderer, scene, camera: cam, physical: barePhysical() });
  assert.deepEqual(post.physical!.applied, {
    mrt: false, ssr: false, bloom: false, grade: false, msaaDiscard: false, upscale: null,
  });
  assert.equal(post.physical!.upscaleNode, null);
  assert.equal(post.scenePass.getResolutionScale(), 1, 'the pass keeps full input resolution');
  assert.equal(post.scenePass.renderTarget.samples, renderer.samples, 'the pass inherits renderer.samples');
  assert.equal(
    post.pipeline.outputNode,
    post.scenePass.getTextureNode('output'),
    'the output is the bare scene texture — zero stage diff from today',
  );
  post.dispose();
});

test('fsr1 through the mount: attaches only under the pick, keeps MSAA, claims no jitter owner', async () => {
  const { renderer, record } = await makeRenderer();
  const scene = smallScene();
  const cam = camera();
  const post = mountCityPostPipeline(THREE, { renderer, scene, camera: cam, physical: barePhysical('fsr1') });
  assert.equal(post.physical!.applied.upscale, 'fsr1');
  assert.ok(post.physical!.upscaleNode, 'the FSR1 stage is mounted');
  assert.equal(post.scenePass.getResolutionScale(), 0.5);
  assert.equal(post.scenePass.renderTarget.samples, renderer.samples, 'FSR1 composes with MSAA — no opt-out');
  renderer.render(scene, cam);
  renderer.render(scene, cam);
  const state = (post.pipeline as unknown as PipelineInternals)._contextData.renderPipelineState;
  assert.equal(state.viewOffsetOwner, null, 'FSR1 claims no temporal owner');
  assert.equal(post.scenePass.renderTarget.texture.width, 160, 'the scene pass rendered at half input res');
  assert.equal(post.scenePass.renderTarget.textures.length, 1, 'no velocity attachment');
  assert.ok(
    record.textures.some((t) => t.label.includes('FSR1Node')),
    `EASU/RCAS targets allocated: ${record.textures.map((t) => t.label).join(', ')}`,
  );
  post.dispose();
});

test('taau through the mount: velocity MRT, samples 0, jitter owner claimed', async () => {
  const { renderer } = await makeRenderer();
  const scene = smallScene();
  const cam = camera();
  const post = mountCityPostPipeline(THREE, { renderer, scene, camera: cam, physical: barePhysical('taau') });
  assert.equal(post.physical!.applied.upscale, 'taau');
  assert.ok(post.physical!.upscaleNode, 'the TAAU stage is mounted');
  // The documented requirements, through the real mount: the {samples:0}
  // opt-out landed at pass construction (setup() re-reads options.samples),
  // and the velocity attachment joined the scene pass's MRT even without
  // the SSR mrt request.
  assert.equal(post.scenePass.renderTarget.samples, 0, 'the MSAA opt-out is on the pass target');
  const mrt = (post.scenePass as unknown as { _mrt: { outputNodes: Record<string, unknown> } })._mrt;
  assert.deepEqual(Object.keys(mrt.outputNodes).sort(), ['output', 'velocity'], 'velocity joined without the SSR MRT');
  renderer.render(scene, cam);
  renderer.render(scene, cam);
  const state = (post.pipeline as unknown as PipelineInternals)._contextData.renderPipelineState;
  assert.equal(state.viewOffsetOwner, post.physical!.upscaleNode, 'TAAU owns the pipeline jitter seam');
  assert.equal(post.scenePass.renderTarget.textures.length, 2, 'output + velocity attachments');
  assert.equal(post.scenePass.renderTarget.texture.width, 160, 'input at half res, history at output res');
  post.dispose();
});

test('the temporal guard: a live camera view offset refuses taau with a clear error', async () => {
  const { renderer } = await makeRenderer();
  const scene = smallScene();
  const cam = camera();
  // Another temporal system got the jitter seam first.
  cam.view = { enabled: true, fullWidth: 320, fullHeight: 240, offsetX: 0, offsetY: 0, width: 320, height: 240 };
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(String(args[0]));
  };
  try {
    const post = mountCityPostPipeline(THREE, { renderer, scene, camera: cam, physical: barePhysical('taau') });
    assert.equal(post.physical!.applied.upscale, null, 'the stage is refused');
    assert.equal(post.physical!.upscaleNode, null);
    assert.equal(post.scenePass.getResolutionScale(), 1, 'the refused stage leaves the input scale alone');
    assert.ok(
      errors.some((e) => e.includes('WORLD_UPSCALE=taau')),
      `expected a refusal error, got: ${errors.join(' | ')}`,
    );
    post.dispose();
  } finally {
    console.error = originalError;
  }
});
