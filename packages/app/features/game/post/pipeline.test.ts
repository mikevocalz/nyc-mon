// Lane L5 "finishing pass": the master flag and every per-effect flag are
// opt-in, the tone-mapping selector accepts only its documented values, AO
// is tier-gated, the mounted pipeline delegates renderer.render without
// recursing into itself, dispose restores the renderer, and — the
// black-frame regression guard — the pipeline's real output material
// compiles to a texture-sampling WGSL fragment, for the bare chain and the
// fully-flagged one, through three's own WGSLNodeBuilder (same stub-renderer
// convention as sky-rig.test.ts / glass.test.ts). An actual frame on
// rn-webgpu stays device-pending: node has no GPU.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import {
  EXPERIMENTAL_WORLD_POST,
  mountCityPostPipeline,
  parsePostTier,
  parsePostToneMapping,
  POST,
  resolvePostOptions,
} from './pipeline.ts';
import type { AppliedPostEffects } from './pipeline.ts';
import { parseSkyRigFlag } from '../world/sky-rig.ts';

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
  // The builder asks backend.utils for texture sample metadata; node has no GPU.
  backend.utils = { getTextureSampleData: () => ({ samples: 1, primarySamples: 1, isMSAA: false }) };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  return renderer;
}

const noEffects: AppliedPostEffects = { bloom: false, ao: false, aa: false, grade: false };

test('post flag is opt-in and shares the rig flag truth table', () => {
  for (const on of ['1', 'true', 'on', 'yes', ' TRUE ', 'On']) {
    assert.equal(parseSkyRigFlag(on), true, on);
  }
  for (const off of [undefined, null, '', '0', 'false', 'off', 'nope', '  ']) {
    assert.equal(parseSkyRigFlag(off), false, String(off));
  }
  assert.equal(EXPERIMENTAL_WORLD_POST, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_POST));
});

test('every effect flag is independent and defaults off', () => {
  assert.deepEqual(resolvePostOptions({}), {
    bloom: false,
    ao: false,
    aa: false,
    grade: false,
    tier: 'phone',
    toneMapping: 'none',
  });
  for (const [env, key] of [
    ['EXPO_PUBLIC_WORLD_POST_BLOOM', 'bloom'],
    ['EXPO_PUBLIC_WORLD_POST_AO', 'ao'],
    ['EXPO_PUBLIC_WORLD_POST_AA', 'aa'],
    ['EXPO_PUBLIC_WORLD_POST_GRADE', 'grade'],
  ] as const) {
    const options = resolvePostOptions({ [env]: '1' });
    for (const name of ['bloom', 'ao', 'aa', 'grade'] as const) {
      assert.equal(options[name], name === key, `${env} flipped ${name}`);
    }
    assert.equal(options.tier, 'phone', `${env} left the tier alone`);
    assert.equal(options.toneMapping, 'none', `${env} left tone mapping alone`);
  }
});

test('tone mapping selector accepts aces/agx/neutral and nothing else', () => {
  for (const value of ['aces', 'ACES', ' aces ', 'agx', 'neutral']) {
    assert.equal(parsePostToneMapping(value), value.trim().toLowerCase(), value);
  }
  for (const value of [undefined, null, '', 'none', 'filmic', 'reinhard', '0', 'yes']) {
    assert.equal(parsePostToneMapping(value), 'none', String(value));
  }
  const options = resolvePostOptions({ EXPO_PUBLIC_WORLD_POST_TONEMAPPING: 'agx' });
  assert.equal(options.toneMapping, 'agx');
});

test('tier accepts only high — everything else is the phone tier', () => {
  assert.equal(parsePostTier('high'), 'high');
  assert.equal(parsePostTier(' HIGH '), 'high');
  for (const value of [undefined, null, '', 'phone', 'low', 'medium', '0', 'yes']) {
    assert.equal(parsePostTier(value), 'phone', String(value));
  }
});

test('POST pins the Flying Roadster measured values', () => {
  // The design look constants (docs/design/); the pinned values must not
  // drift — every change here is a visible look change on device.
  assert.equal(POST.bloomStrength, 0.045);
  assert.equal(POST.contrast, 1.06);
  assert.equal(POST.saturation, 1.04);
  assert.equal(POST.vignette, 0.22);
  assert.equal(POST.aoSamples, 12);
  // The unmeasured knobs stay inside sane ranges while they wait for the
  // device tune.
  assert.equal(POST.exposure, 1);
  assert.ok(POST.vignetteInner > 0 && POST.vignetteInner < POST.vignetteOuter, 'vignette band');
  assert.ok(POST.vignetteOuter <= 0.75, 'vignette reaches the corners');
  assert.ok(POST.aoResolutionScale > 0 && POST.aoResolutionScale <= 1, 'AO scale');
});

test('mount wires only the flagged effects; AO needs the high tier', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);

  // Nothing flagged: the chain is the bare scene texture and the pipeline
  // appends the output transform itself — the identical-to-today invariant.
  const bare = mountCityPostPipeline(THREE, { renderer, scene, camera, options: {} });
  assert.deepEqual(bare.applied, noEffects);
  assert.equal(bare.pipeline.outputColorTransform, true, 'bare chain keeps the pipeline transform');
  assert.equal(bare.pipeline.outputNode, bare.scenePass.getTextureNode('output'));
  bare.dispose();

  // AO flagged on the phone tier: dropped before the graph is built.
  const phone = mountCityPostPipeline(THREE, { renderer, scene, camera, options: { ao: true, tier: 'phone' } });
  assert.equal(phone.applied.ao, false, 'AO does not wire on the phone tier');
  phone.dispose();

  // AO on the high tier: MRT normals and the multiply are wired.
  const high = mountCityPostPipeline(THREE, { renderer, scene, camera, options: { ao: true, tier: 'high' } });
  assert.equal(high.applied.ao, true, 'AO wires on the high tier');
  assert.equal(high.pipeline.outputColorTransform, true, 'AO alone stays pre-transform');
  assert.notEqual(high.pipeline.outputNode, high.scenePass.getTextureNode('output'));
  high.dispose();
});

test('each effect changes the wiring independently of the others', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);

  // Bloom alone: no display-space stage needed — the pipeline transform stays.
  const bloomOnly = mountCityPostPipeline(THREE, { renderer, scene, camera, options: { bloom: true } });
  assert.deepEqual(bloomOnly.applied, { ...noEffects, bloom: true });
  assert.equal(bloomOnly.pipeline.outputColorTransform, true);
  bloomOnly.dispose();

  // Grade alone: forces the transform inside the chain (outputColorTransform off).
  const gradeOnly = mountCityPostPipeline(THREE, { renderer, scene, camera, options: { grade: true } });
  assert.deepEqual(gradeOnly.applied, { ...noEffects, grade: true });
  assert.equal(gradeOnly.pipeline.outputColorTransform, false);
  gradeOnly.dispose();

  // AA alone: same display-space stage, with FXAA last.
  const aaOnly = mountCityPostPipeline(THREE, { renderer, scene, camera, options: { aa: true } });
  assert.deepEqual(aaOnly.applied, { ...noEffects, aa: true });
  assert.equal(aaOnly.pipeline.outputColorTransform, false);
  aaOnly.dispose();

  // Bloom on/off leaves the grade wiring byte-identical in structure.
  for (const bloom of [false, true]) {
    const post = mountCityPostPipeline(THREE, { renderer, scene, camera, options: { bloom, grade: true } });
    assert.equal(post.applied.bloom, bloom);
    assert.equal(post.applied.grade, true);
    assert.equal(post.pipeline.outputColorTransform, false);
    post.dispose();
  }
});

test('the selector maps onto renderer.toneMapping and dispose restores it', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  renderer.toneMapping = THREE.NoToneMapping;

  for (const [name, constant] of [
    ['aces', THREE.ACESFilmicToneMapping],
    ['agx', THREE.AgXToneMapping],
    ['neutral', THREE.NeutralToneMapping],
    ['none', THREE.NoToneMapping],
  ] as const) {
    const post = mountCityPostPipeline(THREE, { renderer, scene, camera, options: { toneMapping: name } });
    assert.equal(renderer.toneMapping, constant, name);
    post.dispose();
    assert.equal(renderer.toneMapping, THREE.NoToneMapping, `${name} restored`);
  }
});

test('mount patches renderer.render; the delegate cannot recurse', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const original = renderer.render;

  const post = mountCityPostPipeline(THREE, { renderer, scene, camera, options: {} });
  assert.notEqual(renderer.render, original, 'render is delegated');
  assert.ok(Object.hasOwn(renderer, 'render'), 'the patch is an own property');

  // The delegate calls pipeline.render(), whose internals call
  // renderer.render again (PassNode, QuadMesh). The guard routes those back
  // to the direct render — which fails on the GPU-less stub backend, but a
  // broken guard would show up as a stack overflow instead.
  assert.throws(() => renderer.render(scene, camera), (error) => !(error instanceof RangeError));
  // The flag released on the way out: a second call fails the same way, not silently.
  assert.throws(() => renderer.render(scene, camera), (error) => !(error instanceof RangeError));

  post.dispose();
  assert.equal(Object.hasOwn(renderer, 'render'), false, 'the own-property patch is gone');
  assert.equal(renderer.render, original, 'the prototype method answers again');
});

test('dispose is idempotent and restores the tone mapping exposure', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const post = mountCityPostPipeline(THREE, { renderer, scene, camera, options: { grade: true, bloom: true, aa: true } });
  post.dispose();
  assert.equal(renderer.toneMappingExposure, 1, 'exposure restored');
  post.dispose();
});

test('the mounted pipeline material compiles to a real WGSL fragment — bare and fully flagged', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);

  // The black-frame regression guard: RenderPipeline._updateContext() builds
  // the real quad material (context + renderOutput wrap); it must compile to
  // a fragment that samples a texture — a constant-colour fragment would be
  // the shader shape of a black frame. Private-member access is the same
  // poke style as the stub backend above; a device frame is still required
  // for the visual check.
  const compileOutput = (options: Parameters<typeof mountCityPostPipeline>[1]['options']) => {
    const post = mountCityPostPipeline(THREE, { renderer, scene, camera, options });
    const internals = post.pipeline as unknown as {
      _updateContext(): void;
      _quadMesh: { material: THREE.Material };
    };
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

  const bare = compileOutput({});
  assert.ok(bare.length > 400, `bare pipeline fragment: ${bare.length} chars`);
  assert.match(bare, /texture_/, 'bare pipeline samples the scene texture');

  const full = compileOutput({ bloom: true, ao: true, aa: true, grade: true, tier: 'high', toneMapping: 'aces' });
  assert.ok(full.length > bare.length, `full stack fragment: ${full.length} chars vs bare ${bare.length}`);
  assert.match(full, /texture_/, 'full stack samples textures');

  // Every single effect alone still compiles to a non-trivial fragment.
  for (const options of [
    { bloom: true },
    { ao: true, tier: 'high' },
    { aa: true },
    { grade: true },
    { toneMapping: 'neutral' },
  ] as const) {
    const shader = compileOutput(options);
    assert.ok(shader.length > 400, `${JSON.stringify(options)} fragment: ${shader.length} chars`);
    assert.match(shader, /texture_/, JSON.stringify(options));
  }
});
