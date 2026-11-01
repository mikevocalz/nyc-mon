// Shared by the city-scene physical tests: a GPU-less WebGPURenderer (the
// pipeline.test.ts stub) and a PMREM bake double that records each call and
// hands back the reused target, since node has no GPU to render the cube.
import * as THREE from 'three/webgpu';
import type { ThreeContext } from '@acme/ui/three';
import { parseCityDataset } from './city-dataset.ts';
import { syntheticTileV2 } from './world/synthetic-tile.ts';

export async function stubRenderer() {
  const canvas = {
    width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null,
  } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  const backend = (renderer as unknown as { backend: Record<string, unknown> }).backend;
  backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  backend.utils = { getTextureSampleData: () => ({ samples: 1, primarySamples: 1, isMSAA: false }) };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  return renderer;
}

export function recordPmremBakes(): { calls: number; restore(): void } {
  const proto = THREE.PMREMGenerator.prototype as unknown as { fromScene: (scene: unknown, sigma: unknown, near: unknown, far: unknown, options: { renderTarget?: THREE.RenderTarget | null }) => unknown };
  const original = proto.fromScene;
  const record = { calls: 0, restore: () => { proto.fromScene = original; } };
  proto.fromScene = (_scene: unknown, _sigma: unknown, _near: unknown, _far: unknown, options: { renderTarget?: THREE.RenderTarget | null }) => {
    record.calls++;
    return options.renderTarget ?? new THREE.RenderTarget(4, 4);
  };
  return record;
}

export function sceneContext(renderer: THREE.WebGPURenderer | null): ThreeContext {
  return { THREE, renderer: renderer ?? undefined, invalidate: () => {} } as unknown as ThreeContext;
}

export function sceneParams() {
  return { camera: { x: 0, z: 0, yaw: 0, distance: 200 }, dataset: parseCityDataset(syntheticTileV2()) };
}
