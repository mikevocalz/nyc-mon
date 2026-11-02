// The lean-draw path (vd-leandraw.ts, EXPO_PUBLIC_WORLD_VD_LEANDRAW): the
// near and mid vd tiers merge across species into one instanced draw each —
// per-vertex aSp marks the species, per-instance aSpecies keeps it — and
// the far trunk cross folds into the far leaf mesh (aCrown/aBase per
// instance, aSolid per vertex). buildTrees and buildVdTreeMeshes take
// `leanDraw` as a param so both sides run in one process; the shipped
// default stays the env flag.
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

test('leandraw merges every vd tier across species: five objects replace 21', () => {
  const vd = buildVdTreeMeshes(THREE as never, 8, 16, 32, false, true);
  assert.ok(vd.merged, 'the merged set exists under the flag');
  assert.equal(vd.objects.length, 5);
  assert.deepEqual(
    vd.objects.map((o) => o.name),
    ['city:trees-vd-bark-all', 'city:trees-vd-leaf-all', 'city:trees-vd-mid-all', 'city:trees-vd-midtrunk', 'city:trees-vd-far'],
  );
  // The species entries stay for their far boxes; their meshes never draw.
  assert.equal(vd.species.length, VD_TREES.length);
  const off = buildVdTreeMeshes(THREE as never, 8, 16, 32, false, false);
  assert.equal(off.merged, null, 'the default path builds no merged set');
  assert.equal(off.objects.length, VD_TREES.length * 3 + 3);
  vd.dispose();
  off.dispose();
});

test('the merged geometries carry every species, aSp and the instanced picks', () => {
  const vd = buildVdTreeMeshes(THREE as never, 8, 16, 32, false, true);
  assert.ok(vd.merged);
  // Vertex totals are the six parts concatenated.
  let barkVerts = 0;
  let leafVerts = 0;
  let midVerts = 0;
  for (const s of vd.species) {
    barkVerts += s.bark.geometry.getAttribute('position').count;
    leafVerts += s.leaf.geometry.getAttribute('position').count;
    midVerts += s.midLeaf.geometry.getAttribute('position').count;
  }
  assert.equal(vd.merged.bark.geometry.getAttribute('position').count, barkVerts);
  assert.equal(vd.merged.leaf.geometry.getAttribute('position').count, leafVerts);
  assert.equal(vd.merged.mid.geometry.getAttribute('position').count, midVerts);
  // aSp runs through the species in order and covers each part's vertex run.
  for (const [geometry, perSpecies] of [
    [vd.merged.bark.geometry, vd.species.map((s) => s.bark.geometry.getAttribute('position').count)],
    [vd.merged.leaf.geometry, vd.species.map((s) => s.leaf.geometry.getAttribute('position').count)],
    [vd.merged.mid.geometry, vd.species.map((s) => s.midLeaf.geometry.getAttribute('position').count)],
  ] as const) {
    const aSp = geometry.getAttribute('aSp');
    assert.equal(aSp.count, perSpecies.reduce((a, b) => a + b, 0));
    const ends = perSpecies.reduce<number[]>((acc, n) => [...acc, (acc.at(-1) ?? 0) + n], []);
    // Boundary verts: last vertex of each species run and the first of the next.
    for (const [s, end] of ends.entries()) {
      assert.equal(aSp.getX(end - 1), s, `aSp species ${s} last vertex`);
      if (s + 1 < ends.length) assert.equal(aSp.getX(end), s + 1, `aSp species ${s + 1} first vertex`);
    }
    // The instanced species pick rides beside it.
    const aSpecies = geometry.getAttribute('aSpecies');
    assert.ok(aSpecies, 'aSpecies bound');
    assert.equal(aSpecies.itemSize, 1);
  }
  // Bark keeps its species tint per vertex; leaves keep uv + shade and use
  // aSp as the atlas layer.
  assert.ok(vd.merged.bark.geometry.getAttribute('aTint'));
  assert.equal(vd.merged.bark.geometry.getAttribute('aTint').itemSize, 3);
  assert.ok(vd.merged.leaf.geometry.getAttribute('uv'));
  assert.ok(vd.merged.leaf.geometry.getAttribute('aShade'));
  assert.ok(vd.merged.mid.geometry.getAttribute('uv'));
  assert.ok(vd.merged.mid.geometry.getAttribute('aShade'));
  // The per-instance pick is sized to the tier capacity.
  assert.equal(vd.merged.barkSpecies.count, 8);
  assert.equal(vd.merged.leafSpecies.count, 8);
  assert.equal(vd.merged.midSpecies.count, 16);
  vd.dispose();
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

test('the fill packs all species into one near draw pair and one mid draw', () => {
  const ds = dataset();
  const { tiers, placements } = expectedTiers(ds);
  const speciesOf = expectedSpecies(placements);
  const { materials, trees } = build(ds, { lean: false, leanDraw: true });
  // Only the merged meshes and the shared mid/far pools show.
  assert.equal(trees.objects.length, 3 + 5);
  const barks = named(trees, 'city:trees-vd-bark-');
  const leaves = named(trees, 'city:trees-vd-leaf-');
  const mids = named(trees, 'city:trees-vd-mid-');
  assert.equal(barks.length, 1);
  assert.equal(leaves.length, 1);
  assert.equal(mids.length, 1);
  const bark = one(trees, 'city:trees-vd-bark-all');
  const leaf = one(trees, 'city:trees-vd-leaf-all');
  const mid = one(trees, 'city:trees-vd-mid-all');
  const midTrunk = one(trees, 'city:trees-vd-midtrunk');
  const far = one(trees, 'city:trees-vd-far');
  const farCrowns = one(trees, 'city:trees-far');
  assert.equal(bark.count, tiers.nearCount);
  assert.equal(leaf.count, tiers.nearCount);
  assert.equal(mid.count, tiers.midCount);
  assert.equal(midTrunk.count, tiers.midCount);
  assert.equal(far.count, tiers.farCount);
  assert.equal(farCrowns.count, tiers.overCount);
  // The species pick matches the tree's recorded/hashed species.
  const barkSp = bark.geometry.getAttribute('aSpecies');
  const leafSp = leaf.geometry.getAttribute('aSpecies');
  for (let k = 0; k < bark.count; k++) {
    const sp = speciesOf[tiers.near[k]!]!;
    assert.equal(barkSp.getX(k), sp, `aSpecies[${k}]`);
    assert.equal(leafSp.getX(k), sp, `aSpecies[${k}]`);
  }
  const midSp = mid.geometry.getAttribute('aSpecies');
  for (let k = 0; k < mid.count; k++) assert.equal(midSp.getX(k), speciesOf[tiers.mid[k]!], `mid aSpecies[${k}]`);
  trees.dispose();
  materials.dispose();
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

test('lean + leandraw: the mid folds into the folded far pool, near stays one draw pair', () => {
  const ds = dataset();
  const { tiers } = expectedTiers(ds, VD_LEAN_NEAR_TREE_CAP);
  assert.ok(tiers.midCount > 0, 'the Apollo focus has mid-tier candidates');
  const { materials, trees } = build(ds, { lean: true, leanDraw: true });
  const bark = one(trees, 'city:trees-vd-bark-all');
  const mid = one(trees, 'city:trees-vd-mid-all');
  const midTrunk = one(trees, 'city:trees-vd-midtrunk');
  const far = one(trees, 'city:trees-vd-far');
  const farTrunk = one(trees, 'city:trees-vd-fartrunk');
  assert.equal(bark.count, tiers.nearCount);
  for (const m of [mid, midTrunk]) {
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
