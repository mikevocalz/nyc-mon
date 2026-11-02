// Lean-draw folds the far trunk/crown while near/mid retain species partitions.
// Both paths preserve the global tier selector and authored instance transforms.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { CURB_HEIGHT } from './curb.ts';
import { buildTrees, treePlacements } from './foliage.ts';
import { createCityMaterials } from './materials.ts';
import { parseSkyRigFlag } from './sky-rig.ts';
import { TreeLod } from './tree-lod.ts';
import { VD_LEANDRAW } from './vd-leandraw.ts';
import { VD_LEAN_NEAR_TREE_CAP } from './vd-lean.ts';
import { buildVdTreeMeshes, vdCensusTree, vdSpecies } from './vd-trees-mesh.ts';
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
  return { tiers, placements };
};

/** The species foliage.ts assigns each placement (recorded model, else the share hash). */
const expectedSpecies = (placements: ReturnType<typeof treePlacements>['trees']) =>
  placements.map((t, i) => {
    const recorded = t.census >= 0 ? vdCensusTree(t.census) : null;
    return recorded?.model ?? vdSpecies(Math.abs(Math.sin(i * 12.9898 + t.x * 0.37 + t.z * 0.11) * 43758.5453) % 1);
  });

const build = (ds: ReturnType<typeof dataset>, opts: { lean: boolean; leanDraw: boolean }) => {
  const materials = createCityMaterials(THREE as never, [0.5, 0.5, 0.7]);
  const trees = buildTrees(THREE as never, ds, materials, createStreetClearance(ds), true, opts.lean, false, opts.leanDraw);
  assert.ok(trees.update(FOCUS[0], FOCUS[1], 8), 'first refresh fills');
  return { materials, trees };
};

const named = (trees: ReturnType<typeof buildTrees>, prefix: string) =>
  trees.objects.filter((o) => o.name.startsWith(prefix)) as THREE.InstancedMesh[];
const one = (trees: ReturnType<typeof buildTrees>, name: string) =>
  trees.objects.find((o) => o.name === name) as THREE.InstancedMesh;

test('the flag parses like every world lane and stays off when unset', () => {
  assert.equal(VD_LEANDRAW, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_VD_LEANDRAW));
  assert.equal(VD_LEANDRAW, false, 'unset in this environment');
});

test('leandraw retains exact species geometry and disposes each geometry once', () => {
  const vd = buildVdTreeMeshes(THREE as never, 48, 160, 32, false, true);
  assert.ok(vd.merged);
  assert.equal(vd.objects.length, VD_TREES.length * 3 + 2);
  for (const [i, species] of vd.species.entries()) {
    for (const [mesh, source] of [[species.bark, VD_TREES[i]!.bark], [species.leaf, VD_TREES[i]!.leaf], [species.midLeaf, VD_TREES[i]!.mid]] as const) {
      assert.equal(mesh.geometry.index!.count, Buffer.from(source.index, 'base64').byteLength / 2);
      assert.ok(mesh.geometry.getAttribute('position').count > 0);
      assert.equal(mesh.geometry.getAttribute('aSpecies'), undefined, 'no collapsed foreign species');
      let disposals = 0;
      mesh.geometry.addEventListener('dispose', () => disposals++);
      mesh.geometry.userData.disposalCount = () => disposals;
    }
  }
  vd.dispose();
  for (const species of vd.species) for (const mesh of [species.bark, species.leaf, species.midLeaf]) assert.equal(mesh.geometry.userData.disposalCount(), 1);
});

test('the folded far mesh is one draw: trunk cross plus crown cross, box per instance', () => {
  const vd = buildVdTreeMeshes(THREE as never, 4, 8, 32, false, true);
  assert.ok(vd.merged);
  const pos = vd.farLeaf.geometry.getAttribute('position');
  assert.equal(pos.count, 16, '8 trunk verts + 8 crown verts');
  const solid = vd.farLeaf.geometry.getAttribute('aSolid');
  for (let i = 0; i < 16; i++) assert.equal(solid.getX(i), i < 8 ? 1 : 0, `aSolid[${i}]`);
  for (const [name, size] of [['aLayer', 1], ['aRep', 2], ['aCrown', 4], ['aBase', 1]] as const) {
    const a = vd.farLeaf.geometry.getAttribute(name);
    assert.ok(a, name);
    assert.equal(a.itemSize, size);
    assert.equal(a.count, 32, `${name} has one slot per far instance`);
  }
  assert.equal(vd.farLeaf.geometry.getAttribute('aLayer'), vd.farLayer);
  assert.equal(vd.farLeaf.geometry.getAttribute('aRep'), vd.farRep);
  assert.equal(vd.farLeaf.geometry.getAttribute('aCrown'), vd.merged.farCrown);
  assert.equal(vd.farLeaf.geometry.getAttribute('aBase'), vd.merged.farBase);
  // The separate far trunk mesh is built but never joins the scene.
  assert.equal(vd.farTrunk.name, 'city:trees-vd-fartrunk');
  assert.ok(!vd.objects.includes(vd.farTrunk));
  vd.dispose();
});

test('species partitions preserve global caps, exact matrix mapping and empty visibility', () => {
  const ds = dataset();
  const { tiers, placements } = expectedTiers(ds);
  const speciesOf = expectedSpecies(placements);
  const { materials, trees } = build(ds, { lean: false, leanDraw: true });
  for (const [prefix, selected, count, cap] of [
    ['city:trees-vd-bark-', tiers.near, tiers.nearCount, 48],
    ['city:trees-vd-leaf-', tiers.near, tiers.nearCount, 48],
    ['city:trees-vd-mid-', tiers.mid, tiers.midCount, 160],
  ] as const) {
    const meshes = named(trees, prefix);
    assert.equal(meshes.length, VD_TREES.length);
    assert.equal(meshes.reduce((n, mesh) => n + mesh.count, 0), count);
    assert.ok(count <= cap);
    for (const [sp, mesh] of meshes.entries()) {
      const expected = Array.from(selected.subarray(0, count)).filter(i => speciesOf[i] === sp);
      assert.equal(mesh.count, expected.length);
      assert.equal(mesh.visible, mesh.count > 0);
      for (const [row, i] of expected.entries()) {
        const matrix = mesh.instanceMatrix.array;
        assert.ok(Math.abs(matrix[row * 16 + 12]! - placements[i]!.x) < 1e-4);
        assert.ok(Math.abs(matrix[row * 16 + 14]! - placements[i]!.z) < 1e-4);
      }
    }
  }
  trees.update(100000, 100000, 8);
  for (const prefix of ['city:trees-vd-bark-', 'city:trees-vd-leaf-', 'city:trees-vd-mid-']) {
    for (const mesh of named(trees, prefix)) { assert.equal(mesh.count, 0); assert.equal(mesh.visible, false); }
  }
  trees.dispose(); materials.dispose();
});

test('leandraw far instances carry the species crown box and the plain tree matrix', () => {
  const ds = dataset();
  const { tiers, placements } = expectedTiers(ds);
  const speciesOf = expectedSpecies(placements);
  const { materials, trees } = build(ds, { lean: false, leanDraw: true });
  const far = one(trees, 'city:trees-vd-far');
  assert.ok(far.count > 0);
  // The far boxes are deterministic — rebuilt here for the comparison.
  const vd = buildVdTreeMeshes(THREE as never, 1, 1, 1, false, false);
  const boxes = vd.species.map((s) => s.far);
  const crown = far.geometry.getAttribute('aCrown');
  const base = far.geometry.getAttribute('aBase');
  const layer = far.geometry.getAttribute('aLayer');
  const rows = far.instanceMatrix.array as Float32Array;
  for (let k = 0; k < far.count; k++) {
    const i = tiers.far[k]!;
    const f = boxes[speciesOf[i]!]!;
    assert.equal(layer.getX(k), speciesOf[i]!, `aLayer[${k}]`);
    // The box crosses into f32 attribute storage — compare within rounding.
    assert.ok(Math.abs(crown.getX(k) - f.cx) < 1e-5, `aCrown.x[${k}]`);
    assert.ok(Math.abs(crown.getY(k) - f.cz) < 1e-5, `aCrown.y[${k}]`);
    assert.ok(Math.abs(crown.getZ(k) - f.hw) < 1e-5, `aCrown.z[${k}]`);
    assert.ok(Math.abs(crown.getW(k) - f.hh) < 1e-5, `aCrown.w[${k}]`);
    assert.ok(Math.abs(base.getX(k) - f.y0) < 1e-5, `aBase[${k}]`);
    // The matrix is the plain tree transform: translation at the placement,
    // y at curb height, homogeneous w = 1.
    const o = k * 16;
    assert.ok(Math.abs(rows[o + 12]! - placements[i]!.x) < 1e-4, `matrix tx[${k}]`);
    assert.ok(Math.abs(rows[o + 13]! - CURB_HEIGHT) < 1e-4, `matrix ty[${k}]`);
    assert.ok(Math.abs(rows[o + 14]! - placements[i]!.z) < 1e-4, `matrix tz[${k}]`);
    assert.equal(rows[o + 15], 1);
  }
  vd.dispose();
  trees.dispose();
  materials.dispose();
});

test('lean + leandraw: mid folds into the far pool, near retains species partitions', () => {
  const ds = dataset();
  const { tiers } = expectedTiers(ds, VD_LEAN_NEAR_TREE_CAP);
  assert.ok(tiers.midCount > 0, 'the Apollo focus has mid-tier candidates');
  const { materials, trees } = build(ds, { lean: true, leanDraw: true });
  const barks = named(trees, 'city:trees-vd-bark-');
  const mids = named(trees, 'city:trees-vd-mid-');
  const midTrunk = one(trees, 'city:trees-vd-midtrunk');
  const far = one(trees, 'city:trees-vd-far');
  const farTrunk = one(trees, 'city:trees-vd-fartrunk');
  assert.equal(barks.reduce((n, mesh) => n + mesh.count, 0), tiers.nearCount);
  for (const m of [...mids, midTrunk]) {
    assert.equal(m.count, 0, m.name);
    assert.equal(m.visible, false, m.name);
  }
  assert.equal(far.count, tiers.midCount + tiers.farCount);
  // The folded trunk mesh is gone from the scene entirely.
  assert.equal(farTrunk, undefined);
  trees.dispose();
  materials.dispose();
});

test('leandraw off: the per-species draws and the far split are unchanged', () => {
  const ds = dataset();
  const { tiers } = expectedTiers(ds);
  const { materials, trees } = build(ds, { lean: false, leanDraw: false });
  assert.equal(trees.objects.length, 3 + VD_TREES.length * 3 + 3);
  assert.equal(named(trees, 'city:trees-vd-bark-').length, VD_TREES.length);
  assert.equal(named(trees, 'city:trees-vd-leaf-').length, VD_TREES.length);
  assert.equal(named(trees, 'city:trees-vd-mid-').length, VD_TREES.length);
  const barks = named(trees, 'city:trees-vd-bark-');
  assert.equal(barks.reduce((n, m) => n + m.count, 0), tiers.nearCount);
  const farTrunk = one(trees, 'city:trees-vd-fartrunk');
  assert.equal(farTrunk.count, tiers.farCount);
  // No folded-far instanced attributes on the default geometry.
  const far = one(trees, 'city:trees-vd-far');
  assert.equal(far.geometry.getAttribute('aCrown'), undefined);
  assert.equal(far.geometry.getAttribute('aSolid'), undefined);
  assert.equal(far.geometry.getAttribute('position').count, 8);
  trees.dispose();
  materials.dispose();
});
