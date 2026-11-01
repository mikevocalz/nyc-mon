// vd lane: the flag is on by default (EXPO_PUBLIC_WORLD_VD=0 kills it), the Valdrada STYLE/class → wall photo table
// matches its materials.js, the baked textures have the declared size, the
// walls carry aFacade, weather drives the uniforms and the precipitation
// visibility, and the textured graphs compile to WGSL. Same stub-renderer
// convention as pbr-materials.test.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { decodeBase64 } from './foliage.ts';
import { buildCityWorld } from './index.ts';
import { facadePhoto, VD_LAYER } from './vd-facades.ts';
import { EXPERIMENTAL_WORLD_VD, weatherFromEnv } from './vd-materials.ts';
import {
  VD_GROUND_LAYERS, VD_GROUND_RGB, VD_NORMAL_LAYERS, VD_NORMALS_XY, VD_TEXTURE_SIZE, VD_WALL_LAYERS, VD_WALL_MEANS, VD_WALLS_RGB,
} from './vd-textures.ts';

type Builder = {
  scene: unknown; camera: unknown; material: unknown; context: { material: unknown }; fogNode: unknown;
  build(): void; vertexShader?: string; fragmentShader?: string;
};
const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;

async function stubRenderer() {
  const canvas = { width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  // Texture nodes ask the backend for MSAA sample counts; node has no GPU, so answer single-sampled.
  (renderer as unknown as { backend: { utils: unknown } }).backend.utils = {
    getTextureSampleData: () => ({ samples: 1, primarySamples: 1, isMSAA: false }),
  };
  return renderer;
}
const dataset = () => parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));

test('vd flag is on by default and weather parses from its env value', () => {
  assert.equal(EXPERIMENTAL_WORLD_VD, process.env.EXPO_PUBLIC_WORLD_VD?.trim() !== '0');
  assert.deepEqual(weatherFromEnv(undefined), { rain: 0, snow: 0 });
  assert.deepEqual(weatherFromEnv(' Rain '), { rain: 1, snow: 0 });
  assert.deepEqual(weatherFromEnv('snow'), { rain: 0, snow: 1 });
  assert.deepEqual(weatherFromEnv('fog'), { rain: 0, snow: 0 });
});

test('wall photos follow Valdrada STYLE ids, the class table when there is none', () => {
  assert.deepEqual(facadePhoto({ class: 'plain', styleId: 0 }), [VD_LAYER.redBrick, 1 / 2.6]);
  assert.deepEqual(facadePhoto({ class: 'plain', styleId: 1 }), [VD_LAYER.brownBrick, 1 / 2.4]);
  assert.deepEqual(facadePhoto({ class: 'plain', styleId: 8 }), [VD_LAYER.stone, 1 / 3.4]);
  assert.deepEqual(facadePhoto({ class: 'brick', styleId: 3 }), [-1, 0], 'curtain wall takes no photo');
  assert.deepEqual(facadePhoto({ class: 'brownstone' }), [VD_LAYER.stone, 1 / 3.4]);
  assert.deepEqual(facadePhoto({ class: 'glass' }), [-1, 0]);
});

test('baked textures hold the declared layers at the declared size', () => {
  const px = VD_TEXTURE_SIZE * VD_TEXTURE_SIZE;
  assert.equal(decodeBase64(VD_WALLS_RGB).length, px * 3 * VD_WALL_LAYERS.length);
  assert.equal(decodeBase64(VD_GROUND_RGB).length, px * 3 * VD_GROUND_LAYERS.length);
  assert.equal(decodeBase64(VD_NORMALS_XY).length, px * 2 * VD_NORMAL_LAYERS.length);
  assert.equal(VD_WALL_MEANS.length, VD_WALL_LAYERS.length);
  for (const m of VD_WALL_MEANS) for (const ch of m) assert.ok(ch > 0.05 && ch < 0.95);
});

test('vd world: walls carry aFacade, weather moves the uniforms and the precipitation', () => {
  const world = buildCityWorld(THREE as never, dataset(), { vd: true });
  const walls = world.group.getObjectByName('city:walls-masonry') as THREE.Mesh;
  const fac = walls.geometry.getAttribute('aFacade');
  assert.equal(fac.itemSize, 2);
  let photo = 0;
  for (let i = 0; i < fac.count; i++) if (fac.getX(i) >= 0) photo++;
  assert.ok(photo / fac.count > 0.8, `${photo}/${fac.count} masonry vertices carry a wall photo`);
  const rain = world.group.getObjectByName('city:precipitation')!;
  assert.equal(rain.visible, false, 'clear sky draws no precipitation');
  world.setWeather(0.7, 0);
  assert.equal(world.weather!.wet.value, 0.7);
  assert.equal(rain.visible, true);
  world.setWeather(2, -1);
  assert.equal(world.weather!.wet.value, 1);
  assert.equal(world.weather!.snow.value, 0);
  world.dispose();
});

test('vd graphs compile to WGSL with the textures and aFacade bound', async () => {
  const renderer = await stubRenderer();
  const world = buildCityWorld(THREE as never, dataset(), { vd: true });
  world.setWeather(1, 0);
  const scene = new THREE.Scene();
  scene.add(world.sky, world.group);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  for (const name of ['city:walls-masonry', 'city:roofs', 'city:roads', 'city:sidewalks', 'city:precipitation']) {
    const mesh = world.group.getObjectByName(name) as THREE.Mesh;
    assert.ok(mesh, `${name} mesh`);
    const material = mesh.material as THREE.Material;
    const b = new WGSLNodeBuilder(mesh, renderer);
    b.scene = scene; b.camera = camera; b.material = material; b.context.material = material;
    b.fogNode = null;
    const started = performance.now();
    b.build();
    const ms = performance.now() - started;
    const size = b.fragmentShader?.length ?? 0;
    assert.ok(ms < 800 && size > 400 && size < 80_000, `${name}: ${ms.toFixed(1)} ms, ${size} chars`);
    if (name === 'city:walls-masonry') {
      assert.match(b.vertexShader ?? '', /aFacade/);
      assert.match(b.fragmentShader ?? '', /texture_2d_array/);
    }
  }
  world.dispose();
});
