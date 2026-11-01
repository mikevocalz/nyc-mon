// The lean material path (vd-leanmat.ts, EXPO_PUBLIC_WORLD_VD_LEANMAT):
// the vd lane's tree and city materials swap their bodies for unlit
// MeshBasicNodeMaterial while the fills, the instanced attributes and the
// draw consolidation stay put. buildTrees, buildVdTreeMeshes and
// createVdCityMaterials take `leanMat` as a param so both sides run in one
// process; the shipped default stays the env flag.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildTrees } from './foliage.ts';
import { buildCityWorld } from './index.ts';
import { createCityMaterials, TONE_ATTRIBUTE } from './materials.ts';
import { parseSkyRigFlag } from './sky-rig.ts';
import { VD_LEANMAT } from './vd-leanmat.ts';
import { createVdCityMaterials } from './vd-materials.ts';
import { buildVdTreeMeshes } from './vd-trees-mesh.ts';
import { VD_TREES } from './vd-trees.ts';
import { createStreetClearance } from './walkability.ts';

type Builder = {
  scene: unknown; camera: unknown; material: unknown; context: { material: unknown }; fogNode: unknown;
  build(): void; vertexShader?: string; fragmentShader?: string;
};
const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;

/** Same stub-renderer convention as vd-materials.test.ts: no GPU, just the node build. */
async function stubRenderer() {
  const canvas = { width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  (renderer as unknown as { backend: { utils: unknown } }).backend.utils = {
    getTextureSampleData: () => ({ samples: 1, primarySamples: 1, isMSAA: false }),
  };
  return renderer;
}

const dataset = () => parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));

const FOCUS = [-28, 22] as const;
const SUN_DIR = [0.5, 0.5, 0.7] as const;

type AnyMat = {
  isMeshBasicNodeMaterial?: boolean;
  isMeshStandardNodeMaterial?: boolean;
  lights?: boolean;
  colorNode?: unknown;
  normalNode?: unknown;
  emissiveNode?: unknown;
};
const mat = (m: { material: unknown } | unknown) => ((m as { material?: unknown }).material ?? m) as AnyMat;

const build = (leanMat: boolean) => {
  const ds = dataset();
  const materials = createCityMaterials(THREE as never, [0.5, 0.5, 0.7]);
  const trees = buildTrees(THREE as never, ds, materials, createStreetClearance(ds), true, false, leanMat);
  assert.ok(trees.update(FOCUS[0], FOCUS[1], 8), 'first refresh fills');
  return { materials, trees };
};

const one = (trees: ReturnType<typeof buildTrees>, name: string) =>
  trees.objects.find((o) => o.name === name) as THREE.InstancedMesh;

test('the flag parses like every world lane and stays off when unset', () => {
  assert.equal(VD_LEANMAT, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_VD_LEANMAT));
  assert.equal(VD_LEANMAT, false, 'unset in this environment');
});

test('lean bodies: every tree material is an unlit basic; default keeps the standard bodies', () => {
  const lit = buildVdTreeMeshes(THREE as never, 8, 8, 8, false);
  const lean = buildVdTreeMeshes(THREE as never, 8, 8, 8, true);
  assert.equal(lean.objects.length, lit.objects.length);
  assert.deepEqual(
    lean.objects.map((o) => o.name),
    lit.objects.map((o) => o.name),
  );
  for (const mesh of lit.objects) {
    assert.equal(mat(mesh).isMeshStandardNodeMaterial, true, `${mesh.name} stays standard`);
  }
  for (const mesh of lean.objects) {
    assert.equal(mat(mesh).isMeshBasicNodeMaterial, true, `${mesh.name} is basic`);
    assert.equal(mat(mesh).lights, false, `${mesh.name} skips the lighting context`);
  }
  // Cut-out and two-sided leaves carry over on the lean bodies.
  for (const s of lean.species) {
    assert.equal((s.leaf.material as THREE.Material).alphaTest, 0.5);
    assert.equal((s.leaf.material as THREE.Material).side, THREE.DoubleSide);
  }
  assert.equal((lean.farLeaf.material as THREE.Material).alphaTest, 0.5);
  // The species' far boxes are identical — same crown extents, same tiling.
  assert.deepEqual(lean.species.map((s) => s.far), lit.species.map((s) => s.far));
  lit.dispose();
  lean.dispose();
});

test('the shared far attributes survive the lean build', () => {
  const vd = buildVdTreeMeshes(THREE as never, 4, 8, 32, true);
  const layer = vd.farLeaf.geometry.getAttribute('aLayer');
  const rep = vd.farLeaf.geometry.getAttribute('aRep');
  assert.equal(layer, vd.farLayer);
  assert.equal(rep, vd.farRep);
  assert.equal(layer.itemSize, 1);
  assert.equal(rep.itemSize, 2);
  assert.equal(layer.count, 32);
  assert.equal(rep.count, 32);
  // The near leaf cards keep the per-card shade the lean graph still reads.
  for (const s of vd.species) {
    const shade = s.leaf.geometry.getAttribute('aShade');
    assert.ok(shade, `${s.leaf.name} keeps aShade`);
    assert.ok(shade.count > 0);
    assert.ok(s.leaf.geometry.getAttribute('uv'));
  }
  vd.dispose();
});

test('the fills are byte-identical between lean and default bodies', () => {
  const a = build(false);
  const b = build(true);
  // Same mesh set, same instance counts, same matrices, same attribute rows.
  assert.equal(b.trees.objects.length, a.trees.objects.length);
  for (const ma of a.trees.objects as THREE.InstancedMesh[]) {
    const mb = b.trees.objects.find((o) => o.name === ma.name) as THREE.InstancedMesh;
    assert.ok(mb, ma.name);
    assert.equal(mb.count, ma.count, `${ma.name} count`);
    assert.equal(mb.visible, ma.visible, `${ma.name} visible`);
    const n = ma.count * 16;
    assert.deepEqual(
      new Float32Array(mb.instanceMatrix.array.slice(0, n)),
      new Float32Array(ma.instanceMatrix.array.slice(0, n)),
      `${ma.name} matrices`,
    );
  }
  const fa = one(a.trees, 'city:trees-vd-far');
  const fb = one(b.trees, 'city:trees-vd-far');
  assert.ok(fa.count > 0, 'the Apollo focus has far imposters');
  const la = fa.geometry.getAttribute('aLayer');
  const lb = fb.geometry.getAttribute('aLayer');
  const ra = fa.geometry.getAttribute('aRep');
  const rb = fb.geometry.getAttribute('aRep');
  for (let k = 0; k < fa.count; k++) {
    assert.equal(lb.getX(k), la.getX(k), `aLayer[${k}]`);
    assert.equal(rb.getX(k), ra.getX(k), `aRep.x[${k}]`);
    assert.equal(rb.getY(k), ra.getY(k), `aRep.y[${k}]`);
  }
  // The over-tier crown pool keeps the per-instance tone attribute.
  for (const trees of [a.trees, b.trees]) {
    const far = one(trees, 'city:trees-far');
    assert.ok(far.geometry.getAttribute(TONE_ATTRIBUTE), 'instanceTone stays bound');
  }
  a.trees.dispose(); a.materials.dispose();
  b.trees.dispose(); b.materials.dispose();
});

test('lean city materials: the lit surfaces are unlit basics; the weather uniforms still move', () => {
  const lean = createVdCityMaterials(THREE as never, { sunDirection: SUN_DIR }, true);
  for (const key of ['masonry', 'glass', 'roofs', 'ground', 'areas', 'sidewalks', 'roads', 'trunks', 'poles', 'signBlades', 'cars'] as const) {
    assert.equal(mat(lean[key]).isMeshBasicNodeMaterial, true, `${key} is basic`);
    assert.equal(mat(lean[key]).lights, false, `${key} skips lighting`);
  }
  // The leaf/far-crown factories the tree fill calls are basic too.
  const texture = new THREE.Texture();
  const leafMat = lean.leaf(texture);
  const farMat = lean.farCrown();
  assert.equal(mat(leafMat).isMeshBasicNodeMaterial, true);
  assert.equal((leafMat as THREE.Material).alphaTest, 0.5);
  assert.equal(mat(farMat).isMeshBasicNodeMaterial, true);
  lean.weather.wet.value = 0.7;
  assert.equal(lean.weather.wet.value, 0.7);
  assert.equal(lean.weather.snow.value, 0);
  leafMat.dispose();
  farMat.dispose();
  texture.dispose();
  lean.dispose();
});

test('the default path is unchanged: standard bodies, heavy graphs, photo arrays', () => {
  const full = createVdCityMaterials(THREE as never, { sunDirection: SUN_DIR }, false);
  const masonry = mat(full.masonry);
  assert.equal(masonry.isMeshStandardNodeMaterial, true);
  assert.ok(masonry.colorNode, 'the facade graph still feeds colorNode');
  assert.ok(masonry.normalNode, 'the brick normal map still feeds normalNode');
  assert.ok(masonry.emissiveNode, 'lit rooms still feed emissiveNode');
  const sidewalks = mat(full.sidewalks);
  assert.equal(sidewalks.isMeshStandardNodeMaterial, true);
  assert.ok(sidewalks.colorNode);
  const leafMat = full.leaf(new THREE.Texture());
  assert.equal(mat(leafMat).isMeshStandardNodeMaterial, true);
  leafMat.dispose();
  full.dispose();
});

test('lean keeps the species count and every vd mesh it replaces', () => {
  const vd = buildVdTreeMeshes(THREE as never, 4, 8, 16, true);
  assert.equal(vd.species.length, VD_TREES.length);
  assert.equal(vd.objects.length, VD_TREES.length * 3 + 3);
  vd.dispose();
});

test('the lean graphs still compile to WGSL on a lean world', async () => {
  const renderer = await stubRenderer();
  const world = buildCityWorld(THREE as never, dataset(), { vd: true, leanMat: true });
  world.setViewDistance(8, 2000);
  world.setFocus(FOCUS[0], FOCUS[1]);
  const scene = new THREE.Scene();
  scene.add(world.sky, world.group);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  // A wall, a road, the far imposter pool and a near leaf — the draws the
  // lane swaps. The far leaf keeps its aLayer/aRep attribute reads.
  for (const name of ['city:walls-masonry', 'city:roads', 'city:sidewalks', 'city:trees-vd-far', `city:trees-vd-leaf-${VD_TREES[0]!.id}`, 'city:trees-vd-fartrunk']) {
    const mesh = world.group.getObjectByName(name) as THREE.Mesh;
    assert.ok(mesh, `${name} mesh`);
    const material = mesh.material as THREE.Material;
    assert.equal(mat(material).isMeshBasicNodeMaterial, true, `${name} body`);
    const b = new WGSLNodeBuilder(mesh, renderer);
    b.scene = scene; b.camera = camera; b.material = material; b.context.material = material;
    b.fogNode = null;
    b.build();
    const size = b.fragmentShader?.length ?? 0;
    assert.ok(size > 200 && size < 40_000, `${name}: ${size} chars`);
  }
  const far = world.group.getObjectByName('city:trees-vd-far') as THREE.Mesh;
  const b = new WGSLNodeBuilder(far, renderer);
  b.scene = scene; b.camera = camera; b.material = far.material; b.context.material = far.material;
  b.fogNode = null;
  b.build();
  assert.match(b.vertexShader ?? '', /aLayer/);
  world.dispose();
});
