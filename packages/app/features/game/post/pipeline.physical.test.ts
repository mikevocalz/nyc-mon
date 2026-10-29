// Slop-grade city, output and post (N3): `request.physical` wires the Slop
// chain on the one existing mount, ACES and the output conversion run once
// in the pipeline's renderOutput, SSR follows the tier settings, each probe
// subset wires only its stage, and every variant compiles to a WGSL fragment
// that samples the scene texture (same GPU-less builder convention as
// pipeline.test.ts). The frame itself is device-pending.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { mountCityPostPipeline, type PhysicalPostRequest } from './pipeline.ts';
import { PHYSICAL_GRADE, type PhysicalPostSettings } from '../world/physical-look.ts';
import { TIER } from '../perf/tier.ts';

type Builder = {
  scene: unknown;
  camera: unknown;
  material: unknown;
  context: { material: unknown };
  fogNode: unknown;
  build(): void;
  fragmentShader?: string;
};
const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;

async function stubRenderer() {
  const canvas = {
    width: 300,
    height: 150,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getContext: () => null,
  } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  const backend = (renderer as unknown as { backend: { capabilities: unknown; utils: unknown } }).backend;
  backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  backend.utils = { getTextureSampleData: () => ({ samples: 1, primarySamples: 1, isMSAA: false }) };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  return renderer;
}

const highSettings: PhysicalPostSettings = {
  look: PHYSICAL_GRADE.twilight,
  ssr: TIER.high.physical.ssr,
  bloomResolutionScale: TIER.high.physical.bloomResolutionScale,
};
const phoneSettings: PhysicalPostSettings = {
  look: PHYSICAL_GRADE.twilight,
  ssr: TIER.phone.physical.ssr,
  bloomResolutionScale: TIER.phone.physical.bloomResolutionScale,
};
const all = (settings: PhysicalPostSettings): PhysicalPostRequest => ({
  mrt: true, ssr: true, bloom: true, grade: true, msaaDiscard: true, settings,
});
const only = (stage: Partial<PhysicalPostRequest>): PhysicalPostRequest => ({
  mrt: false, ssr: false, bloom: false, grade: false, msaaDiscard: false, settings: highSettings, ...stage,
});

test('the physical chain: ACES once, every stage wired on the high tier, legacy effects off', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  renderer.toneMapping = THREE.NoToneMapping;
  const post = mountCityPostPipeline(THREE, {
    renderer, scene, camera, options: { bloom: true, aa: true, grade: true }, physical: all(highSettings),
  });
  assert.ok(post.physical);
  assert.deepEqual(post.physical.applied, { mrt: true, ssr: true, bloom: true, grade: true, msaaDiscard: true });
  assert.deepEqual(post.applied, { bloom: false, ao: false, aa: false, grade: false }, 'legacy chain is not wired');
  assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(renderer.toneMappingExposure, 1);
  assert.equal(post.pipeline.outputColorTransform, true, 'the pipeline applies ACES and the output conversion once');
  assert.equal(post.scenePass.renderTarget.storeMultisampledColorBuffer, false);
  const mrt = (post.scenePass as unknown as { _mrt: { outputNodes: Record<string, unknown>; getBlendMode(n: string): { blending: number } } })._mrt;
  assert.deepEqual(Object.keys(mrt.outputNodes).sort(), ['metalRough', 'normal', 'output']);
  assert.equal(mrt.getBlendMode('normal').blending, THREE.MaterialBlending);
  assert.equal(mrt.getBlendMode('metalRough').blending, THREE.MaterialBlending);

  const ssrNode = post.physical.ssrNode!;
  assert.equal(ssrNode.resolutionScale, 0.5);
  assert.equal(ssrNode.quality.value, 0.25);
  assert.equal(ssrNode.binaryRefine, true);
  assert.equal(ssrNode.maxDistance.value, 42);
  assert.equal(ssrNode.thickness.value, 0.85);
  assert.equal(ssrNode.intensity.value, 0.5);
  assert.equal(ssrNode.blurQuality, 1);
  assert.equal(ssrNode.screenEdgeFadeBlack, true);

  const bloomNode = post.physical.bloomNode!;
  assert.equal(bloomNode.strength.value, PHYSICAL_GRADE.twilight.bloom);
  assert.equal(bloomNode.threshold.value, PHYSICAL_GRADE.twilight.threshold);
  assert.equal(bloomNode.smoothWidth.value, 0.3);
  post.physical.applyLook(PHYSICAL_GRADE.midday);
  assert.equal(bloomNode.strength.value, PHYSICAL_GRADE.midday.bloom);
  assert.equal(bloomNode.threshold.value, PHYSICAL_GRADE.midday.threshold);

  post.dispose();
  assert.equal(renderer.toneMapping, THREE.NoToneMapping, 'dispose restores tone mapping');
  assert.equal(Object.hasOwn(renderer, 'render'), false, 'dispose removes the render delegate');
  post.dispose();
});

test('the phone tier starts without SSR even when the stage is requested', async () => {
  const renderer = await stubRenderer();
  const post = mountCityPostPipeline(THREE, {
    renderer, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), physical: all(phoneSettings),
  });
  assert.equal(post.physical!.applied.ssr, false);
  assert.equal(post.physical!.ssrNode, null);
  assert.equal(post.physical!.applied.bloom, true);
  post.dispose();
});

test('renderer.render reaches exactly one RenderPipeline', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const post = mountCityPostPipeline(THREE, { renderer, scene, camera, physical: all(highSettings) });
  const proto = THREE.RenderPipeline.prototype as unknown as { render: () => void };
  const original = proto.render;
  let renders = 0;
  proto.render = function () { renders++; };
  try {
    renderer.render(scene, camera);
  } finally {
    proto.render = original;
  }
  assert.equal(renders, 1);
  post.dispose();
});

test('probe subsets wire only their stage', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const aces = mountCityPostPipeline(THREE, { renderer, scene, camera, physical: only({}) });
  assert.deepEqual(aces.physical!.applied, { mrt: false, ssr: false, bloom: false, grade: false, msaaDiscard: false });
  assert.equal(aces.pipeline.outputNode, aces.scenePass.getTextureNode('output'), 'aces: bare scene texture, ACES in renderOutput');
  assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  aces.dispose();

  const mrt = mountCityPostPipeline(THREE, { renderer, scene, camera, physical: only({ mrt: true }) });
  assert.deepEqual(mrt.physical!.applied, { mrt: true, ssr: false, bloom: false, grade: false, msaaDiscard: false });
  mrt.dispose();

  const ssrWithoutMrt = mountCityPostPipeline(THREE, { renderer, scene, camera, physical: only({ ssr: true }) });
  assert.equal(ssrWithoutMrt.physical!.applied.ssr, false, 'SSR needs the MRT');
  ssrWithoutMrt.dispose();

  const msaa = mountCityPostPipeline(THREE, { renderer, scene, camera, physical: only({ msaaDiscard: true }) });
  assert.equal(msaa.scenePass.renderTarget.storeMultisampledColorBuffer, false);
  msaa.dispose();
  const kept = mountCityPostPipeline(THREE, { renderer, scene, camera, physical: only({}) });
  assert.equal(kept.scenePass.renderTarget.storeMultisampledColorBuffer, true, 'three\'s default store mode without the msaa stage');
  kept.dispose();
});

test('every physical variant compiles to a WGSL fragment that samples a texture', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const compile = (physical: PhysicalPostRequest) => {
    const post = mountCityPostPipeline(THREE, { renderer, scene, camera, physical });
    const internals = post.pipeline as unknown as { _updateContext(): void; _quadMesh: { material: THREE.Material } };
    internals._updateContext();
    const material = internals._quadMesh.material;
    const b = new WGSLNodeBuilder(internals._quadMesh, renderer);
    b.scene = scene;
    b.camera = camera;
    b.material = material;
    b.context.material = material;
    b.fogNode = null;
    b.build();
    post.dispose();
    return b.fragmentShader ?? '';
  };
  const bare = compile(only({}));
  assert.match(bare, /texture_/);
  const fullHigh = compile(all(highSettings));
  assert.match(fullHigh, /texture_/);
  assert.ok(fullHigh.length > bare.length, `full ${fullHigh.length} vs bare ${bare.length}`);
  for (const stage of [{ mrt: true }, { mrt: true, ssr: true }, { bloom: true }, { grade: true }, { msaaDiscard: true }] as const) {
    const shader = compile(only(stage));
    assert.ok(shader.length > 400, `${JSON.stringify(stage)}: ${shader.length} chars`);
    assert.match(shader, /texture_/, JSON.stringify(stage));
  }
});
