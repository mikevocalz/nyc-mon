// The merged vd tree tiers: the six per-species mid trunks, far trunks and
// far cross-cards collapse to three shared InstancedMeshes (draw calls are
// the Duo's bottleneck). The shared geometries are unit-sized — the species'
// crown box rides the instance matrix, the atlas layer and card tiling ride
// the aLayer / aRep attributes that foliage.ts fills beside it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildCityWorld } from './index.ts';
import { buildVdTreeMeshes } from './vd-trees-mesh.ts';
import { VD_TREES } from './vd-trees.ts';

const dataset = () => parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));

test('the merged tiers draw once across all six species', () => {
  const vd = buildVdTreeMeshes(THREE as never, 48, 160, 2048);
  // Six species x near bark + near leaf + mid leaf, plus one mid trunk, one
  // far leaf and one far trunk: 21 meshes where per-species tiers made 36.
  assert.equal(vd.species.length, VD_TREES.length);
  assert.equal(vd.objects.length, VD_TREES.length * 3 + 3);
  // The merged meshes keep names the shadow-caster predicate
  // (index.ts: 'city:trees-vd-bark-'/'city:trees-vd-leaf-') does not match.
  for (const m of [vd.midTrunk, vd.farLeaf, vd.farTrunk]) {
    assert.ok(!m.name.startsWith('city:trees-vd-bark-'), m.name);
    assert.ok(!m.name.startsWith('city:trees-vd-leaf-'), m.name);
  }
  assert.equal(vd.midTrunk.name, 'city:trees-vd-midtrunk');
  assert.equal(vd.farLeaf.name, 'city:trees-vd-far');
  assert.equal(vd.farTrunk.name, 'city:trees-vd-fartrunk');
  vd.dispose();
});

test('the shared far geometries are unit-sized and carry the per-instance attributes', () => {
  const vd = buildVdTreeMeshes(THREE as never, 4, 8, 32);
  // Unit crown cross: x,z in -1..1, y in 0..1; the species' box is the matrix's.
  const pos = vd.farLeaf.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    assert.ok(pos.getX(i) >= -1 && pos.getX(i) <= 1);
    assert.ok(pos.getY(i) >= 0 && pos.getY(i) <= 1);
    assert.ok(pos.getZ(i) >= -1 && pos.getZ(i) <= 1);
  }
  const layer = vd.farLeaf.geometry.getAttribute('aLayer');
  const rep = vd.farLeaf.geometry.getAttribute('aRep');
  assert.equal(layer, vd.farLayer);
  assert.equal(rep, vd.farRep);
  assert.equal(layer.itemSize, 1);
  assert.equal(rep.itemSize, 2);
  assert.equal(layer.count, 32, 'one aLayer slot per far instance');
  assert.equal(rep.count, 32);
  // Unit trunk cross tops out at y=1: the instance matrix's Y column scales it.
  const trunkPos = vd.farTrunk.geometry.getAttribute('position');
  for (let i = 0; i < trunkPos.count; i++) assert.ok(trunkPos.getY(i) === 0 || trunkPos.getY(i) === 1);
  // Every species carries the crown box, atlas layer and tiling the fill needs.
  for (const [s, sp] of vd.species.entries()) {
    assert.equal(sp.far.layer, s);
    assert.ok(sp.far.hw > 0 && sp.far.hh > 0 && sp.far.y0 > 0, `species ${s} crown box`);
    assert.ok(sp.far.repU >= 2 && sp.far.repV >= 2, `species ${s} tiling`);
  }
  vd.dispose();
});

test('the fill packs all species into the merged buffers and keeps the per-species transforms', () => {
  const world = buildCityWorld(THREE as never, dataset(), { vd: true });
  world.setViewDistance(8, 2000);
  world.setFocus(-28, 22);
  const midTrunk = world.group.getObjectByName('city:trees-vd-midtrunk') as THREE.InstancedMesh;
  const farLeaf = world.group.getObjectByName('city:trees-vd-far') as THREE.InstancedMesh;
  const farTrunk = world.group.getObjectByName('city:trees-vd-fartrunk') as THREE.InstancedMesh;
  const midLeaves = world.group.children.filter((o) => o.name.startsWith('city:trees-vd-mid-')) as THREE.InstancedMesh[];
  assert.equal(midLeaves.length, VD_TREES.length);
  // The merged mid trunk received every species' mid instances.
  const midTotal = midLeaves.reduce((n, m) => n + m.count, 0);
  assert.ok(midTotal > 0);
  assert.equal(midTrunk.count, midTotal);
  // The merged far leaf and trunk share the far count.
  assert.ok(farLeaf.count > 0);
  assert.equal(farTrunk.count, farLeaf.count);
  // aLayer is per instance: more than one species' layer lands in one buffer,
  // each a valid atlas depth; aRep keeps the species' card tiling.
  const layer = farLeaf.geometry.getAttribute('aLayer');
  const rep = farLeaf.geometry.getAttribute('aRep');
  const seen = new Set<number>();
  for (let k = 0; k < farLeaf.count; k++) {
    const l = layer.getX(k);
    assert.ok(l >= 0 && l < VD_TREES.length && l === Math.floor(l), `aLayer[${k}] = ${l}`);
    seen.add(l);
    assert.ok(rep.getX(k) >= 2 && rep.getY(k) >= 2, `aRep[${k}]`);
  }
  assert.ok(seen.size >= 2, `far instances span ${seen.size} species`);
  // The leaf matrix carries the crown box: with rotation about Y only, the
  // leaf origin sits the trunk's scaled crown-base height above the trunk
  // origin, and the leaf's X column is the tree scale x the half width.
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
  world.dispose();
});
