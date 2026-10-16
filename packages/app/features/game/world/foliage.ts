// Street and park trees: instanced leaf crowns near the camera, plain crowns
// far away, hidden beyond that. Ported from vg-demos-all
// src/demos/metro-live/world/foliage.ts (MIT; notice in geometry.ts and
// docs/implementation/city-world.md): base64 decode, the leaf-card crown
// (one core and 10 cards here instead of two cores and 30, so 7 500
// trees stay near 450k triangles on a phone) and the `leaf`
// attribute convention (0 on the solid core, > 0 on cut-out cards). The leaf
// alpha comes from the CC0 Quaternius nature pack, baked into
// world/leaf-alpha.ts by tooling/city/bake-foliage.mjs.
import type { Three } from '@acme/ui/three';
import type { BufferGeometry } from 'three/webgpu';
import type { CityDatasetV2 } from '../city-dataset.ts';
import { LEAF_ALPHA as LEAF } from './leaf-alpha.ts';
import { mulberry32 } from './geometry.ts';
import { createFarCrownMaterial, createLeafMaterial, linearColor } from './materials.ts';

type Geometry = BufferGeometry;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function decodeBase64(base64: string): Uint8Array {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  const clean = base64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)]!;
    const b = lookup[clean.charCodeAt(i + 1)]!;
    const c = lookup[clean.charCodeAt(i + 2)] ?? 0;
    const d = lookup[clean.charCodeAt(i + 3)] ?? 0;
    out[o++] = (a << 2) | (b >> 4);
    if (o < out.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (o < out.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}

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

/** Where trees stand: OSM trees first, then the generated fill. */
export function treePlacements(dataset: CityDatasetV2): { x: number; z: number; scale: number; tone: number; osm: boolean }[] {
  const rand = mulberry32(1931);
  const out: { x: number; z: number; scale: number; tone: number; osm: boolean }[] = [];
  const push = (list: readonly number[], osm: boolean) => {
    for (let i = 0; i + 1 < list.length; i += 2) {
      out.push({ x: list[i]!, z: list[i + 1]!, scale: osm ? 1 + rand() * 0.3 : 0.8 + rand() * 0.45, tone: rand(), osm });
    }
  };
  push(dataset.trees.osm, true);
  push(dataset.trees.fill, false);
  return out;
}

/** Above these camera distances (metres) the near crowns swap to plain ones, then all trees hide. */
export const TREE_NEAR_LOD_METRES = 450;
export const TREE_HIDE_METRES = 1600;

export function buildTrees(THREE: Three, dataset: CityDatasetV2) {
  const placements = treePlacements(dataset);
  const count = Math.max(1, placements.length);
  const texture = leafTexture(THREE);
  const crownGeometry = leafCrownGeometry(THREE);
  const farGeometry = new THREE.IcosahedronGeometry(1.15 * CROWN_SCALE, 0).translate(0, 1.5 * CROWN_SCALE, 0);
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.24, 2.8, 6).translate(0, 1.4, 0);
  const leafMaterial = createLeafMaterial(THREE, texture);
  const farMaterial = createFarCrownMaterial(THREE);
  const trunkMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  trunkMaterial.colorNode = THREE.TSL.color(linearColor(THREE, 'trunk'));
  const near = new THREE.InstancedMesh(crownGeometry, leafMaterial, count);
  const far = new THREE.InstancedMesh(farGeometry, farMaterial, count);
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
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
  placements.forEach((tree, i) => {
    rotation.setFromAxisAngle(up, tree.tone * Math.PI * 2);
    position.set(tree.x, 0, tree.z);
    scale.setScalar(tree.scale);
    matrix.compose(position, rotation, scale);
    near.setMatrixAt(i, matrix);
    far.setMatrixAt(i, matrix);
    trunks.setMatrixAt(i, matrix);
    tone.copy(dark).lerp(light, tree.tone);
    near.setColorAt(i, tone);
    far.setColorAt(i, tone);
  });
  for (const mesh of [near, far, trunks]) {
    mesh.count = placements.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // The batch spans the whole tile; per-instance culling is not worth it at this count.
    mesh.frustumCulled = false;
  }
  far.visible = false;
  return {
    objects: [near, far, trunks],
    count: placements.length,
    /** Near/far crown swap by camera distance. */
    setDistance(distance: number) {
      const hide = distance > TREE_HIDE_METRES || placements.length === 0;
      near.visible = !hide && distance <= TREE_NEAR_LOD_METRES;
      far.visible = !hide && distance > TREE_NEAR_LOD_METRES;
      trunks.visible = !hide && distance <= TREE_NEAR_LOD_METRES * 1.5;
    },
    dispose() {
      for (const g of [crownGeometry, farGeometry, trunkGeometry]) g.dispose();
      for (const m of [leafMaterial, farMaterial, trunkMaterial]) m.dispose();
      texture.dispose();
      for (const mesh of [near, far, trunks]) mesh.dispose();
    },
  };
}
