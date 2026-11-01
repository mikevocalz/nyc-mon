// Shared fixtures for the physical-lane tests: rig uniforms at Slop's
// js/tsl-materials.js cityUniforms initial values,
// and the stub WebGPURenderer + WGSLNodeBuilder compile used by
// world/pbr-materials.test.ts.
import * as THREE from 'three/webgpu';
import type { PhysicalMaterialUniforms } from './tsl-common.ts';

export function testUniforms(): PhysicalMaterialUniforms {
  const T = THREE.TSL;
  return {
    uSunColor: T.uniform(new THREE.Color(1, 0.79, 0.57)),
    uSkyTopColor: T.uniform(new THREE.Color(0.17, 0.34, 0.55)),
    uSkyHorizonColor: T.uniform(new THREE.Color(0.92, 0.82, 0.71)),
    uSkySunDir: T.uniform(new THREE.Vector3(-0.66, 0.34, -0.67).normalize()),
    uInteriorGlow: T.uniform(0.78),
    uRoadWetness: T.uniform(0.38),
    uCanyonBounce: T.uniform(0.52),
  } as unknown as PhysicalMaterialUniforms;
}

type Builder = {
  scene: unknown; camera: unknown; material: unknown; context: { material: unknown }; fogNode: unknown;
  build(): void; vertexShader?: string; fragmentShader?: string;
};
const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;

export async function stubRenderer() {
  const canvas = { width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  // Texture nodes ask the backend for MSAA sample counts; node has no GPU, so answer single-sampled (as vd-materials.test.ts does).
  (renderer as unknown as { backend: { utils: unknown } }).backend.utils = {
    getTextureSampleData: () => ({ samples: 1, primarySamples: 1, isMSAA: false }),
  };
  return renderer;
}

/** Build one object's node material to WGSL the way the renderer would. */
export function compileWgsl(renderer: unknown, object: THREE.Object3D, material: THREE.Material) {
  const scene = new THREE.Scene();
  scene.add(object);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const b = new WGSLNodeBuilder(object, renderer);
  b.scene = scene; b.camera = camera; b.material = material; b.context.material = material;
  b.fogNode = null;
  const started = performance.now();
  b.build();
  return { vertex: b.vertexShader ?? '', fragment: b.fragmentShader ?? '', ms: performance.now() - started };
}
