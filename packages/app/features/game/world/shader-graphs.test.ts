// Compiles every city material's TSL graph to WGSL in node, through three's
// own WGSLNodeBuilder, so a broken or runaway node graph fails here rather
// than on the device. Two limits: the cel body is TypeGPU 'use gpu' code
// that only resolves under the Metro/Vite transform, so cel materials are
// compiled as their TSL albedo and emissive graphs on a basic material
// (materials.albedoGraphs); and textured materials (lettering, leaves) need
// a GPU backend for sampling, so they are skipped. Scene fog is not included.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { ThreeContext } from '@acme/ui/three';
import { parseCityDataset } from '../city-dataset.ts';
import { createCityScene } from '../city-scene.ts';
import { SUN } from './index.ts';
import { createCityMaterials } from './materials.ts';

type Builder = { scene: unknown; camera: unknown; material: unknown; context: { material: unknown }; fogNode: unknown; build(): void; fragmentShader?: string };
const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;
const TEXTURED = new Set(['city:sign-lettering', 'city:landmark-lettering', 'city:trees-near']);

test('every city material graph compiles to WGSL, quickly and at a sane size', async () => {
  const canvas = { width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  // The two backend capabilities the builder asks for; node has no GPU.
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const built = createCityScene({ THREE } as unknown as ThreeContext, { dataset, camera: { x: -28, z: 22, yaw: Math.PI / 2, distance: 8 } });
  const compile = (mesh: THREE.Object3D, material: THREE.Material) => {
    const b = new WGSLNodeBuilder(mesh, renderer);
    b.scene = built.scene; b.camera = built.camera; b.material = material; b.context.material = material;
    // No node manager without a backend, so scene fog is left out of these builds.
    b.fogNode = null;
    const started = performance.now();
    b.build();
    return { ms: performance.now() - started, size: b.fragmentShader?.length ?? 0 };
  };
  const materials = createCityMaterials(THREE as never, SUN);
  let compiled = 0;
  const seen = new Set<string>();
  built.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || seen.has(mesh.name) || TEXTURED.has(mesh.name)) return;
    seen.add(mesh.name);
    const material = mesh.material as THREE.Material & { colorNode?: unknown };
    try {
      const { ms, size } = compile(mesh, material);
      assert.ok(ms < 200 && size < 20_000, `${mesh.name}: ${ms.toFixed(1)} ms, ${size} chars`);
      compiled++;
    } catch (error) {
      // Only the TypeGPU cel body may fail, and only for want of the 'use gpu' transform.
      assert.match(String((error as Error).message), /Resolution of the following tree failed/, `${mesh.name}: ${String((error as Error).message).slice(0, 300)}`);
    }
  });
  for (const [material, albedo] of materials.albedoGraphs) {
    const stand = new THREE.MeshBasicNodeMaterial();
    stand.colorNode = THREE.TSL.vec4(albedo as never, 1);
    (stand as unknown as { emissiveNode: unknown }).emissiveNode = (material as unknown as { emissiveNode?: unknown }).emissiveNode ?? null;
    const name = Object.entries(materials).find(([, v]) => v === material)?.[0] ?? '?';
    const holder = built.scene.getObjectByName(name === 'cars' ? 'city:cars' : name === 'trunks' ? 'city:tree-trunks' : 'city:walls-masonry')!;
    const { ms, size } = compile(holder, stand);
    assert.ok(ms < 200 && size > 400 && size < 20_000, `${name}: ${ms.toFixed(1)} ms, ${size} chars`);
    compiled++;
  }
  assert.ok(compiled >= 20, `${compiled} graphs compiled`);
  materials.dispose();
  built.dispose!();
});
