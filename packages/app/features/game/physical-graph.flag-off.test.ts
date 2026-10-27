// Flag-off load invariant: with EXPO_PUBLIC_WORLD_PHYSICAL unset, loading the
// Game scene, the worklet render module and the vehicle actor evaluates none
// of the physical-only modules (the light rig and its three addons, SSR, the
// lofted fleet, the device-lane probes and the Skia bridge, and the Slop city
// materials and facelift under world/physical/). A load hook
// records every module URL node evaluates; react-native-worklets is a stub.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

delete process.env.EXPO_PUBLIC_WORLD_PHYSICAL;
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_POST;
delete process.env.EXPO_PUBLIC_WORLD_VD;

const loaded: string[] = [];
const WORKLETS = 'export const scheduleOnRN = (fn, ...args) => fn(...args);';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react-native-worklets') return { url: 'stub:react-native-worklets', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    loaded.push(url);
    if (url === 'stub:react-native-worklets') return { format: 'module', source: WORKLETS, shortCircuit: true };
    if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { ...context.importAttributes, type: 'json' } });
    return next(url, context);
  },
});

const PHYSICAL_ONLY = [
  '/features/game/world/physical-rig.ts',
  '/examples/jsm/objects/SkyMesh.js',
  '/examples/jsm/lights/SunLight.js',
  '/examples/jsm/lights/SunLightNode.js',
  '/examples/jsm/lighting/ClusteredLighting.js',
  '/examples/jsm/tsl/display/SSRNode.js',
  '/features/game/living-city/lofted-car.ts',
  '/features/game/living-city/lofted-car-material.ts',
  '/features/game/living-city/vehicle-headlights.ts',
  '/features/game/render-runtime/device-probes.ts',
  '/features/game/render-runtime/skia-texture-bridge.ts',
  // world/physical/: everything but class-family.ts and facade-attributes.ts,
  // which city-mesh.ts reads on every build for the wall-attribute writers.
  '/features/game/world/physical/index.ts',
  '/features/game/world/physical/facelift.ts',
  '/features/game/world/physical/facade.ts',
  '/features/game/world/physical/facade-frame.ts',
  '/features/game/world/physical/interior.ts',
  '/features/game/world/physical/fire-escapes.ts',
  '/features/game/world/physical/road-paint.ts',
  '/features/game/world/physical/roads.ts',
  '/features/game/world/physical/canyon-ao.ts',
  '/features/game/world/physical/culling.ts',
  '/features/game/world/physical/tsl-common.ts',
  '/features/game/world/physical/loose-tsl.ts',
];

test('flag off: city-scene, game-render and vehicle-actor load no physical-only module', async () => {
  const { createCityScene } = await import('./city-scene.ts');
  await import('./render-runtime/game-render.ts');
  const { createVehicleActor } = await import('./living-city/vehicle-actor.ts');
  await import('./render-runtime/run-js-device-probes.ts');
  // Building the flag-off scene and fleet must not pull them in either.
  const THREE = await import('three/webgpu');
  const { sceneContext, sceneParams } = await import('./city-scene.physical-harness.test-support.ts');
  const built = createCityScene(sceneContext(null), sceneParams());
  const actor = createVehicleActor({ read: () => undefined, physical: false })(THREE as never);
  actor.dispose();
  built.dispose!();

  assert.ok(loaded.some((url) => url.endsWith('/features/game/city-scene.ts')), 'the hook sees module loads');
  const hits = PHYSICAL_ONLY.filter((suffix) => loaded.some((url) => url.endsWith(suffix)));
  assert.deepEqual(hits, []);
});
