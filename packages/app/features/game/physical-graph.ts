// Loaders for the modules only the Slop-grade city uses
// (EXPO_PUBLIC_WORLD_PHYSICAL and the Phase 0 probes). Callers reach them
// through these functions at the use site, behind the flag, so a flag-off
// build never evaluates them: the light rig with SkyMesh, SunLight,
// SunLightNode and ClusteredLighting, SSRNode, the lofted fleet and its
// headlights, the device-lane probes with the Skia texture bridge, the
// Slop city materials (world/physical/index.ts), the facelift
// (world/physical/facelift.ts) and the night light pools
// (world/physical/night-lights.ts), and the vd lane's baked fleet bodies
// (world/vd-car-mesh.ts with its 700 KB vd-cars.ts, living-city/vd-car-material.ts).
//
// Each loader is an inline `require('<literal path>')`: Metro collects the
// literal as a dependency and evaluates the module on the first call, with
// or without inlineRequires (Expo's default config has it off; worklets
// Bundle Mode forces it on). node --test loads this file as an ES module,
// where `require` is undefined, so there the same path goes through a
// require created for this file; Node shares the module instance with the
// ESM loader, so a class imported elsewhere is the same class.
//
// Types come from `typeof import(...)`, which tsc checks against the path.
/* eslint-disable @typescript-eslint/no-require-imports -- the inline require is the lazy load */

type NodeRequireFn = (id: string) => unknown;

let nodeRequire: NodeRequireFn | null = null;

function viaNode(id: string): unknown {
  if (!nodeRequire) {
    // This file's own URL, from the frame that is running it.
    const at = /(file:\/\/[^\s)]+?):\d+:\d+/.exec(new Error().stack ?? '')?.[1];
    const builtin = (process as unknown as { getBuiltinModule(id: string): { createRequire(path: string): NodeRequireFn } })
      .getBuiltinModule('node:module');
    if (!at) throw new Error('physical-graph: no module URL for the node require fallback');
    nodeRequire = builtin.createRequire(at);
  }
  return nodeRequire(id);
}

export function loadPhysicalRig(): typeof import('./world/physical-rig.ts') {
  return (typeof require === 'function' ? require('./world/physical-rig.ts') : viaNode('./world/physical-rig.ts')) as typeof import('./world/physical-rig.ts');
}

export function loadSsrNode(): typeof import('three/examples/jsm/tsl/display/SSRNode.js') {
  return (typeof require === 'function'
    ? require('three/examples/jsm/tsl/display/SSRNode.js')
    : viaNode('three/examples/jsm/tsl/display/SSRNode.js')) as typeof import('three/examples/jsm/tsl/display/SSRNode.js');
}

export function loadLoftedCar(): typeof import('./living-city/lofted-car.ts') {
  return (typeof require === 'function' ? require('./living-city/lofted-car.ts') : viaNode('./living-city/lofted-car.ts')) as typeof import('./living-city/lofted-car.ts');
}

export function loadLoftedCarMaterial(): typeof import('./living-city/lofted-car-material.ts') {
  return (typeof require === 'function'
    ? require('./living-city/lofted-car-material.ts')
    : viaNode('./living-city/lofted-car-material.ts')) as typeof import('./living-city/lofted-car-material.ts');
}

export function loadVehicleHeadlights(): typeof import('./living-city/vehicle-headlights.ts') {
  return (typeof require === 'function'
    ? require('./living-city/vehicle-headlights.ts')
    : viaNode('./living-city/vehicle-headlights.ts')) as typeof import('./living-city/vehicle-headlights.ts');
}

export function loadDeviceProbes(): typeof import('./render-runtime/device-probes.ts') {
  return (typeof require === 'function'
    ? require('./render-runtime/device-probes.ts')
    : viaNode('./render-runtime/device-probes.ts')) as typeof import('./render-runtime/device-probes.ts');
}

export function loadPhysicalFacelift(): typeof import('./world/physical/facelift.ts') {
  return (typeof require === 'function'
    ? require('./world/physical/facelift.ts')
    : viaNode('./world/physical/facelift.ts')) as typeof import('./world/physical/facelift.ts');
}

export function loadPhysicalCityMaterials(): typeof import('./world/physical/index.ts') {
  return (typeof require === 'function'
    ? require('./world/physical/index.ts')
    : viaNode('./world/physical/index.ts')) as typeof import('./world/physical/index.ts');
}

export function loadPhysicalNightLights(): typeof import('./world/physical/night-lights.ts') {
  return (typeof require === 'function'
    ? require('./world/physical/night-lights.ts')
    : viaNode('./world/physical/night-lights.ts')) as typeof import('./world/physical/night-lights.ts');
}

export function loadVdCarMaterial(): typeof import('./living-city/vd-car-material.ts') {
  return (typeof require === 'function'
    ? require('./living-city/vd-car-material.ts')
    : viaNode('./living-city/vd-car-material.ts')) as typeof import('./living-city/vd-car-material.ts');
}

export function loadVdCarMesh(): typeof import('./world/vd-car-mesh.ts') {
  return (typeof require === 'function' ? require('./world/vd-car-mesh.ts') : viaNode('./world/vd-car-mesh.ts')) as typeof import('./world/vd-car-mesh.ts');
}
