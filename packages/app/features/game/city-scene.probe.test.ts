// Phase 0 probe wiring on the Harlem scene: EXPO_PUBLIC_WORLD_PROBE=bgnull
// (shadow2 with a Color background) mounts the SunLight and the Color and
// nothing else of the physical stack, even with the master flag set too,
// and the scene logs which probe is active. Device frames are D1.
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
process.env.EXPO_PUBLIC_WORLD_PROBE = 'bgnull';
delete process.env.EXPO_PUBLIC_WORLD_POST;

const THREE = await import('three/webgpu');
const { SunLight } = await import('three/examples/jsm/lights/SunLight.js');
const { cityPhysicalFeatures, createCityScene } = await import('./city-scene.ts');
const { probeFeatures } = await import('./world/physical-look.ts');
const { recordPmremBakes, sceneContext, sceneParams, stubRenderer } = await import('./city-scene.physical-harness.test-support.ts');

test('a probe wins over the master flag and mounts only its feature', async () => {
  assert.deepEqual(cityPhysicalFeatures(), probeFeatures('bgnull'));
  const bakes = recordPmremBakes();
  const logged: unknown[][] = [];
  const info = console.info;
  console.info = (...args: unknown[]) => { logged.push(args); };
  try {
    const renderer = await stubRenderer();
    const priorLighting = renderer.lighting;
    const built = createCityScene(sceneContext(renderer), sceneParams());
    const scene = built.scene as InstanceType<typeof THREE.Scene>;
    assert.ok(scene.background instanceof THREE.Color, 'the probe sets the Color background');
    assert.ok(scene.getObjectByName('city:physical-sun') instanceof SunLight);
    assert.equal(renderer.shadowMap.enabled, true);
    assert.equal(renderer.outputColorSpace, THREE.LinearSRGBColorSpace, 'no sRGB output');
    assert.equal(renderer.toneMapping, THREE.NoToneMapping, 'no pipeline, no ACES');
    assert.equal(Object.hasOwn(renderer, 'render'), false, 'no RenderPipeline mounted');
    assert.equal(renderer.lighting, priorLighting, 'no clustered lighting');
    assert.equal(scene.getObjectByName('city:physical-sky'), undefined);
    assert.equal(bakes.calls, 0);
    const line = logged.find((args) => args[0] === '[NYC-Mon/probe] active');
    assert.ok(line, 'the active probe is logged once at mount');
    assert.equal((line[1] as { probe: string }).probe, 'bgnull');
    built.dispose!();
  } finally {
    console.info = info;
    bakes.restore();
  }
});
