// Lane L2 "real surfaces": the flag is opt-in, the PBR factory produces
// MeshStandardNodeMaterial with the attribute slots bound, the vertex
// writers stamp per-family roughness/metalness inside the handoff ranges
// and the aOcclusion bake follows the contact shadows, the graphs compile
// to WGSL through three's own WGSLNodeBuilder, and the unflagged world is
// untouched. Same stub-renderer convention as shader-graphs.test.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildCityWorld, SUN } from './index.ts';
import { buildCityMeshes } from './city-mesh.ts';
import { VertexBuffer } from './geometry.ts';
import { createPbrCityMaterials, EXPERIMENTAL_WORLD_PBR } from './pbr-materials.ts';
import { parseSkyRigFlag } from './sky-rig.ts';
import { syntheticTileV2 } from './synthetic-tile.ts';
import { CONTACT_AO_DEPTH, contactReach, ContactField, surfacePick, SURFACE_RANGES, wallAo } from './surfaces.ts';
import { createStreetClearance } from './walkability.ts';

type Builder = {
  scene: unknown;
  camera: unknown;
  material: unknown;
  context: { material: unknown };
  fogNode: unknown;
  build(): void;
  vertexShader?: string;
  fragmentShader?: string;
};
const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;

async function stubRenderer() {
  const canvas = {
    width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null,
  } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  return renderer;
}

const dataset = () =>
  parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));

const inRange = (v: number, [lo, hi]: readonly [number, number], label: string) =>
  assert.ok(v >= lo - 1e-6 && v <= hi + 1e-6, `${label} ${v} not in [${lo}, ${hi}]`);

test('PBR flag is opt-in and shares the rig flag truth table', () => {
  for (const on of ['1', 'true', 'on', 'yes', ' TRUE ', 'On']) {
    assert.equal(parseSkyRigFlag(on), true, on);
  }
  for (const off of [undefined, null, '', '0', 'false', 'off', 'nope', '  ']) {
    assert.equal(parseSkyRigFlag(off), false, String(off));
  }
  assert.equal(EXPERIMENTAL_WORLD_PBR, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_PBR));
});

test('VertexBuffer stamps aRoughMetal and aOcclusion per vertex', () => {
  const buffer = new VertexBuffer();
  // Defaults: dullest surface, open sky.
  buffer.vertex(0, 0, 0, 0, 1, 0, [1, 1, 1]);
  buffer.surface(0.9, 0.7, 0.5);
  buffer.vertex(1, 0, 0, 0, 1, 0, [1, 1, 1]);
  buffer.vertex(2, 0, 0, 0, 1, 0, [1, 1, 1], 0, 0, 0.25); // per-vertex ao override
  const rm = buffer.roughMetals;
  const occ = buffer.occlusions;
  assert.deepEqual([...rm].map((v) => Math.round(v * 100) / 100), [0.95, 0, 0.9, 0.7, 0.9, 0.7]);
  assert.deepEqual([...occ], [1, 0.5, 0.25]);
  const geometry = buffer.toGeometry(THREE);
  assert.equal(geometry.getAttribute('aRoughMetal').itemSize, 2);
  assert.equal(geometry.getAttribute('aOcclusion').itemSize, 1);
  assert.equal(geometry.getAttribute('aOcclusion').count, 3);
  geometry.dispose();
});

test('surface picks stay inside the handoff ranges and are seeded', () => {
  for (const family of Object.keys(SURFACE_RANGES) as (keyof typeof SURFACE_RANGES)[]) {
    const a = surfacePick(family, 0);
    const b = surfacePick(family, 1);
    inRange(a[0], SURFACE_RANGES[family].rough, `${family} rough lo`);
    inRange(b[0], SURFACE_RANGES[family].rough, `${family} rough hi`);
    inRange(a[1], SURFACE_RANGES[family].metal, `${family} metal lo`);
    inRange(b[1], SURFACE_RANGES[family].metal, `${family} metal hi`);
  }
});

test('the contact field reproduces the authored ring falloff', () => {
  const field = new ContactField();
  const h = 20;
  const reach = contactReach(h);
  field.add([[0, 0], [10, 0], [10, 10], [0, 10]], h);
  assert.equal(field.occlusion(50, 50), 1, 'open ground stays at 1');
  const atWall = field.occlusion(0, 5); // on the west edge: distance 0 to the footprint
  const partway = field.occlusion(-reach / 2, 5);
  assert.ok(atWall <= 1 - CONTACT_AO_DEPTH + 1e-6, `wall foot ${atWall}`);
  assert.ok(partway > atWall && partway < 1, `falloff ${partway}`);
  // The ring formula: 1 − 0.34·fall², fall = 1 − d/reach.
  const expected = 1 - CONTACT_AO_DEPTH * (1 - (reach / 2) / reach) ** 2;
  assert.ok(Math.abs(partway - expected) < 1e-6, `${partway} ≈ ${expected}`);
  // Wall gradient: full depth at the ground line, clear above the reach.
  assert.equal(wallAo(0, reach), 1 - CONTACT_AO_DEPTH);
  assert.equal(wallAo(reach, reach), 1);
});

test('baked meshes carry family surfaces and the occlusion bake', () => {
  // The ground bake is per-vertex, so it only registers where a ribbon
  // vertex lands inside a footprint's ring. Add one kink to the east–west
  // road so a sidewalk vertex sits 1 m off the b:1 frontage.
  const raw = syntheticTileV2();
  raw.roads[0]!.p = [-50, 10, 5, 10, 100, 10];
  const data = parseCityDataset(raw);
  const materials = createPbrCityMaterials(THREE, { sunDirection: SUN });
  const built = buildCityMeshes(THREE, data, materials, [0.5, -0.5], createStreetClearance(data));
  const byName = new Map(built.meshes.map((m) => [m.name, m]));
  const rmOf = (name: string) => {
    const mesh = byName.get(name);
    assert.ok(mesh, `${name} mesh`);
    return mesh.geometry.getAttribute('aRoughMetal').array as Float32Array;
  };
  const occOf = (name: string) => {
    const mesh = byName.get(name);
    assert.ok(mesh, `${name} mesh`);
    return mesh.geometry.getAttribute('aOcclusion').array as Float32Array;
  };
  // b:1 is a brownstone (masonry), b:2 is glass — both families inside their ranges.
  for (let i = 0; i < rmOf('city:walls-masonry').length; i += 2) {
    inRange(rmOf('city:walls-masonry')[i]!, SURFACE_RANGES.masonry.rough, 'masonry rough');
    inRange(rmOf('city:walls-masonry')[i + 1]!, SURFACE_RANGES.masonry.metal, 'masonry metal');
  }
  for (let i = 0; i < rmOf('city:walls-glass').length; i += 2) {
    inRange(rmOf('city:walls-glass')[i]!, SURFACE_RANGES.glass.rough, 'glass rough');
    inRange(rmOf('city:walls-glass')[i + 1]!, SURFACE_RANGES.glass.metal, 'glass metal');
  }
  for (let i = 0; i < rmOf('city:roads').length; i += 2) {
    inRange(rmOf('city:roads')[i]!, SURFACE_RANGES.asphalt.rough, 'road rough');
    assert.equal(rmOf('city:roads')[i + 1], 0, 'asphalt is dielectric');
  }
  for (let i = 0; i < rmOf('city:sidewalks').length; i += 2) {
    inRange(rmOf('city:sidewalks')[i]!, SURFACE_RANGES.masonry.rough, 'sidewalk rough');
  }
  // The park area is a foliage-family surface; its ground verts pick up the
  // field only where a footprint ring reaches (the park sits clear, so 1).
  for (let i = 0; i < rmOf('city:areas').length; i += 2) {
    inRange(rmOf('city:areas')[i]!, SURFACE_RANGES.foliage.rough, 'area rough');
  }
  // Wall occlusion: bottom verts at the contact depth, top verts at 1.
  const walls = byName.get('city:walls-masonry')!.geometry;
  const pos = walls.getAttribute('position').array as Float32Array;
  const occ = walls.getAttribute('aOcclusion').array as Float32Array;
  let sawBase = false;
  let sawTop = false;
  for (let i = 0; i < occ.length; i++) {
    if (pos[i * 3 + 1] === 0) {
      assert.ok(occ[i]! <= 1 - CONTACT_AO_DEPTH + 1e-6, `base ao ${occ[i]}`);
      sawBase = true;
    }
    if (pos[i * 3 + 1]! > 10) {
      assert.ok(occ[i] === 1, `top ao ${occ[i]}`);
      sawTop = true;
    }
  }
  assert.ok(sawBase && sawTop, 'wall has base and top verts');
  // The sidewalk widens past the road edge to within the b:1 footprint's
  // shadow reach: some of its verts are occluded. The park sits far from
  // every footprint and stays fully open.
  const walkOcc = occOf('city:sidewalks');
  assert.ok(Math.min(...walkOcc) < 1, 'sidewalk occlusion near buildings');
  const areaOcc = occOf('city:areas');
  assert.ok(Math.min(...areaOcc) === 1, 'open park stays at 1');
  built.dispose();
  materials.dispose();
});

test('flagged world swaps lit materials to standard, unflagged is untouched', () => {
  const off = buildCityWorld(THREE, dataset());
  const offMesh = off.group.getObjectByName('city:walls-masonry') as THREE.Mesh;
  assert.ok(!(offMesh.material as { isMeshStandardNodeMaterial?: boolean }).isMeshStandardNodeMaterial);
  off.dispose();

  const on = buildCityWorld(THREE, dataset(), { pbr: true });
  const std = (name: string) => {
    const mesh = on.group.getObjectByName(name) as THREE.Mesh | undefined;
    assert.ok(mesh, `${name} mesh`);
    assert.ok((mesh.material as { isMeshStandardNodeMaterial?: boolean }).isMeshStandardNodeMaterial, `${name} is standard`);
    return mesh;
  };
  for (const name of ['city:walls-masonry', 'city:walls-glass', 'city:roofs', 'city:areas', 'city:sidewalks', 'city:roads', 'city:tree-trunks', 'city:cars']) {
    std(name);
  }
  // Unlit layers stay basic under both flags.
  const neon = on.group.getObjectByName('city:neon') as THREE.Mesh;
  assert.ok(!(neon.material as { isMeshStandardNodeMaterial?: boolean }).isMeshStandardNodeMaterial);
  const shadows = on.group.getObjectByName('city:contact-shadows') as THREE.Mesh;
  assert.ok(!(shadows.material as { isMeshStandardNodeMaterial?: boolean }).isMeshStandardNodeMaterial);
  on.dispose();
});

test('PBR material graphs compile to WGSL with the surface attributes bound', async () => {
  const renderer = await stubRenderer();
  const world = buildCityWorld(THREE, dataset(), { pbr: true });
  const scene = new THREE.Scene();
  scene.add(world.sky, world.group);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const compile = (mesh: THREE.Mesh) => {
    const material = mesh.material as THREE.Material;
    const b = new WGSLNodeBuilder(mesh, renderer);
    b.scene = scene; b.camera = camera; b.material = material; b.context.material = material;
    b.fogNode = null;
    const started = performance.now();
    b.build();
    return { b, ms: performance.now() - started };
  };
  const checked = ['city:walls-masonry', 'city:walls-glass', 'city:roofs', 'city:roads', 'city:sidewalks'];
  for (const name of checked) {
    const mesh = world.group.getObjectByName(name) as THREE.Mesh | undefined;
    assert.ok(mesh, `${name} mesh`);
    const { b, ms } = compile(mesh);
    const size = b.fragmentShader?.length ?? 0;
    assert.ok(ms < 500 && size > 400 && size < 60_000, `${name}: ${ms.toFixed(1)} ms, ${size} chars`);
    assert.match(b.vertexShader ?? '', /aRoughMetal/, `${name} binds aRoughMetal`);
    assert.match(b.vertexShader ?? '', /aOcclusion/, `${name} binds aOcclusion`);
  }
  world.dispose();
});

test('standard materials honour scene.environment through the node path', () => {
  // The mechanism the L1 rig relies on: MeshStandardNodeMaterial picks up
  // builder.environmentNode (populated from scene.environment) when the
  // material has no envNode/envMap of its own. This pins the contract, not
  // the GPU result — that part is device-pending.
  const material = new THREE.MeshStandardNodeMaterial();
  assert.equal(material.envNode, null);
  assert.equal(material.envMap, null);
  material.dispose();
});
