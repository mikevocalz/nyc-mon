// Street and park trees: instanced leaf crowns near the Caller, plain crowns
// farther out, nothing beyond (tree-lod.ts picks the sets). Ported from vg-demos-all
// src/demos/metro-live/world/foliage.ts (MIT; notice in geometry.ts and
// docs/implementation/city-world.md): base64 decode, the leaf-card crown
// (one core and 10 cards here instead of two cores and 30, so 7 500
// trees stay near 450k triangles on a phone) and the `leaf`
// attribute convention (0 on the solid core, > 0 on cut-out cards). The leaf
// alpha comes from the CC0 Quaternius nature pack, baked into
// world/leaf-alpha.ts by tooling/city/bake-foliage.mjs.
import type { Three } from '@acme/ui/three';
import { CURB_HEIGHT, VD_LANE } from './curb.ts';
import type { BufferGeometry } from 'three/webgpu';
import type { CityDatasetV3 } from '../city-dataset.ts';
import { LEAF_ALPHA as LEAF } from './leaf-alpha.ts';
import { decodeBase64 } from './foliage-decode.ts';
import { mulberry32 } from './geometry.ts';
import { NEAR_TREE_CAP, TreeLod } from './tree-lod.ts';
import { buildVdTreeMeshes, VD_MID_TREE_CAP, VD_NEAR_TREE_CAP, VD_TREE_SCALE, vdCensusTree, vdSpecies } from './vd-trees-mesh.ts';
import { createStreetClearance, type StreetClearance } from './walkability.ts';
import { linearColor, TONE_ATTRIBUTE, type CityMaterials } from './materials.ts';

type Geometry = BufferGeometry;

export { decodeBase64 } from './foliage-decode.ts';

/** Metres: the crown is about 6 m across with its centre 3.8 m up, a NYC street tree. */
const CROWN_SCALE = 2.6;

function leafTexture(THREE: Three) {
  const alpha = decodeBase64(LEAF.alpha);
  const rgba = new Uint8Array(LEAF.width * LEAF.height * 4);
  for (let i = 0; i < alpha.length; i++) rgba.fill(alpha[i]!, i * 4, i * 4 + 4);
  const texture = new THREE.DataTexture(rgba, LEAF.width, LEAF.height, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** The solid core: non-indexed, a zero uv (cards use the texture) and leaf = 0. */
function solidPart(THREE: Three, geometry: Geometry): Geometry {
  const out = geometry.index ? geometry.toNonIndexed() : geometry;
  if (out !== geometry) geometry.dispose();
  const count = out.getAttribute('position').count;
  out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  out.setAttribute('leaf', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  return out;
}

/** A leaf crown: a lumpy core wrapped in cut-out leaf cards facing every way (metro-live leafCrownGeometry). */
export function leafCrownGeometry(THREE: Three, cards = 10): Geometry {
  const rand = mulberry32(7);
  const centre = new THREE.Vector3(0, 1.45, 0);
  const cores = ([[0, 1.5, 0, 0.9]] as const).map(([x, y, z, r]) =>
    solidPart(THREE, new THREE.IcosahedronGeometry(r, 0).translate(x, y, z)));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const leaf: number[] = [];
  const dir = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const n = new THREE.Vector3();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < cards; i++) {
    // Fibonacci sphere, denser on top where the camera looks from.
    const y = 1 - ((i + 0.5) / cards) * 1.6;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    dir.set(Math.cos(i * golden) * r, y, Math.sin(i * golden) * r);
    const reach = 0.78 + rand() * 0.2;
    const c = centre.clone().add(new THREE.Vector3(dir.x * reach, dir.y * reach * 0.88 + 0.08, dir.z * reach));
    facing.copy(dir).add(new THREE.Vector3(rand() - 0.5, rand() - 0.5 + 0.3, rand() - 0.5).multiplyScalar(1.3)).normalize();
    u.set(0, 1, 0).cross(facing);
    if (u.lengthSq() < 1e-3) u.set(1, 0, 0);
    u.normalize().applyAxisAngle(facing, rand() * Math.PI * 2);
    v.crossVectors(facing, u).normalize();
    const half = 0.62 + rand() * 0.16;
    const shade = 0.9 + rand() * 0.22;
    const quad = [[-1, -1, 0, 1], [1, -1, 1, 1], [1, 1, 1, 0], [-1, 1, 0, 0]] as const;
    const corners = quad.map(([a, b, cu, cv]) => {
      corner.copy(c).addScaledVector(u, a * half).addScaledVector(v, b * half);
      n.copy(corner).sub(centre).normalize();
      return { p: corner.clone(), n: n.clone(), uv: [cu, cv] as const };
    });
    // Front and back faces, both with the outward crown normal.
    for (const order of [[0, 1, 2, 0, 2, 3], [0, 2, 1, 0, 3, 2]]) {
      for (const k of order) {
        const q = corners[k]!;
        positions.push(q.p.x, q.p.y, q.p.z);
        normals.push(q.n.x, q.n.y, q.n.z);
        uvs.push(q.uv[0], q.uv[1]);
        leaf.push(shade);
      }
    }
  }
  const parts = [...cores];
  const cardGeometry: Geometry = new THREE.BufferGeometry();
  cardGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  cardGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  cardGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cardGeometry.setAttribute('leaf', new THREE.Float32BufferAttribute(leaf, 1));
  parts.push(cardGeometry);
  const merged: Geometry = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['leaf', 1]] as const) {
    const arrays = parts.map((g) => (g.getAttribute(name) as InstanceType<Three['BufferAttribute']>).array as Float32Array);
    const out = new Float32Array(arrays.reduce((sum, a) => sum + a.length, 0));
    let o = 0;
    for (const a of arrays) { out.set(a, o); o += a.length; }
    merged.setAttribute(name, new THREE.Float32BufferAttribute(out, size));
  }
  for (const part of parts) part.dispose();
  merged.scale(CROWN_SCALE, CROWN_SCALE, CROWN_SCALE);
  merged.computeBoundingSphere();
  return merged;
}

/** Horizontal reach of a crown at scale 1 at trunk height (2.8 m), metres: the core plus the inner leaf cards. */
export const CROWN_REACH = 2.6;
/** A crown may reach this far over the carriageway edge at trunk height. */
export const MAX_OVERHANG = 1.5;
/** Crowns that would have to shrink below this scale to clear the road are dropped instead. */
export const MIN_TREE_SCALE = 0.6;
/** A record tree in a carriageway moves to the sidewalk only if the band is this close. */
export const TREE_MAX_MOVE = 3;

export interface TreePlacement { x: number; z: number; scale: number; tone: number; record: boolean; /** Index into trees.census, -1 for generated fill. */ census: number }
export interface TreeReport { recordMoved: number; recordDropped: number; fillDropped: number; shrunk: number; overhangDropped: number }

/**
 * Where trees stand: record trees first (the census list), then the
 * generated fill, each kept out of the street (walkability.ts
 * `createStreetClearance`, the road mesh's widths plus the kerb margin). A
 * record tree inside a carriageway or crossing moves to the nearest
 * sidewalk-band point within 3 m, else it is dropped; a generated tree
 * there is dropped. A crown reaching more than 1.5 m over the carriageway
 * edge shrinks, or drops below scale 0.6.
 */
export function treePlacements(dataset: CityDatasetV3, clearance: StreetClearance = createStreetClearance(dataset)): { trees: TreePlacement[]; report: TreeReport } {
  const rand = mulberry32(1931);
  const trees: TreePlacement[] = [];
  const report: TreeReport = { recordMoved: 0, recordDropped: 0, fillDropped: 0, shrunk: 0, overhangDropped: 0 };
  const push = (list: readonly number[], record: boolean) => {
    for (let i = 0; i + 1 < list.length; i += 2) {
      // vd lane: Valdrada plants only recorded trees along streets; generated fill stays only off the street (parks, lots).
      if (!record && VD_LANE && clearance.kerbGap(list[i]!, list[i + 1]!) < 8) { rand(); rand(); continue; }
      // Draw the random numbers first so a dropped tree does not reshuffle its neighbours.
      let scale = record ? 1 + rand() * 0.3 : 0.8 + rand() * 0.45;
      const tone = rand();
      let x = list[i]!;
      let z = list[i + 1]!;
      if (!clearance.standable(x, z)) {
        const moved = record ? clearance.toSidewalk(x, z, TREE_MAX_MOVE) : null;
        if (!moved) { if (record) report.recordDropped++; else report.fillDropped++; continue; }
        [x, z] = moved;
        report.recordMoved++;
      }
      const room = clearance.kerbGap(x, z) + MAX_OVERHANG;
      if (CROWN_REACH * scale > room) {
        const fit = room / CROWN_REACH;
        if (fit < MIN_TREE_SCALE) { report.overhangDropped++; continue; }
        scale = fit;
        report.shrunk++;
      }
      trees.push({ x, z, scale, tone, record, census: record ? i / 2 : -1 });
    }
  };
  push(dataset.trees.census, true);
  push(dataset.trees.fill, false);
  return { trees, report };
}

export { TREE_HIDE_METRES, TREE_NEAR_LOD_METRES } from './tree-lod.ts';

/**
 * Trees as three instanced meshes whose instance lists follow the Caller:
 * leaf crowns and trunks within NEAR_TREE_RADIUS (capped), plain far crowns
 * out to the far radius, nothing beyond. Each tree's matrix and tone are
 * computed once into source arrays; a refresh copies rows into the
 * preallocated instance buffers and sets `count`, so walking allocates
 * nothing and React never re-renders.
 */
export function buildTrees(
  THREE: Three, dataset: CityDatasetV3, materials: Pick<CityMaterials, 'leaf' | 'farCrown' | 'trunks'>,
  clearance: StreetClearance = createStreetClearance(dataset),
  /** vd lane: near trees are Valdrada's modelled street trees (vd-trees-mesh.ts) instead of leaf-card crowns. */
  modelTrees = false,
) {
  const { trees: placements, report } = treePlacements(dataset, clearance);
  const count = Math.max(1, placements.length);
  const texture = leafTexture(THREE);
  const crownGeometry = leafCrownGeometry(THREE);
  // vd lane: the far ball takes the model trees' crown (about 7 m across, 2.8-8.8 m up) so the mid-level swap holds its shape.
  const farGeometry = modelTrees
    ? new THREE.IcosahedronGeometry(1, 1).scale(3.5 * VD_TREE_SCALE / 0.7, 3.0 * VD_TREE_SCALE / 0.7, 3.5 * VD_TREE_SCALE / 0.7).translate(0, 5.8 * VD_TREE_SCALE / 0.7, 0)
    : new THREE.IcosahedronGeometry(1.15 * CROWN_SCALE, 0).translate(0, 1.5 * CROWN_SCALE, 0);
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.24, 2.8, 6).translate(0, 1.4, 0);
  // The materials object owns which lighting body the crowns run (cel or the flagged PBR lane).
  const leafMaterial = materials.leaf(texture);
  const farMaterial = materials.farCrown();
  // Shared with the city materials, which dispose it.
  const trunkMaterial = materials.trunks;
  const nearCapacity = Math.min(count, NEAR_TREE_CAP);
  const near = new THREE.InstancedMesh(crownGeometry, leafMaterial, nearCapacity);
  const far = new THREE.InstancedMesh(farGeometry, farMaterial, count);
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, nearCapacity);
  near.name = 'city:trees-near';
  far.name = 'city:trees-far';
  trunks.name = 'city:tree-trunks';
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const light = linearColor(THREE, 'leafLight');
  const dark = linearColor(THREE, 'leafDark');
  const tone = new THREE.Color();
  // Source rows, one per tree, built once.
  const sourceMatrices = new Float32Array(count * 16);
  const sourceTones = new Float32Array(count * 3);
  const xs = new Float32Array(placements.length);
  const zs = new Float32Array(placements.length);
  placements.forEach((tree, i) => {
    rotation.setFromAxisAngle(up, tree.tone * Math.PI * 2);
    position.set(tree.x, CURB_HEIGHT, tree.z);
    scale.setScalar(tree.scale);
    matrix.compose(position, rotation, scale);
    matrix.toArray(sourceMatrices, i * 16);
    tone.copy(dark).lerp(light, tree.tone);
    sourceTones[i * 3] = tone.r; sourceTones[i * 3 + 1] = tone.g; sourceTones[i * 3 + 2] = tone.b;
    xs[i] = tree.x;
    zs[i] = tree.z;
  });
  // vd lane: one species per tree and its own matrix at the model's scale.
  const vd = modelTrees ? buildVdTreeMeshes(THREE, Math.min(count, VD_NEAR_TREE_CAP), Math.min(count, VD_MID_TREE_CAP)) : null;
  const vdOrder = new Int32Array(count);
  const vdD2 = new Float32Array(count);
  const vdTake = new Int32Array(count);
  const vdSpeciesOf = new Uint8Array(placements.length);
  const vdMatrices = vd ? new Float32Array(placements.length * 16) : null;
  if (vd && vdMatrices) {
    placements.forEach((tree, i) => {
      // A census tree is its recorded species at its trunk's size; park fill picks by hash.
      const recorded = tree.census >= 0 ? vdCensusTree(tree.census) : null;
      vdSpeciesOf[i] = recorded?.model ?? vdSpecies(Math.abs(Math.sin(i * 12.9898 + tree.x * 0.37 + tree.z * 0.11) * 43758.5453) % 1);
      rotation.setFromAxisAngle(up, tree.tone * Math.PI * 2);
      const size = recorded ? Math.min(tree.scale, recorded.scale) : tree.scale * VD_TREE_SCALE;
      matrix.compose(position.set(tree.x, CURB_HEIGHT, tree.z), rotation, scale.setScalar(size));
      matrix.toArray(vdMatrices, i * 16);
    });
  }
  // The cel albedo reads the tone before lighting, so each crown mesh keeps its own tone list.
  const nearTones = new THREE.InstancedBufferAttribute(new Float32Array(nearCapacity * 3), 3);
  const farTones = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  crownGeometry.setAttribute(TONE_ATTRIBUTE, nearTones);
  farGeometry.setAttribute(TONE_ATTRIBUTE, farTones);
  for (const mesh of [near, far, trunks]) {
    mesh.count = 0;
    // The lists change as the Caller walks; one bounding volume for the tile would never cull.
    mesh.frustumCulled = false;
  }
  const lod = new TreeLod(xs, zs);
  const copy = (ids: Int32Array, n: number, targets: InstanceType<Three['InstancedMesh']>[], tones: InstanceType<Three['InstancedBufferAttribute']>) => {
    const toneArray = tones.array as Float32Array;
    for (let k = 0; k < n; k++) {
      const i = ids[k]!;
      const row = sourceMatrices.subarray(i * 16, i * 16 + 16);
      for (const mesh of targets) (mesh.instanceMatrix.array as Float32Array).set(row, k * 16);
      toneArray[k * 3] = sourceTones[i * 3]!;
      toneArray[k * 3 + 1] = sourceTones[i * 3 + 1]!;
      toneArray[k * 3 + 2] = sourceTones[i * 3 + 2]!;
    }
    for (const mesh of targets) {
      mesh.count = n;
      mesh.instanceMatrix.clearUpdateRanges();
      if (n > 0) mesh.instanceMatrix.addUpdateRange(0, n * 16);
      mesh.instanceMatrix.needsUpdate = true;
    }
    tones.clearUpdateRanges();
    if (n > 0) tones.addUpdateRange(0, n * 3);
    tones.needsUpdate = true;
  };
  return {
    objects: vd ? [near, far, trunks, ...vd.objects] : [near, far, trunks],
    count: placements.length,
    /** How many trees the street clearance moved, shrank or dropped. */
    report,
    lod,
    /** Refresh the instance lists around the focus; cheap to call every frame. */
    update(x: number, z: number, cameraDistance: number) {
      if (placements.length === 0 || !lod.update(x, z, cameraDistance)) return false;
      if (vd && vdMatrices) {
        // Near and far sets together, nearest first: the closest VD_NEAR_TREE_CAP draw as
        // full models, the next VD_MID_TREE_CAP as the thinned mid level, the rest as the
        // far crowns. One sort per refresh (every ~10 m of travel), no allocation.
        let n = 0;
        for (let k = 0; k < lod.nearCount; k++) vdOrder[n++] = lod.near[k]!;
        for (let k = 0; k < lod.farCount; k++) vdOrder[n++] = lod.far[k]!;
        for (let k = 0; k < n; k++) { const i = vdOrder[k]!; vdD2[i] = (xs[i]! - x) ** 2 + (zs[i]! - z) ** 2; }
        vdOrder.subarray(0, n).sort((a, b) => vdD2[a]! - vdD2[b]!);
        for (const s of vd.species) { s.count = 0; s.midCount = 0; }
        const full = Math.min(n, VD_NEAR_TREE_CAP);
        const mid = Math.min(n - full, VD_MID_TREE_CAP);
        for (let k = 0; k < full + mid; k++) {
          const i = vdOrder[k]!;
          const s = vd.species[vdSpeciesOf[i]!]!;
          const row = vdMatrices.subarray(i * 16, i * 16 + 16);
          if (k < full) {
            const slot = s.count++;
            (s.bark.instanceMatrix.array as Float32Array).set(row, slot * 16);
            (s.leaf.instanceMatrix.array as Float32Array).set(row, slot * 16);
          } else {
            const slot = s.midCount++;
            (s.midLeaf.instanceMatrix.array as Float32Array).set(row, slot * 16);
            (s.midTrunk.instanceMatrix.array as Float32Array).set(row, slot * 16);
          }
        }
        for (const s of vd.species) {
          for (const [mesh, c] of [[s.bark, s.count], [s.leaf, s.count], [s.midLeaf, s.midCount], [s.midTrunk, s.midCount]] as const) {
            mesh.count = c;
            mesh.visible = c > 0;
            mesh.instanceMatrix.clearUpdateRanges();
            if (c > 0) mesh.instanceMatrix.addUpdateRange(0, c * 16);
            mesh.instanceMatrix.needsUpdate = true;
          }
        }
        // The card crowns step aside on this lane; the far balls take what is left.
        copy(vdTake, 0, [near, trunks], nearTones);
        const rest = n - full - mid;
        for (let k = 0; k < rest; k++) vdTake[k] = vdOrder[full + mid + k]!;
        copy(vdTake, rest, [far], farTones);
        near.visible = trunks.visible = false;
        far.visible = rest > 0;
        return true;
      } else {
        copy(lod.near, lod.nearCount, [near, trunks], nearTones);
      }
      copy(lod.far, lod.farCount, [far], farTones);
      near.visible = trunks.visible = lod.nearCount > 0;
      far.visible = lod.farCount > 0;
      return true;
    },
    dispose() {
      for (const g of [crownGeometry, farGeometry, trunkGeometry]) g.dispose();
      for (const m of [leafMaterial, farMaterial]) m.dispose();
      texture.dispose();
      for (const mesh of [near, far, trunks]) mesh.dispose();
      vd?.dispose();
    },
  };
}
