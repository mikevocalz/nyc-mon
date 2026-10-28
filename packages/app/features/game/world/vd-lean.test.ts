// The lean tree LOD (vd-lean.ts, EXPO_PUBLIC_WORLD_VD_LEAN): the mid tier
// writes through the shared far-imposter pool and the near cap halves, while
// the default path keeps today's fills. buildTrees takes `lean` as a param so
// both sides run in one process; the shipped default stays the env flag.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildTrees, treePlacements } from './foliage.ts';
import { createCityMaterials } from './materials.ts';
import { parseSkyRigFlag } from './sky-rig.ts';
import { TreeLod } from './tree-lod.ts';
import { VD_LEAN, VD_LEAN_NEAR_TREE_CAP } from './vd-lean.ts';
import { VD_NEAR_TREE_CAP } from './vd-trees-mesh.ts';
import { VdTreeTiers } from './vd-tree-tiers.ts';
import { VD_TREES } from './vd-trees.ts';
import { createStreetClearance } from './walkability.ts';

const dataset = () => parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));

const FOCUS = [-28, 22] as const;

/** The tier lists buildTrees' own refresh should produce, rebuilt from the same placements. */
const expectedTiers = (ds: ReturnType<typeof dataset>, nearCap?: number) => {
  const placements = treePlacements(ds).trees;
  const xs = Float32Array.from(placements.map((t) => t.x));
  const zs = Float32Array.from(placements.map((t) => t.z));
  const lod = new TreeLod(xs, zs);
  lod.update(FOCUS[0], FOCUS[1], 8);
  const tiers = new VdTreeTiers(xs, zs, nearCap === undefined ? {} : { nearCap });
  tiers.update(FOCUS[0], FOCUS[1], lod);
  return tiers;
};

const build = (ds: ReturnType<typeof dataset>, lean: boolean) => {
  const materials = createCityMaterials(THREE as never, [0.5, 0.5, 0.7]);
  const trees = buildTrees(THREE as never, ds, materials, createStreetClearance(ds), true, lean);
  assert.ok(trees.update(FOCUS[0], FOCUS[1], 8), 'first refresh fills');
  return { materials, trees };
};

const named = (trees: ReturnType<typeof buildTrees>, prefix: string) =>
  trees.objects.filter((o) => o.name.startsWith(prefix)) as THREE.InstancedMesh[];
const one = (trees: ReturnType<typeof buildTrees>, name: string) =>
  trees.objects.find((o) => o.name === name) as THREE.InstancedMesh;
const shown = (meshes: THREE.InstancedMesh[]) => meshes.reduce((n, m) => n + m.count, 0);

test('the flag parses like every world lane and stays off when unset', () => {
  assert.equal(VD_LEAN, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_VD_LEAN));
  assert.equal(VD_LEAN, false, 'unset in this environment');
  assert.equal(VD_LEAN_NEAR_TREE_CAP, 24);
  assert.equal(VD_LEAN_NEAR_TREE_CAP, VD_NEAR_TREE_CAP / 2);
});

test('lean off: the fills are unchanged tier counts — mid cards, merged trunk, far imposters', () => {
  const ds = dataset();
  const tiers = expectedTiers(ds);
  const { materials, trees } = build(ds, false);
  const barks = named(trees, 'city:trees-vd-bark-');
  const leaves = named(trees, 'city:trees-vd-leaf-');
  const midLeaves = named(trees, 'city:trees-vd-mid-');
  const midTrunk = one(trees, 'city:trees-vd-midtrunk');
  const farLeaf = one(trees, 'city:trees-vd-far');
  const farTrunk = one(trees, 'city:trees-vd-fartrunk');
  const farCrowns = one(trees, 'city:trees-far');
  assert.equal(shown(barks), tiers.nearCount);
  assert.equal(shown(leaves), tiers.nearCount);
  const midTotal = shown(midLeaves);
  assert.equal(midTotal, tiers.midCount);
  assert.equal(midTrunk.count, midTotal);
  assert.equal(farLeaf.count, tiers.farCount);
  assert.equal(farTrunk.count, tiers.farCount);
  // The `over` tail keeps the plain crowns.
  assert.equal(farCrowns.count, tiers.overCount);
  trees.dispose();
  materials.dispose();
});

test('lean on: mid candidates land in the imposter pool and the mid meshes stay at count 0', () => {
  const ds = dataset();
  const tiers = expectedTiers(ds, VD_LEAN_NEAR_TREE_CAP);
  assert.ok(tiers.midCount > 0, 'the Apollo focus has mid-tier candidates');
  const { materials, trees } = build(ds, true);
  const barks = named(trees, 'city:trees-vd-bark-');
  const midLeaves = named(trees, 'city:trees-vd-mid-');
  const midTrunk = one(trees, 'city:trees-vd-midtrunk');
  const farLeaf = one(trees, 'city:trees-vd-far');
  const farTrunk = one(trees, 'city:trees-vd-fartrunk');
  const farCrowns = one(trees, 'city:trees-far');
  // Near cap halves.
  assert.equal(shown(barks), VD_LEAN_NEAR_TREE_CAP);
  assert.equal(shown(barks), tiers.nearCount);
  // Mid and far share the one pool; the per-species meshes never draw.
  for (const m of [...midLeaves, midTrunk]) {
    assert.equal(m.count, 0, m.name);
    assert.equal(m.visible, false, m.name);
  }
  assert.equal(farLeaf.count, tiers.midCount + tiers.farCount);
  assert.equal(farTrunk.count, farLeaf.count);
  assert.equal(farCrowns.count, tiers.overCount);
  // Every pooled instance carries a valid atlas layer and card tiling.
  const layer = farLeaf.geometry.getAttribute('aLayer');
  const rep = farLeaf.geometry.getAttribute('aRep');
  const seen = new Set<number>();
  for (let k = 0; k < farLeaf.count; k++) {
    const l = layer.getX(k);
    assert.ok(l >= 0 && l < VD_TREES.length && l === Math.floor(l), `aLayer[${k}] = ${l}`);
    seen.add(l);
    assert.ok(rep.getX(k) >= 2 && rep.getY(k) >= 2, `aRep[${k}]`);
  }
  assert.ok(seen.size >= 2, `imposter pool spans ${seen.size} species`);
  // The mid-derived rows take the same crown-box transform: leaf origin one
  // scaled crown-base height above the trunk origin, X column = scale x hw.
  const leafRows = farLeaf.instanceMatrix.array as Float32Array;
  const trunkRows = farTrunk.instanceMatrix.array as Float32Array;
  for (let k = 0; k < Math.min(farLeaf.count, 64); k++) {
    const o = k * 16;
    const trunkH = Math.hypot(trunkRows[o + 4]!, trunkRows[o + 5]!, trunkRows[o + 6]!);
    assert.ok(trunkH > 0.5, `instance ${k} trunk height ${trunkH}`);
    assert.ok(Math.abs(leafRows[o + 13]! - trunkRows[o + 13]! - trunkH) < 1e-3, `instance ${k} crown-base offset`);
    const leafHw = Math.hypot(leafRows[o]!, leafRows[o + 1]!, leafRows[o + 2]!);
    const leafHh = Math.hypot(leafRows[o + 4]!, leafRows[o + 5]!, leafRows[o + 6]!);
    assert.ok(leafHw > 0.5 && leafHh > 0.5, `instance ${k} crown extents`);
  }
  trees.dispose();
  materials.dispose();
});
