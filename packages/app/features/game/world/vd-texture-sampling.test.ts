// The vd photo arrays (walls, ground, normals) are 256 px DataArrayTextures.
// Every one must reach the GPU with its full mip chain and a trilinear,
// anisotropic sampler, so a wall or a road seen from far or at a grazing
// angle reads a filtered average of the photo, never one texel per pixel.
// Checked on the material textures themselves and on what the default build
// (physical + vd) asks the recording GPU device for at the iPad buffer.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
delete process.env.EXPO_PUBLIC_WORLD_VD;
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_VD_LEANMAT;

type Tex = {
  isTexture: true; name: string; generateMipmaps: boolean; minFilter: number; magFilter: number; anisotropy: number;
  wrapS: number; wrapT: number; image: { width: number; height: number; depth: number }; mipmaps: unknown[];
};

/** Every texture reachable from a material's fields and node graph. */
function texturesOf(material: unknown): Set<Tex> {
  const out = new Set<Tex>();
  const seen = new Set<unknown>();
  const visit = (v: unknown, depth: number) => {
    if (!v || typeof v !== 'object' || seen.has(v) || depth > 40 || ArrayBuffer.isView(v)) return;
    seen.add(v);
    if ((v as { isTexture?: boolean }).isTexture) { out.add(v as Tex); return; }
    for (const x of Object.values(v as Record<string, unknown>)) visit(x, depth + 1);
  };
  visit(material, 0);
  return out;
}

test('every vd photo array: full mip chain requested, trilinear, anisotropy 16, repeat', async () => {
  const THREE = await import('three/webgpu');
  const { createVdCityMaterials, VD_TEXTURE_ANISOTROPY, VD_TEXTURE_NAMES } = await import('./vd-materials.ts');
  const { VD_TEXTURE_SIZE } = await import('./vd-textures.ts');
  const materials = createVdCityMaterials(THREE as never, { sunDirection: [0.4, 0.8, 0.3], physical: true }, false);
  const found = new Map<string, Tex>();
  for (const m of [materials.masonry, materials.roads, materials.sidewalks, materials.roofs, materials.areas]) {
    for (const t of texturesOf(m)) if (t.name.startsWith('vd:')) found.set(t.name, t);
  }
  assert.deepEqual([...found.keys()].sort(), Object.values(VD_TEXTURE_NAMES).sort(), 'all three photo arrays are on the vd materials');
  for (const [name, t] of found) {
    assert.equal(t.image.width, VD_TEXTURE_SIZE, name);
    assert.equal(t.generateMipmaps, true, `${name}: mips generated`);
    assert.equal(t.mipmaps.length, 0, `${name}: three builds the chain, none supplied`);
    assert.equal(t.minFilter, THREE.LinearMipmapLinearFilter, `${name}: trilinear min filter`);
    assert.equal(t.magFilter, THREE.LinearFilter, `${name}: linear mag filter`);
    assert.equal(t.anisotropy, VD_TEXTURE_ANISOTROPY, `${name}: anisotropy`);
    assert.equal(t.wrapS, THREE.RepeatWrapping);
    assert.equal(t.wrapT, THREE.RepeatWrapping);
  }
  assert.equal(VD_TEXTURE_ANISOTROPY, 16);
  materials.dispose();
});

test('the default build uploads each vd array with 9 mip levels and samples it trilinear at 16x', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const THREE = await import('three/webgpu');
  const { parseCityDataset } = await import('../city-dataset.ts');
  const { createCityScene } = await import('../city-scene.ts');
  const { physicalRendererParams } = await import('./physical-look.ts');
  const { VD_TEXTURE_NAMES } = await import('./vd-materials.ts');
  const { VD_TEXTURE_SIZE, VD_WALL_LAYERS, VD_GROUND_LAYERS, VD_NORMAL_LAYERS } = await import('./vd-textures.ts');
  const { advanceNodeFrame } = await import('@acme/ui/three/internals');
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(2732, 2048), device, antialias: true, ...physicalRendererParams() } as never);
  await renderer.init();
  renderer.setPixelRatio(2);
  renderer.setSize(1366, 1024, false);
  const params = { camera: { x: -28, z: 22, yaw: Math.PI / 2, distance: 8 }, dataset };
  const built = createCityScene({ THREE, renderer, invalidate: () => {} } as never, params as never);
  built.update!({ delta: 1 / 60, time: 1 / 60, reducedMotion: false } as never, params as never);
  advanceNodeFrame(renderer as never);
  renderer.render(built.scene as never, built.camera as never);

  const levels = Math.floor(Math.log2(VD_TEXTURE_SIZE)) + 1;
  const layers: Record<string, number> = {
    [VD_TEXTURE_NAMES.walls]: VD_WALL_LAYERS.length, [VD_TEXTURE_NAMES.ground]: VD_GROUND_LAYERS.length, [VD_TEXTURE_NAMES.normals]: VD_NORMAL_LAYERS.length,
  };
  for (const [label, count] of Object.entries(layers)) {
    const t = record.textures.find((x) => x.label === label);
    assert.ok(t, `${label} uploaded`);
    assert.equal(t.mipLevelCount, levels, `${label}: ${t.mipLevelCount} mip levels`);
    assert.equal(t.layers, count, `${label} layers`);
  }
  assert.ok(
    record.samplers.some((s) => s.minFilter === 'linear' && s.magFilter === 'linear' && s.mipmapFilter === 'linear' && s.maxAnisotropy === 16 && s.addressModeU === 'repeat'),
    `a trilinear 16x repeat sampler: ${JSON.stringify(record.samplers.filter((s) => s.addressModeU === 'repeat'))}`,
  );
  built.dispose?.();
});
