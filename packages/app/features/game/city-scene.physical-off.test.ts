// Flag-off invariant (N1): with EXPO_PUBLIC_WORLD_PHYSICAL and
// EXPO_PUBLIC_WORLD_PROBE unset, the scene leaves the renderer exactly as
// before this lane (linear output, no tone mapping, no shadow maps, no
// pipeline, default lighting) and adds no physical object.
import assert from 'node:assert/strict';
import { test } from 'node:test';

delete process.env.EXPO_PUBLIC_WORLD_PHYSICAL;
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_POST;
delete process.env.EXPO_PUBLIC_WORLD_VD;

const THREE = await import('three/webgpu');
const { cityPhysicalFeatures, createCityScene } = await import('./city-scene.ts');
const { recordPmremBakes, sceneContext, sceneParams, stubRenderer } = await import('./city-scene.physical-harness.test-support.ts');

test('flag off: no physical features, renderer and scene as before', async () => {
  assert.equal(cityPhysicalFeatures(), null);
  const bakes = recordPmremBakes();
  try {
    const renderer = await stubRenderer();
    const priorLighting = renderer.lighting;
    const built = createCityScene(sceneContext(renderer), sceneParams());
    const scene = built.scene as InstanceType<typeof THREE.Scene>;
    assert.equal(renderer.outputColorSpace, THREE.LinearSRGBColorSpace);
    assert.equal(renderer.toneMapping, THREE.NoToneMapping);
    assert.equal(renderer.toneMappingExposure, 1);
    assert.equal(renderer.shadowMap.enabled, false);
    assert.equal(renderer.lighting, priorLighting);
    assert.equal(Object.hasOwn(renderer, 'render'), false, 'no RenderPipeline');
    assert.equal(scene.background, null);
    assert.equal(scene.environment, null);
    assert.equal((scene as unknown as { fogNode?: unknown }).fogNode, undefined);
    assert.equal(bakes.calls, 0);
    const physical: string[] = [];
    scene.traverse((o) => { if (o.name.startsWith('city:physical-')) physical.push(o.name); });
    assert.deepEqual(physical, []);
    assert.equal(scene.getObjectByName('city:sky')!.visible, true);
    built.dispose!();
  } finally {
    bakes.restore();
  }
});
