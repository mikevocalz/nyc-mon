// A probe needs the master flag: EXPO_PUBLIC_WORLD_PROBE=bgnull with
// EXPO_PUBLIC_WORLD_PHYSICAL unset mounts nothing of the physical stack and
// logs no probe line, the same gate the device-lane probes already had.
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '0';
process.env.EXPO_PUBLIC_WORLD_VD = '0';
process.env.EXPO_PUBLIC_WORLD_PROBE = 'bgnull';
delete process.env.EXPO_PUBLIC_WORLD_POST;

const THREE = await import('three/webgpu');
const { cityPhysicalFeatures, createCityScene } = await import('./city-scene.ts');
const { recordPmremBakes, sceneContext, sceneParams, stubRenderer } = await import('./city-scene.physical-harness.test-support.ts');

test('probe without the master flag: today\'s path, no probe log', async () => {
  assert.equal(cityPhysicalFeatures(), null);
  const bakes = recordPmremBakes();
  const logged: unknown[][] = [];
  const info = console.info;
  console.info = (...args: unknown[]) => { logged.push(args); };
  try {
    const renderer = await stubRenderer();
    const built = createCityScene(sceneContext(renderer), sceneParams());
    const scene = built.scene as InstanceType<typeof THREE.Scene>;
    assert.equal(scene.background, null, 'no Color background');
    assert.equal(scene.getObjectByName('city:physical-sun'), undefined);
    assert.equal(renderer.shadowMap.enabled, false);
    assert.equal(bakes.calls, 0);
    assert.equal(logged.some((args) => typeof args[0] === 'string' && args[0].startsWith('[NYC-Mon/probe]')), false);
    built.dispose!();
  } finally {
    console.info = info;
    bakes.restore();
  }
});
