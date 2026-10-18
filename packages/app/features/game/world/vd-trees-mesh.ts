// The vd lane's near street trees: Valdrada's London plane, honeylocust and
// pin oak (vd-trees.ts, baked by tooling/city/bake-trees.mjs) as one bark and
// one leaf InstancedMesh per species. foliage.ts hands each tree a species and
// fills these from the same near list the cel crowns use.
import type { Three } from '@acme/ui/three';
import { decodeBase64 } from './foliage-decode.ts';
import { VD_TREE_ATLAS_RGBA, VD_TREE_ATLAS_SIZE, VD_TREES } from './vd-trees.ts';
import { VD_CENSUS_DBH, VD_CENSUS_SPECIES } from './vd-tree-species.ts';

/** Species share for unrecorded (park fill) trees, in VD_TREES order: plane, honeylocust, oak, pear, linden, zelkova. */
export const VD_TREE_SHARE = [0.3, 0.2, 0.15, 0.1, 0.15, 0.1] as const;

/**
 * Census species id (Valdrada compile.mjs: 1 plane, 2 honeylocust, 3 pear, 4 ginkgo, 5 oak,
 * 6 linden, 7 maple, 8 cherry, 9 sophora, 10 zelkova, 11 ash, 12 elm, 0 unknown) to the
 * nearest baked model: plane 0, honeylocust 1, oak 2, pear 3, linden 4, zelkova 5.
 * Sophora and ash take the honeylocust's fine compound leaf, ginkgo and elm the
 * zelkova's upright vase, maple the linden, cherry the pear.
 */
const MODEL_FOR_SPECIES = [0, 0, 1, 3, 5, 2, 4, 4, 3, 1, 5, 1, 5] as const;
let censusSpecies: Uint8Array | null = null;
let censusDbh: Uint8Array | null = null;
/** The recorded model and size of census tree `i`: scale grows with trunk diameter, a 16 in trunk is about full size. */
export function vdCensusTree(i: number): { model: number; scale: number } {
  censusSpecies ??= decodeBase64(VD_CENSUS_SPECIES);
  censusDbh ??= decodeBase64(VD_CENSUS_DBH);
  const sp = censusSpecies[i] ?? 0;
  const dbh = censusDbh[i] || 8;
  return { model: MODEL_FOR_SPECIES[sp] ?? 0, scale: Math.max(0.45, Math.min(1.1, 0.4 + dbh * 0.033)) };
}
/** Model metres to scene: the baked trees stand 10-12.6 m; Harlem's street trees read nearer 7-9 m. */
export const VD_TREE_SCALE = 0.7;
/** Near cap for the model trees (about 5k triangles each). Duo measured (2026-10-18, release): 90 full + 330 mid put ~2.0M triangles through the shadow pass for a p50 of 62 ms; halving the caps keeps the street lined with models inside ~40 m. */
export const VD_NEAR_TREE_CAP = 48;
/** Mid-level trees past the near set (a twelfth of the cards on a plain trunk, about 900 triangles). Duo-tuned with the near cap. */
export const VD_MID_TREE_CAP = 160;

/** Species index for tree `i` from a 0..1 hash: deterministic, weighted by VD_TREE_SHARE. */
export function vdSpecies(h: number): number {
  let acc = 0;
  for (let s = 0; s < VD_TREE_SHARE.length; s++) {
    acc += VD_TREE_SHARE[s]!;
    if (h < acc) return s;
  }
  return VD_TREE_SHARE.length - 1;
}

const f32 = (b64: string) => { const u = decodeBase64(b64); return new Float32Array(u.buffer, u.byteOffset, u.byteLength / 4); };
const u16 = (b64: string) => { const u = decodeBase64(b64); return new Uint16Array(u.buffer, u.byteOffset, u.byteLength / 2); };
// Display-space value of a linear bark albedo: the city feeds palette values straight to the screen.
const toDisplay = (c: number) => Math.pow(Math.max(0, c), 1 / 2.2);

export function buildVdTreeMeshes(THREE: Three, capacity: number, midCapacity = 0) {
  const T = THREE.TSL;
  const atlas = new THREE.DataArrayTexture(decodeBase64(VD_TREE_ATLAS_RGBA), VD_TREE_ATLAS_SIZE, VD_TREE_ATLAS_SIZE, VD_TREES.length);
  atlas.format = THREE.RGBAFormat;
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.needsUpdate = true;

  const geometries: InstanceType<Three['BufferGeometry']>[] = [];
  const materials: InstanceType<Three['Material']>[] = [];
  const species = VD_TREES.map((tree, layer) => {
    const bark = new THREE.BufferGeometry();
    bark.setAttribute('position', new THREE.BufferAttribute(f32(tree.bark.position), 3));
    bark.setAttribute('normal', new THREE.BufferAttribute(f32(tree.bark.normal), 3));
    bark.setIndex(new THREE.BufferAttribute(u16(tree.bark.index), 1));
    const leaf = new THREE.BufferGeometry();
    leaf.setAttribute('position', new THREE.BufferAttribute(f32(tree.leaf.position), 3));
    leaf.setAttribute('normal', new THREE.BufferAttribute(f32(tree.leaf.normal), 3));
    leaf.setAttribute('uv', new THREE.BufferAttribute(f32(tree.leaf.uv), 2));
    leaf.setAttribute('aShade', new THREE.BufferAttribute(f32(tree.leaf.shade), 1));
    leaf.setIndex(new THREE.BufferAttribute(u16(tree.leaf.index), 1));
    geometries.push(bark, leaf);

    const barkMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0 });
    const [r, g, b] = tree.barkColor;
    // Bark: the scan's tone with low-frequency streaks up the trunk, in place of the bark photo.
    const streak = T.fract(T.sin(T.positionLocal.x.mul(17.1).add(T.positionLocal.z.mul(11.3))).mul(43758.5453)).mul(0.25).add(0.85);
    barkMaterial.colorNode = T.vec4(T.vec3(toDisplay(r), toDisplay(g), toDisplay(b)).mul(streak), 1);

    // Leaves: the CC0 leaf atlas, alpha-cut, darkened toward the crown's
    // interior by the baked per-card shade, with Valdrada's back-light share
    // (bxTrees.js: 0.22 of the sun through a leaf whose back faces it) as a
    // flat lift.
    const leafMaterial = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.6, metalness: 0 });
    const sample = T.texture(atlas, T.uv()).depth(T.float(layer));
    const shade = T.attribute<'float'>('aShade', 'float');
    leafMaterial.colorNode = T.vec4(sample.rgb.mul(T.mix(T.float(0.55), T.float(1.1), shade)), 1);
    leafMaterial.opacityNode = sample.a;
    leafMaterial.emissiveNode = sample.rgb.mul(0.08);
    materials.push(barkMaterial, leafMaterial);

    const midLeaf = new THREE.BufferGeometry();
    midLeaf.setAttribute('position', new THREE.BufferAttribute(f32(tree.mid.position), 3));
    midLeaf.setAttribute('normal', new THREE.BufferAttribute(f32(tree.mid.normal), 3));
    midLeaf.setAttribute('uv', new THREE.BufferAttribute(f32(tree.mid.uv), 2));
    midLeaf.setAttribute('aShade', new THREE.BufferAttribute(f32(tree.mid.shade), 1));
    midLeaf.setIndex(new THREE.BufferAttribute(u16(tree.mid.index), 1));
    // A plain trunk to the crown base (the model's crowns start about 4 m up).
    const midTrunk = new THREE.CylinderGeometry(0.14, 0.24, 4.4, 6).translate(0, 2.2, 0);
    geometries.push(midLeaf, midTrunk);
    const midLeafMesh = new THREE.InstancedMesh(midLeaf, leafMaterial, Math.max(1, midCapacity));
    const midTrunkMesh = new THREE.InstancedMesh(midTrunk, barkMaterial, Math.max(1, midCapacity));
    midLeafMesh.name = `city:trees-vd-mid-${tree.id}`;
    midTrunkMesh.name = `city:trees-vd-midtrunk-${tree.id}`;
    for (const mesh of [midLeafMesh, midTrunkMesh]) { mesh.count = 0; mesh.frustumCulled = false; }
    const barkMesh = new THREE.InstancedMesh(bark, barkMaterial, capacity);
    const leafMesh = new THREE.InstancedMesh(leaf, leafMaterial, capacity);
    barkMesh.name = `city:trees-vd-bark-${tree.id}`;
    leafMesh.name = `city:trees-vd-leaf-${tree.id}`;
    for (const mesh of [barkMesh, leafMesh]) { mesh.count = 0; mesh.frustumCulled = false; }
    return { bark: barkMesh, leaf: leafMesh, midLeaf: midLeafMesh, midTrunk: midTrunkMesh, count: 0, midCount: 0 };
  });

  return {
    species,
    objects: species.flatMap((s) => [s.bark, s.leaf, s.midLeaf, s.midTrunk]),
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      atlas.dispose();
      for (const s of species) for (const m of [s.bark, s.leaf, s.midLeaf, s.midTrunk]) m.dispose();
    },
  };
}
