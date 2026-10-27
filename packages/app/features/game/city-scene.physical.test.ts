// Slop-grade city with EXPO_PUBLIC_WORLD_PHYSICAL on (N3). The flag is read
// at module load, so it is set before city-scene is imported; node --test
// runs each file in its own process. Renderer state, scene state and the
// one-pipeline rule are checked on a GPU-less renderer; the frame is
// device-pending.
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_TIER;

const THREE = await import('three/webgpu');
const { SunLight } = await import('three/examples/jsm/lights/SunLight.js');
const { ClusteredLighting } = await import('three/examples/jsm/lighting/ClusteredLighting.js');
const { cityPhysicalFeatures, createCityScene } = await import('./city-scene.ts');
const { fullPhysicalFeatures } = await import('./world/physical-look.ts');
const { PHYSICAL_PRESETS } = await import('./world/physical-presets.ts');
const { TIER } = await import('./perf/tier.ts');
const { recordPmremBakes, sceneContext, sceneParams, stubRenderer } = await import('./city-scene.physical-harness.test-support.ts');

test('flag on: the full feature set, SSR per the phone tier', () => {
  assert.deepEqual(cityPhysicalFeatures(), fullPhysicalFeatures(TIER.phone.physical.ssr !== null));
  assert.equal(cityPhysicalFeatures()!.ssr, false, 'the phone tier starts with SSR off');
});

test('flag on: sRGB output, ACES in one pipeline, shadows, null background, the Slop rig', async () => {
  const bakes = recordPmremBakes();
  try {
    const renderer = await stubRenderer();
    (renderer.backend as unknown as { isWebGPUBackend: boolean }).isWebGPUBackend = true;
    const priorLighting = renderer.lighting;
    const params = sceneParams();
    const built = createCityScene(sceneContext(renderer), params);
    const scene = built.scene as InstanceType<typeof THREE.Scene>;

    assert.equal(renderer.outputColorSpace, THREE.SRGBColorSpace);
    assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
    assert.equal(renderer.toneMappingExposure, 1);
    assert.equal(renderer.shadowMap.enabled, true);
    assert.equal(scene.background, null);
    assert.ok(renderer.lighting instanceof ClusteredLighting);
    assert.equal((renderer.lighting as InstanceType<typeof ClusteredLighting>).maxLights, TIER.phone.physical.clusteredMaxLights);

    const sun = scene.getObjectByName('city:physical-sun');
    assert.ok(sun instanceof SunLight);
    assert.equal(sun.shadow.mapSize.x, 2048, 'phone tile');
    assert.ok(scene.getObjectByName('city:physical-sky'));
    assert.ok(scene.getObjectByName('city:physical-hemi'));
    assert.equal(scene.getObjectByName('city:sky')!.visible, false, 'the world dome gives way to the SkyMesh');
    let worldLightsLit = 0;
    scene.getObjectByName('city:world')!.traverse((o) => {
      const l = o as typeof o & { isDirectionalLight?: boolean; isHemisphereLight?: boolean };
      if ((l.isDirectionalLight || l.isHemisphereLight) && o.visible) worldLightsLit++;
    });
    assert.equal(worldLightsLit, 0, 'the world sun and hemi are replaced, not doubled');
    assert.equal(bakes.calls, 1);
    assert.ok(scene.environment);
    assert.ok((scene as unknown as { fogNode: unknown }).fogNode);
    assert.equal(scene.environmentIntensity, PHYSICAL_PRESETS.twilight.envIntensity);
    assert.equal(scene.getObjectByName('city:walls-masonry')!.castShadow, true);
    assert.equal(scene.getObjectByName('city:roads')!.castShadow, false);

    // Exactly one RenderPipeline answers renderer.render.
    const proto = THREE.RenderPipeline.prototype as unknown as { render: () => void };
    const original = proto.render;
    let renders = 0;
    proto.render = function () { renders++; };
    try {
      renderer.render(scene, built.camera);
    } finally {
      proto.render = original;
    }
    assert.equal(renders, 1);

    // A preset change re-lights and rebakes into the same target.
    const env = scene.environment;
    built.update!({ delta: 0, time: 0, reducedMotion: false } as never, { ...params, preset: 'midnight' });
    assert.equal(bakes.calls, 2);
    assert.equal(scene.environment, env);
    assert.ok((sun as InstanceType<typeof SunLight>).color.equals(new THREE.Color(PHYSICAL_PRESETS.midnight.colors.sun)));
    built.update!({ delta: 0, time: 0, reducedMotion: false } as never, { ...params, preset: 'midnight' });
    assert.equal(bakes.calls, 2, 'same preset, no rebake');

    built.dispose!();
    assert.equal(renderer.lighting, priorLighting);
    assert.equal(Object.hasOwn(renderer, 'render'), false);
  } finally {
    bakes.restore();
  }
});

test('flag on without a renderer still builds the rig objects (node scene path)', () => {
  const built = createCityScene(sceneContext(null), sceneParams());
  assert.ok(built.scene.getObjectByName('city:physical-sun'));
  assert.ok(built.scene.getObjectByName('city:physical-sky'));
  assert.equal(built.scene.environment, null, 'no renderer, no bake');
  built.dispose!();
});
