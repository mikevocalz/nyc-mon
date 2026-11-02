// The vd lane's near street trees: Valdrada's London plane, honeylocust and
// pin oak (vd-trees.ts, baked by tooling/city/bake-trees.mjs) as one bark and
// one leaf InstancedMesh per species, a thinned mid level whose trunks merge
// into a single mesh, and a far cross-card tier drawn as one leaf mesh and
// one trunk mesh across all species. foliage.ts hands each tree a species
// and fills these from the tier lists vd-tree-tiers.ts picks. The lean
// material flag (vd-leanmat.ts) swaps every body here for an unlit basic
// one; the colour graphs and the draw consolidation stay. The lean-draw
// flag (vd-leandraw.ts) goes further: every tier merges across species —
// the per-vertex aSp marks which species a vertex belongs to and the
// per-instance aSpecies keeps only that species' vertices — and the far
// trunk cross folds into the far leaf mesh, so the whole model-tree stack
// is five objects.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { decodeBase64 } from './foliage-decode.ts';
import { VD_LEANDRAW } from './vd-leandraw.ts';
import { VD_LEANMAT } from './vd-leanmat.ts';
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

/**
 * Folds a geometry's static per-vertex attributes into one InterleavedBuffer,
 * so they bind as a single vertex buffer. WebGPU's default maxVertexBuffers is
 * 8 and Dawn on the A12X iPad reports exactly 8: the lean-draw far leaf used
 * to bind nine (five per-vertex streams, four per-instance ones and the
 * instance matrix), and its pipeline failed to create, so the far trees never
 * drew. Each attribute keeps its name, item size and values.
 */
export function interleaveVertexAttributes(THREE: Three, geometry: InstanceType<Three['BufferGeometry']>, names: readonly string[]): void {
  const parts = names.map((name) => {
    const a = geometry.getAttribute(name) as InstanceType<Three['BufferAttribute']> | undefined;
    if (!a || (a as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute || (a as { isInstancedBufferAttribute?: boolean }).isInstancedBufferAttribute) {
      throw new Error(`interleaveVertexAttributes: ${name} is not a plain per-vertex attribute`);
    }
    if (!(a.array instanceof Float32Array)) throw new Error(`interleaveVertexAttributes: ${name} is not Float32`);
    return { name, a };
  });
  const count = parts[0]!.a.count;
  const stride = parts.reduce((n, p) => n + p.a.itemSize, 0);
  const data = new Float32Array(count * stride);
  let offset = 0;
  const placed = parts.map(({ name, a }) => {
    if (a.count !== count) throw new Error(`interleaveVertexAttributes: ${name} has ${a.count} vertices, not ${count}`);
    const src = a.array as Float32Array;
    for (let v = 0; v < count; v++) for (let c = 0; c < a.itemSize; c++) data[v * stride + offset + c] = src[v * a.itemSize + c]!;
    const at = { name, itemSize: a.itemSize, offset };
    offset += a.itemSize;
    return at;
  });
  const buffer = new THREE.InterleavedBuffer(data, stride);
  for (const { name, itemSize, offset: o } of placed) geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(buffer, itemSize, o));
}

const f32 = (b64: string) => { const u = decodeBase64(b64); return new Float32Array(u.buffer, u.byteOffset, u.byteLength / 4); };
const u16 = (b64: string) => { const u = decodeBase64(b64); return new Uint16Array(u.buffer, u.byteOffset, u.byteLength / 2); };
// Display-space value of a linear bark albedo: the city feeds palette values straight to the screen.
const toDisplay = (c: number) => Math.pow(Math.max(0, c), 1 / 2.2);

type BasicMat = InstanceType<Three['MeshBasicNodeMaterial']>;
type BasicParams = ConstructorParameters<Three['MeshBasicNodeMaterial']>[0];

type VdGeometry = InstanceType<Three['InstancedMesh']>['geometry'];
type VdInstanced = InstanceType<Three['InstancedMesh']>;

/**
 * Concatenate the per-species indexed geometries into one, baking the
 * species index into a per-vertex `aSp` and each part's constant rows into
 * the `extra` attributes (e.g. aTint). The index widens to u32 only when
 * the merged vertex count needs it.
 */
function mergeSpeciesGeometry(
  THREE: Three,
  parts: VdGeometry[],
  extra: readonly (readonly [string, number, (layer: number) => readonly number[]])[] = [],
): VdGeometry {
  const names = Object.keys(parts[0]!.attributes);
  let verts = 0;
  let indices = 0;
  for (const p of parts) {
    const n = (p.getAttribute('position') as InstanceType<Three['BufferAttribute']>).count;
    verts += n;
    indices += p.index ? p.index.count : n;
  }
  const index = new (verts > 65535 ? Uint32Array : Uint16Array)(indices);
  const aSp = new Float32Array(verts);
  const out: VdGeometry = new THREE.BufferGeometry();
  for (const name of names) {
    const size = (parts[0]!.getAttribute(name) as InstanceType<Three['BufferAttribute']>).itemSize;
    const buf = new Float32Array(verts * size);
    let o = 0;
    for (const p of parts) {
      const a = p.getAttribute(name) as InstanceType<Three['BufferAttribute']>;
      buf.set(a.array as Float32Array, o);
      o += a.count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(buf, size));
  }
  for (const [name, size, value] of extra) {
    const buf = new Float32Array(verts * size);
    let o = 0;
    for (const [layer, p] of parts.entries()) {
      const v = value(layer);
      const n = (p.getAttribute('position') as InstanceType<Three['BufferAttribute']>).count;
      for (let i = 0; i < n; i++) buf.set(v as number[], (o + i) * size);
      o += n;
    }
    out.setAttribute(name, new THREE.BufferAttribute(buf, size));
  }
  let vo = 0;
  let io = 0;
  for (const [layer, p] of parts.entries()) {
    const n = (p.getAttribute('position') as InstanceType<Three['BufferAttribute']>).count;
    const idx = p.index;
    if (idx) {
      const a = idx.array as Uint16Array | Uint32Array;
      for (let k = 0; k < idx.count; k++) index[io + k] = a[k]! + vo;
      io += idx.count;
    } else {
      for (let k = 0; k < n; k++) index[io + k] = vo + k;
      io += n;
    }
    aSp.fill(layer, vo, vo + n);
    vo += n;
  }
  out.setAttribute('aSp', new THREE.BufferAttribute(aSp, 1));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

export function buildVdTreeMeshes(
  THREE: Three, capacity: number, midCapacity = 0, farCapacity = 0,
  /** Overridable for tests: the lean material bodies (vd-leanmat.ts). Defaults to the flag. */
  leanMat = VD_LEANMAT,
  /** Overridable for tests: the cross-species merged draws (vd-leandraw.ts). Defaults to the flag. */
  leanDraw = VD_LEANDRAW,
  /**
   * Under the physical stack (sRGB output): colours are authored as display
   * values for the direct linear-output path, so each colour and glow is
   * decoded to the linear working space. Default false.
   */
  linearColors = false,
) {
  const T = THREE.TSL;
  type V3n = Node<'vec3'>;
  const working = (x: V3n): V3n => (linearColors ? T.sRGBTransferEOTF(x) as V3n : x);
  // Lean bodies (vd-leanmat.ts): the same colour graphs on an unlit basic
  // body. `lights = false` keeps the node builder from wrapping the output
  // in a lighting context at all — the draw encodes the colour nodes and
  // fog and nothing else, which is what the ~18 ms Duo encode floor pays
  // for on every standard-body material.
  const leanBody = (params?: BasicParams): BasicMat => {
    const m = new THREE.MeshBasicNodeMaterial(params);
    m.lights = false;
    return m;
  };
  // emissiveNode is declared on the standard/physical types only; the
  // runtime field exists on every NodeMaterial (materials.ts setEmissive).
  const setEmissive = (m: BasicMat | InstanceType<Three['MeshStandardNodeMaterial']>, node: Node) => {
    (m as unknown as { emissiveNode: Node }).emissiveNode = node;
  };
  const atlas = new THREE.DataArrayTexture(decodeBase64(VD_TREE_ATLAS_RGBA), VD_TREE_ATLAS_SIZE, VD_TREE_ATLAS_SIZE, VD_TREES.length);
  atlas.format = THREE.RGBAFormat;
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  // The far cross-cards tile their leaf card a few times a side; the model and
  // mid UVs stay inside 0..1, so wrapping changes nothing for them.
  atlas.wrapS = atlas.wrapT = THREE.RepeatWrapping;
  atlas.needsUpdate = true;

  const geometries: InstanceType<Three['BufferGeometry']>[] = [];
  const materials: InstanceType<Three['Material']>[] = [];

  // The merged mid and far trunks share one bark material: at 40 m and out the
  // species' bark tints — all within ~0.2 of this mean — are not perceivable,
  // so twelve per-species trunk meshes collapse into two.
  const meanBark = [0, 0, 0].map((c) => VD_TREES.reduce((sum, t) => sum + t.barkColor[c]!, 0) / VD_TREES.length);
  const trunkMaterial = leanMat
    ? leanBody()
    : new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0 });
  const trunkStreak = T.fract(T.sin(T.positionLocal.x.mul(17.1).add(T.positionLocal.z.mul(11.3))).mul(43758.5453)).mul(0.25).add(0.85);
  trunkMaterial.colorNode = T.vec4(working(T.vec3(toDisplay(meanBark[0]!), toDisplay(meanBark[1]!), toDisplay(meanBark[2]!)).mul(trunkStreak)), 1);
  materials.push(trunkMaterial);

  // The far imposter leaves likewise share one material: the atlas layer and
  // the card tiling arrive per instance (aLayer, aRep) instead of baking into
  // six materials, so all six species draw in one call. Under leandraw the
  // same draw also carries the trunk cross: per-vertex aSolid splits crown
  // verts from trunk verts, and the instance's crown box and crown-base
  // height arrive as aCrown/aBase so the vertex stage places each half off
  // the plain tree matrix.
  const farLeafMaterial = leanMat
    ? leanBody({ side: THREE.DoubleSide, alphaTest: 0.5 })
    : new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.6, metalness: 0 });
  const farSample = T.texture(atlas, T.uv().mul(T.attribute<'vec2'>('aRep', 'vec2'))).depth(T.attribute<'float'>('aLayer', 'float'));
  const farShade = T.attribute<'float'>('aShade', 'float');
  if (leanDraw) {
    const solid = T.attribute<'float'>('aSolid', 'float');
    const crown = T.attribute<'vec4'>('aCrown', 'vec4');
    const base = T.attribute<'float'>('aBase', 'float');
    const barkTone = T.vec3(toDisplay(meanBark[0]!), toDisplay(meanBark[1]!), toDisplay(meanBark[2]!)).mul(trunkStreak);
    farLeafMaterial.colorNode = T.vec4(working(T.mix(farSample.rgb.mul(T.mix(T.float(0.55), T.float(1.1), farShade)), barkTone, solid) as V3n), 1);
    farLeafMaterial.opacityNode = T.mix(farSample.a, T.float(1), solid);
    setEmissive(farLeafMaterial, working(T.mix(farSample.rgb, barkTone, solid).mul(0.08) as V3n));
    farLeafMaterial.positionNode = T.mix(
      T.vec3(crown.x.add(T.positionLocal.x.mul(crown.z)), base.add(T.positionLocal.y.mul(crown.w)), crown.y.add(T.positionLocal.z.mul(crown.z))),
      T.vec3(T.positionLocal.x, T.positionLocal.y.mul(base), T.positionLocal.z),
      solid,
    );
  } else {
    farLeafMaterial.colorNode = T.vec4(working(farSample.rgb.mul(T.mix(T.float(0.55), T.float(1.1), farShade))), 1);
    farLeafMaterial.opacityNode = farSample.a;
    setEmissive(farLeafMaterial, working(farSample.rgb.mul(0.08)));
  }
  materials.push(farLeafMaterial);

  const species = VD_TREES.map((tree, layer) => {
    const bark = new THREE.BufferGeometry();
    bark.setAttribute('position', new THREE.BufferAttribute(f32(tree.bark.position), 3));
    bark.setAttribute('normal', new THREE.BufferAttribute(f32(tree.bark.normal), 3));
    bark.setIndex(new THREE.BufferAttribute(u16(tree.bark.index), 1));
    const leaf = new THREE.BufferGeometry();
    const leafPos = f32(tree.leaf.position);
    leaf.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
    leaf.setAttribute('normal', new THREE.BufferAttribute(f32(tree.leaf.normal), 3));
    leaf.setAttribute('uv', new THREE.BufferAttribute(f32(tree.leaf.uv), 2));
    leaf.setAttribute('aShade', new THREE.BufferAttribute(f32(tree.leaf.shade), 1));
    leaf.setIndex(new THREE.BufferAttribute(u16(tree.leaf.index), 1));
    geometries.push(bark, leaf);

    const barkMaterial = leanMat
      ? leanBody()
      : new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0 });
    const [r, g, b] = tree.barkColor;
    // Bark: the scan's tone with low-frequency streaks up the trunk, in place of the bark photo.
    const streak = T.fract(T.sin(T.positionLocal.x.mul(17.1).add(T.positionLocal.z.mul(11.3))).mul(43758.5453)).mul(0.25).add(0.85);
    barkMaterial.colorNode = T.vec4(working(T.vec3(toDisplay(r), toDisplay(g), toDisplay(b)).mul(streak)), 1);

    // Leaves: the CC0 leaf atlas, alpha-cut, darkened toward the crown's
    // interior by the baked per-card shade, with Valdrada's back-light share
    // (bxTrees.js: 0.22 of the sun through a leaf whose back faces it) as a
    // flat lift.
    const leafMaterial = leanMat
      ? leanBody({ side: THREE.DoubleSide, alphaTest: 0.5 })
      : new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.6, metalness: 0 });
    const sample = T.texture(atlas, T.uv()).depth(T.float(layer));
    const shade = T.attribute<'float'>('aShade', 'float');
    leafMaterial.colorNode = T.vec4(working(sample.rgb.mul(T.mix(T.float(0.55), T.float(1.1), shade))), 1);
    leafMaterial.opacityNode = sample.a;
    setEmissive(leafMaterial, working(sample.rgb.mul(0.08)));
    materials.push(barkMaterial, leafMaterial);

    const midLeaf = new THREE.BufferGeometry();
    midLeaf.setAttribute('position', new THREE.BufferAttribute(f32(tree.mid.position), 3));
    midLeaf.setAttribute('normal', new THREE.BufferAttribute(f32(tree.mid.normal), 3));
    midLeaf.setAttribute('uv', new THREE.BufferAttribute(f32(tree.mid.uv), 2));
    midLeaf.setAttribute('aShade', new THREE.BufferAttribute(f32(tree.mid.shade), 1));
    midLeaf.setIndex(new THREE.BufferAttribute(u16(tree.mid.index), 1));
    geometries.push(midLeaf);
    const midLeafMesh = new THREE.InstancedMesh(midLeaf, leafMaterial, Math.max(1, midCapacity));
    midLeafMesh.name = `city:trees-vd-mid-${tree.id}`;
    midLeafMesh.count = 0;
    midLeafMesh.frustumCulled = false;

    // The far tier (vd-tree-tiers.ts) draws two crossed quads over the crown's
    // bounding box plus a plain trunk cross — 8 triangles a tree. The shared
    // geometries are unit-sized; this box (centre, half width, crown-base
    // height, crown height) plus the atlas layer and card tiling go to
    // foliage.ts, which folds them into each instance's matrix and the aLayer
    // / aRep attributes.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i + 2 < leafPos.length; i += 3) {
      x0 = Math.min(x0, leafPos[i]!); x1 = Math.max(x1, leafPos[i]!);
      y0 = Math.min(y0, leafPos[i + 1]!); y1 = Math.max(y1, leafPos[i + 1]!);
      z0 = Math.min(z0, leafPos[i + 2]!); z1 = Math.max(z1, leafPos[i + 2]!);
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const hw = Math.max(x1 - x0, z1 - z0) / 2;
    const repU = Math.max(2, Math.round((hw * 2) / 4.5));
    const repV = Math.max(2, Math.round((y1 - y0) / 4.5));
    const far = { cx, y0, cz, hw, hh: y1 - y0, layer, repU, repV };

    const barkMesh = new THREE.InstancedMesh(bark, barkMaterial, capacity);
    const leafMesh = new THREE.InstancedMesh(leaf, leafMaterial, capacity);
    barkMesh.name = `city:trees-vd-bark-${tree.id}`;
    leafMesh.name = `city:trees-vd-leaf-${tree.id}`;
    for (const mesh of [barkMesh, leafMesh]) { mesh.count = 0; mesh.frustumCulled = false; }
    return { bark: barkMesh, leaf: leafMesh, midLeaf: midLeafMesh, far, count: 0, midCount: 0 };
  });

  // A plain trunk to the crown base (the model's crowns start about 4 m up) —
  // identical for every species, so the mid tier draws all of them at once.
  const midTrunkGeometry = new THREE.CylinderGeometry(0.14, 0.24, 4.4, 6).translate(0, 2.2, 0);
  // Unit trunk cross (y in 0..1): the instance matrix's Y column scales it to
  // the species' crown base. Unit crown cross (x,z in -1..1, y in 0..1): the
  // instance matrix carries the species' box as a non-uniform scale. The
  // canopy tiles the species' atlas card about every 4.5 m (aRep), so at
  // distance it reads as the same foliage mass the mid cards show; the
  // crown's upward normals keep both quads lit evenly.
  const tw = 0.18;
  const farTrunkGeometry = new THREE.BufferGeometry();
  farTrunkGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -tw, 0, 0, tw, 0, 0, tw, 1, 0, -tw, 1, 0,
    0, 0, -tw, 0, 0, tw, 0, 1, tw, 0, 1, -tw,
  ], 3));
  farTrunkGeometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
  ], 3));
  farTrunkGeometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const farCap = Math.max(1, farCapacity);
  const farLayer = new THREE.InstancedBufferAttribute(new Float32Array(farCap), 1);
  const farRep = new THREE.InstancedBufferAttribute(new Float32Array(farCap * 2), 2);
  const midTrunk = new THREE.InstancedMesh(midTrunkGeometry, trunkMaterial, Math.max(1, midCapacity));
  midTrunk.name = 'city:trees-vd-midtrunk';
  midTrunk.count = 0;
  midTrunk.frustumCulled = false;
  geometries.push(midTrunkGeometry, farTrunkGeometry);

  /**
   * The merged lean-draw set (vd-leandraw.ts): one instanced mesh per tier
   * across all species plus the instanced species picks, or null on the
   * default path. `far` doubles as `farLeaf` below — the trunk cross folds
   * into it, so the field keeps its name and count contract.
   */
  let merged: null | {
    bark: VdInstanced;
    leaf: VdInstanced;
    mid: VdInstanced;
    barkSpecies: InstanceType<Three['InstancedBufferAttribute']>;
    leafSpecies: InstanceType<Three['InstancedBufferAttribute']>;
    midSpecies: InstanceType<Three['InstancedBufferAttribute']>;
    /** Per-instance crown box (cx, cz, hw, hh) and crown-base height for the folded far mesh. */
    farCrown: InstanceType<Three['InstancedBufferAttribute']>;
    farBase: InstanceType<Three['InstancedBufferAttribute']>;
  } = null;

  let farLeafGeometry: VdGeometry;
  if (leanDraw) {
    // Trunk cross first (aSolid = 1), then the crown cross (aSolid = 0); the
    // instance matrix is the plain tree matrix and the vertex stage places
    // each half off aCrown/aBase — the same boxes the two-mesh path folds
    // into the matrices.
    farLeafGeometry = new THREE.BufferGeometry();
    farLeafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -tw, 0, 0, tw, 0, 0, tw, 1, 0, -tw, 1, 0,
      0, 0, -tw, 0, 0, tw, 0, 1, tw, 0, 1, -tw,
      -1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0,
      0, 0, -1, 0, 0, 1, 0, 1, 1, 0, 1, -1,
    ], 3));
    farLeafGeometry.setAttribute('normal', new THREE.Float32BufferAttribute([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    ], 3));
    farLeafGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
    ], 2));
    // Top of the cross reads a touch brighter, like the crowns around it.
    farLeafGeometry.setAttribute('aShade', new THREE.Float32BufferAttribute([
      0.85, 0.85, 1, 1, 0.85, 0.85, 1, 1,
      0.85, 0.85, 1, 1, 0.85, 0.85, 1, 1,
    ], 1));
    farLeafGeometry.setAttribute('aSolid', new THREE.Float32BufferAttribute(new Array(16).fill(0).map((_, i) => (i < 8 ? 1 : 0)), 1));
    farLeafGeometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15]);
    const farCrown = new THREE.InstancedBufferAttribute(new Float32Array(farCap * 4), 4);
    const farBase = new THREE.InstancedBufferAttribute(new Float32Array(farCap), 1);
    farLeafGeometry.setAttribute('aCrown', farCrown);
    farLeafGeometry.setAttribute('aBase', farBase);

    // One species mask per merged material: verts of the other species
    // collapse to a point, so the whole tier is one draw. aSp doubles as
    // the leaf atlas layer — both are the species index.
    const speciesMatch = T.select(T.attribute<'float'>('aSp', 'float').equal(T.attribute<'float'>('aSpecies', 'float')), T.float(1), T.float(0));
    const nearCap = Math.max(1, capacity);
    const midCap = Math.max(1, midCapacity);
    const barkGeometry = mergeSpeciesGeometry(THREE, species.map((s) => s.bark.geometry), [
      ['aTint', 3, (layer) => VD_TREES[layer]!.barkColor.map(toDisplay)],
    ]);
    const leafGeometry = mergeSpeciesGeometry(THREE, species.map((s) => s.leaf.geometry));
    const midGeometry = mergeSpeciesGeometry(THREE, species.map((s) => s.midLeaf.geometry));
    geometries.push(barkGeometry, leafGeometry, midGeometry);
    // The merged copies are the only ones drawn on this path; the six
    // species' own bark, leaf and mid arrays would sit on the CPU for the
    // scene's life (about 5 MB with the iPad's ~2.5 GiB ceiling close).
    // Their meshes stay as empty shells so the tier bookkeeping keeps its shape.
    for (const s of species) {
      for (const g of [s.bark.geometry, s.leaf.geometry, s.midLeaf.geometry]) {
        for (const a of [...Object.values(g.attributes), g.index]) {
          const attr = a as unknown as { array: ArrayBufferView } | null;
          if (attr && ArrayBuffer.isView(attr.array)) {
            const Ctor = attr.array.constructor as new (n: number) => ArrayBufferView;
            attr.array = new Ctor(0);
          }
        }
      }
    }

    const nearBarkMaterial = leanMat
      ? leanBody()
      : new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0 });
    nearBarkMaterial.colorNode = T.vec4(working(T.attribute<'vec3'>('aTint', 'vec3').mul(trunkStreak)), 1);
    nearBarkMaterial.positionNode = T.positionLocal.mul(speciesMatch);
    materials.push(nearBarkMaterial);

    const nearLeafMaterial = leanMat
      ? leanBody({ side: THREE.DoubleSide, alphaTest: 0.5 })
      : new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.6, metalness: 0 });
    const nearSample = T.texture(atlas, T.uv()).depth(T.attribute<'float'>('aSp', 'float'));
    const nearShade = T.attribute<'float'>('aShade', 'float');
    nearLeafMaterial.colorNode = T.vec4(working(nearSample.rgb.mul(T.mix(T.float(0.55), T.float(1.1), nearShade))), 1);
    nearLeafMaterial.opacityNode = nearSample.a;
    setEmissive(nearLeafMaterial, working(nearSample.rgb.mul(0.08)));
    nearLeafMaterial.positionNode = T.positionLocal.mul(speciesMatch);
    materials.push(nearLeafMaterial);

    const barkSpecies = new THREE.InstancedBufferAttribute(new Float32Array(nearCap), 1);
    const leafSpecies = new THREE.InstancedBufferAttribute(new Float32Array(nearCap), 1);
    const midSpecies = new THREE.InstancedBufferAttribute(new Float32Array(midCap), 1);
    barkGeometry.setAttribute('aSpecies', barkSpecies);
    leafGeometry.setAttribute('aSpecies', leafSpecies);
    midGeometry.setAttribute('aSpecies', midSpecies);

    const bark = new THREE.InstancedMesh(barkGeometry, nearBarkMaterial, nearCap);
    const leaf = new THREE.InstancedMesh(leafGeometry, nearLeafMaterial, nearCap);
    const mid = new THREE.InstancedMesh(midGeometry, nearLeafMaterial, midCap);
    // The shadow-caster predicate in index.ts keys on these prefixes.
    bark.name = 'city:trees-vd-bark-all';
    leaf.name = 'city:trees-vd-leaf-all';
    mid.name = 'city:trees-vd-mid-all';
    for (const mesh of [bark, leaf, mid]) { mesh.count = 0; mesh.frustumCulled = false; }
    merged = { bark, leaf, mid, barkSpecies, leafSpecies, midSpecies, farCrown, farBase };
  } else {
    farLeafGeometry = new THREE.BufferGeometry();
    farLeafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0,
      0, 0, -1, 0, 0, 1, 0, 1, 1, 0, 1, -1,
    ], 3));
    farLeafGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(24).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    farLeafGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
    ], 2));
    // Top of the cross reads a touch brighter, like the crowns around it.
    farLeafGeometry.setAttribute('aShade', new THREE.Float32BufferAttribute([0.85, 0.85, 1, 1, 0.85, 0.85, 1, 1], 1));
    farLeafGeometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  }
  // One vertex buffer for the card's own streams: with the per-instance ones
  // and the instance matrix the far leaf binds at most six (limit 8).
  interleaveVertexAttributes(THREE, farLeafGeometry, leanDraw ? ['position', 'normal', 'uv', 'aShade', 'aSolid'] : ['position', 'normal', 'uv', 'aShade']);
  farLeafGeometry.setAttribute('aLayer', farLayer);
  farLeafGeometry.setAttribute('aRep', farRep);
  geometries.push(farLeafGeometry);
  const farTrunk = new THREE.InstancedMesh(farTrunkGeometry, trunkMaterial, farCap);
  const farLeaf = new THREE.InstancedMesh(farLeafGeometry, farLeafMaterial, farCap);
  farLeaf.name = 'city:trees-vd-far';
  farTrunk.name = 'city:trees-vd-fartrunk';
  for (const mesh of [farLeaf, farTrunk]) { mesh.count = 0; mesh.frustumCulled = false; }

  return {
    species,
    midTrunk,
    farLeaf,
    farTrunk,
    /** Per-instance atlas layer and uv tiling for the merged far leaf; foliage.ts fills them beside the matrices. */
    farLayer,
    farRep,
    /** The lean-draw merged set (vd-leandraw.ts): null on the default path. */
    merged,
    objects: merged
      // The per-species meshes stay built (the fills ignore them and they
      // never join the scene); only the merged set draws.
      ? [merged.bark, merged.leaf, merged.mid, midTrunk, farLeaf]
      : [...species.flatMap((s) => [s.bark, s.leaf, s.midLeaf]), midTrunk, farLeaf, farTrunk],
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      atlas.dispose();
      for (const s of species) for (const m of [s.bark, s.leaf, s.midLeaf]) m.dispose();
      for (const m of [midTrunk, farLeaf, farTrunk, ...(merged ? [merged.bark, merged.leaf, merged.mid] : [])]) m.dispose();
    },
  };
}
