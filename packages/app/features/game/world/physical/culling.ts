// Adapted from mrdoob/slop-newyork @ be65d0a, js/scene-culling.js setupSceneCulling, updateSceneCulling, chunkInstancedMesh, instanceSize, proxyableMaterial (MIT, © 2026 Mr.doob)
//
// Spatial culling for static instanced props and big shadow casters, run
// once after the city is built:
// 1. Instanced meshes of small props that span the tile are split into
//    spatial chunks, each frustum-culled and hidden past the distance where
//    its props shrink below a pixel or two (`update`, per frame).
// 2. Big static shadow casters get position-only stand-ins cut into cells,
//    on a layer only the sun's cascade cameras render; the originals stop
//    casting. Stand-ins share one material per face side, so a cell is one draw.
// 3. Large batches that never distance-cull are split into cells for frustum culling.
//
// Slop sizes its gates for a 20 km island. The tile is 1.7 km across, so
// the mesh-radius gates are rescaled (physical-materials-constants.ts
// CULLING, TODO(tune)); the per-instance cull rule is Slop's. The merged
// city meshes (city-mesh.ts) are not instanced and stay whole: chunking
// them would raise the draw count G6 holds at 12.
//
// Module state became a returned handle, so two scenes never share a list.
import type { Three } from '@acme/ui/three';
import { CULLING } from '../physical-materials-constants.ts';

type Object3D = InstanceType<Three['Object3D']>;
type Mesh = InstanceType<Three['Mesh']>;
type InstancedMesh = InstanceType<Three['InstancedMesh']>;
type Material = InstanceType<Three['Material']>;
type Geometry = InstanceType<Three['BufferGeometry']>;
type Attribute = InstanceType<Three['BufferAttribute']>;

/** What the culling needs from the sun's shadow: its cascade cameras (SunLight's shadow in three r186). */
export interface CascadeShadow {
  getCamera?(index: number): { layers: { enable(layer: number): void } } | undefined;
  getViewportCount?(): number;
}

export interface CullingOptions {
  cullPerMetre?: number;
  cullMin?: number;
  cullMax?: number;
  proxyCell?: number;
  staticCell?: number;
  shadowProxyLayer?: number;
  minInstances?: number;
  minChunkTriangles?: number;
  minChunkRadius?: number;
  minProxyTriangles?: number;
  minProxyRadius?: number;
}

export interface SceneCulling {
  /** Chunks hidden by distance: { mesh, centre, radius, distance }. */
  readonly culled: readonly { mesh: Object3D; x: number; y: number; z: number; r: number; d: number }[];
  /** Shadow stand-ins added to the scene. */
  readonly proxies: readonly Mesh[];
  /** Per frame, after a warm-up frame that must see everything: hide chunks past their cull distance. */
  update(camera: { x: number; y: number; z: number }): void;
}

const triangleCount = (geo: Geometry) => (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3;

function isStaticMesh(o: Object3D): o is Mesh {
  const m = o as Mesh & { isSkinnedMesh?: boolean };
  return !!m.isMesh && !m.isSkinnedMesh && m.visible && m.frustumCulled !== false && !m.morphTargetInfluences;
}

/** A caster can stand in as bare positions only if its material neither moves its vertices nor cuts holes in it. */
export function proxyableMaterial(material: Material | Material[] | undefined): boolean {
  if (!material || Array.isArray(material)) return false;
  const m = material as Material & Record<string, unknown>;
  return !m.transparent && !(m.alphaTest > 0) && !m.alphaMap
    && !m.positionNode && !m.castShadowPositionNode && !m.castShadowNode && !m.alphaTestNode
    && !m.maskNode && !m.maskShadowNode && !m.depthNode && !m.displacementMap;
}

export function setupSceneCulling(
  THREE: Three, scene: Object3D, roots: readonly Object3D[], shadow: CascadeShadow | null = null, options: CullingOptions = {},
): SceneCulling {
  const o = { ...CULLING, ...options };
  const _m = new THREE.Matrix4();
  const _wm = new THREE.Matrix4();
  const _size = new THREE.Vector3();
  const _a = new THREE.Vector3(); const _b = new THREE.Vector3(); const _c = new THREE.Vector3();

  // Typical instance size: sqrt(middle × largest extent), so poles count by length and decals by area; the 90th percentile.
  const instanceSize = (mesh: InstancedMesh) => {
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    geo.boundingBox!.getSize(_size);
    const e = mesh.instanceMatrix.array;
    const n = mesh.count;
    const step = Math.max(1, Math.floor(n / 1024));
    const sizes: number[] = [];
    for (let i = 0; i < n; i += step) {
      const k = i * 16;
      const d = [
        Math.hypot(e[k]!, e[k + 1]!, e[k + 2]!) * _size.x,
        Math.hypot(e[k + 4]!, e[k + 5]!, e[k + 6]!) * _size.y,
        Math.hypot(e[k + 8]!, e[k + 9]!, e[k + 10]!) * _size.z,
      ].sort((p, q) => p - q);
      sizes.push(Math.sqrt(d[1]! * d[2]!));
    }
    sizes.sort((p, q) => p - q);
    return sizes[Math.floor(sizes.length * 0.9)] ?? 0;
  };

  const copyObjectState = (dst: Object3D, src: Object3D) => {
    dst.name = src.name;
    dst.castShadow = src.castShadow;
    dst.receiveShadow = src.receiveShadow;
    dst.renderOrder = src.renderOrder;
    dst.layers.mask = src.layers.mask;
    dst.visible = src.visible;
    dst.userData = { ...src.userData };
    dst.position.copy(src.position);
    dst.quaternion.copy(src.quaternion);
    dst.scale.copy(src.scale);
    dst.matrixAutoUpdate = src.matrixAutoUpdate;
    dst.matrix.copy(src.matrix);
    if (Object.prototype.hasOwnProperty.call(src, 'onBeforeRender')) dst.onBeforeRender = src.onBeforeRender;
    if (Object.prototype.hasOwnProperty.call(src, 'onAfterRender')) dst.onAfterRender = src.onAfterRender;
  };

  // One InstancedMesh per `cell` × `cell` m square of instance positions, sharing vertex data and material (one pipeline).
  const chunkInstancedMesh = (mesh: InstancedMesh, cell: number): InstancedMesh[] => {
    const n = mesh.count;
    const src = mesh.instanceMatrix.array as Float32Array;
    const cells = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const key = `${Math.floor(src[i * 16 + 12]! / cell)},${Math.floor(src[i * 16 + 14]! / cell)}`;
      let ids = cells.get(key);
      if (!ids) cells.set(key, (ids = []));
      ids.push(i);
    }
    const geo0 = mesh.geometry;
    if (!geo0.boundingSphere) geo0.computeBoundingSphere();
    if (!geo0.boundingBox) geo0.computeBoundingBox();
    const attrs = Object.entries(geo0.attributes) as [string, Attribute & { isInstancedBufferAttribute?: boolean; meshPerAttribute?: number }][];
    const chunks: InstancedMesh[] = [];
    for (const ids of cells.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setIndex(geo0.index);
      for (const [name, a] of attrs) {
        if (!a.isInstancedBufferAttribute) { geo.setAttribute(name, a); continue; }
        const s = a.itemSize;
        const Ctor = a.array.constructor as Float32ArrayConstructor;
        const arr = new Ctor(ids.length * s);
        ids.forEach((id, j) => arr.set((a.array as Float32Array).subarray(id * s, id * s + s), j * s));
        geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, s, a.normalized, a.meshPerAttribute));
      }
      for (const g of geo0.groups) geo.addGroup(g.start, g.count, g.materialIndex);
      geo.setDrawRange(geo0.drawRange.start, geo0.drawRange.count);
      geo.boundingSphere = geo0.boundingSphere;
      geo.boundingBox = geo0.boundingBox;
      const chunk = new THREE.InstancedMesh(geo as never, mesh.material, ids.length);
      ids.forEach((id, j) => (chunk.instanceMatrix.array as Float32Array).set(src.subarray(id * 16, id * 16 + 16), j * 16));
      if (mesh.instanceColor) {
        const cArr = mesh.instanceColor.array as Float32Array;
        const arr = new Float32Array(ids.length * 3);
        ids.forEach((id, j) => arr.set(cArr.subarray(id * 3, id * 3 + 3), j * 3));
        chunk.instanceColor = new THREE.InstancedBufferAttribute(arr, 3);
      }
      copyObjectState(chunk, mesh);
      chunk.computeBoundingSphere();
      chunks.push(chunk);
    }
    return chunks;
  };

  const replaceWithChunks = (mesh: InstancedMesh, cell: number) => {
    const parent = mesh.parent!;
    const chunks = chunkInstancedMesh(mesh, cell);
    parent.remove(mesh);
    chunks.forEach((chunk, k) => {
      parent.add(chunk);
      // Every chunk shares the first chunk's pipeline (Slop main.js precompile).
      if (k > 0) chunk.userData.sharesPipelineWith = chunks[0];
      chunk.updateMatrixWorld(true);
    });
    return chunks;
  };

  scene.updateMatrixWorld(true);
  const culled: { mesh: Object3D; x: number; y: number; z: number; r: number; d: number }[] = [];
  const proxies: Mesh[] = [];

  // 1. Small props: chunked and distance culled.
  const chunkable: InstancedMesh[] = [];
  const largeMeshes: InstancedMesh[] = [];
  for (const root of roots) {
    root.traverse((obj) => {
      const m = obj as InstancedMesh & { isInstancedMesh?: boolean };
      if (!m.isInstancedMesh || !isStaticMesh(m) || m.count < o.minInstances || m.count !== m.instanceMatrix.count) return;
      if (m.count * triangleCount(m.geometry) < o.minChunkTriangles) return;
      if (!m.boundingSphere) m.computeBoundingSphere();
      if (m.boundingSphere!.radius < o.minChunkRadius) return;
      chunkable.push(m);
    });
  }
  for (const mesh of chunkable) {
    // Unlit glowing props (signal lenses, lamp bulbs) read from much further away at night.
    const mat = mesh.material as Material & { isMeshBasicNodeMaterial?: boolean };
    const glow = mat.isMeshBasicNodeMaterial || mat.type === 'MeshBasicNodeMaterial' ? 3 : 1;
    const cullDist = Math.max(o.cullMin, instanceSize(mesh) * o.cullPerMetre * glow);
    if (cullDist > o.cullMax) { largeMeshes.push(mesh); continue; }
    const cell = Math.min(600, Math.max(250, cullDist * 0.5));
    for (const chunk of replaceWithChunks(mesh, cell)) {
      const sphere = chunk.boundingSphere!.clone().applyMatrix4(chunk.matrixWorld);
      culled.push({ mesh: chunk, x: sphere.center.x, y: sphere.center.y, z: sphere.center.z, r: sphere.radius, d: cullDist });
    }
  }

  // 2. Shadow stand-ins for the big static casters.
  const cams: { layers: { enable(layer: number): void } }[] = [];
  if (shadow && typeof shadow.getCamera === 'function') {
    const count = typeof shadow.getViewportCount === 'function' ? shadow.getViewportCount() : 2;
    for (let i = 0; i < count; i++) {
      const cam = shadow.getCamera(i);
      if (cam && cam.layers) cams.push(cam);
    }
  }
  if (cams.length) {
    type Side = { side: number; shadowSide: number | null };
    const instancedBySig = new Map<string, { geometry: Geometry; material: Material; cells: Map<string, number[]> }>();
    const triCells = new Map<Side, Map<string, number[]>>();
    const proxyMaterials = new Map<Side, Material>();
    const proxyMaterial = (side: Side) => {
      let m = proxyMaterials.get(side);
      if (!m) {
        m = new THREE.MeshBasicNodeMaterial({ side: side.side as never, color: new THREE.Color(0, 0, 0) });
        m.shadowSide = side.shadowSide as never;
        m.name = 'ShadowProxy';
        proxyMaterials.set(side, m);
      }
      return m;
    };
    const sideKeys = new Map<string, Side>();
    const sideOf = (mat: Material): Side => {
      const k = `${mat.side},${mat.shadowSide}`;
      let s = sideKeys.get(k);
      if (!s) sideKeys.set(k, (s = { side: mat.side, shadowSide: mat.shadowSide }));
      return s;
    };
    const cellKey = (x: number, z: number) => `${Math.floor(x / o.proxyCell)},${Math.floor(z / o.proxyCell)}`;

    const sources: Mesh[] = [];
    for (const root of roots) {
      root.traverse((obj) => {
        if (!obj.castShadow || !isStaticMesh(obj) || !proxyableMaterial(obj.material as Material)) return;
        const inst = obj as InstancedMesh & { isInstancedMesh?: boolean };
        if (inst.isInstancedMesh && inst.count !== inst.instanceMatrix.count) return;
        const tris = triangleCount(obj.geometry) * (inst.isInstancedMesh ? inst.count : 1);
        if (tris < o.minProxyTriangles) return;
        let radius: number;
        if (inst.isInstancedMesh) {
          if (!inst.boundingSphere) inst.computeBoundingSphere();
          radius = inst.boundingSphere!.radius;
        } else {
          if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
          radius = obj.geometry.boundingSphere!.radius * obj.matrixWorld.getMaxScaleOnAxis();
        }
        if (radius > o.minProxyRadius) sources.push(obj);
      });
    }

    for (const src of sources) {
      const side = sideOf(src.material as Material);
      const geo = src.geometry;
      const inst = src as InstancedMesh & { isInstancedMesh?: boolean };
      if (inst.isInstancedMesh) {
        const pos = geo.getAttribute('position');
        if (!geo.boundingBox) geo.computeBoundingBox();
        const bb = geo.boundingBox!;
        const sig = [pos.count, geo.index ? geo.index.count : -1, bb.min.toArray().map((v) => v.toFixed(3)), bb.max.toArray().map((v) => v.toFixed(3)), side.side, side.shadowSide].join('|');
        let entry = instancedBySig.get(sig);
        if (!entry) {
          const g = new THREE.BufferGeometry();
          g.setIndex(geo.index);
          g.setAttribute('position', pos);
          entry = { geometry: g, material: proxyMaterial(side), cells: new Map() };
          instancedBySig.set(sig, entry);
        }
        const e = inst.instanceMatrix.array as Float32Array;
        for (let i = 0; i < inst.count; i++) {
          _wm.multiplyMatrices(inst.matrixWorld, _m.fromArray(e, i * 16));
          const key = cellKey(_wm.elements[12]!, _wm.elements[14]!);
          let list = entry.cells.get(key);
          if (!list) entry.cells.set(key, (list = []));
          list.push(..._wm.elements);
        }
      } else {
        let bySide = triCells.get(side);
        if (!bySide) triCells.set(side, (bySide = new Map()));
        const pos = geo.getAttribute('position');
        const idx = geo.index;
        const start = geo.drawRange.start;
        const end = Math.min(idx ? idx.count : pos.count, start + geo.drawRange.count);
        for (let t = start; t + 2 < end; t += 3) {
          const i0 = idx ? idx.getX(t) : t;
          const i1 = idx ? idx.getX(t + 1) : t + 1;
          const i2 = idx ? idx.getX(t + 2) : t + 2;
          _a.fromBufferAttribute(pos as Attribute, i0).applyMatrix4(src.matrixWorld);
          _b.fromBufferAttribute(pos as Attribute, i1).applyMatrix4(src.matrixWorld);
          _c.fromBufferAttribute(pos as Attribute, i2).applyMatrix4(src.matrixWorld);
          const key = cellKey((_a.x + _b.x + _c.x) / 3, (_a.z + _b.z + _c.z) / 3);
          let list = bySide.get(key);
          if (!list) bySide.set(key, (list = []));
          list.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
        }
      }
      src.castShadow = false;
    }

    const firstProxy = new Map<string, Mesh>();
    const addProxy = (mesh: Mesh) => {
      mesh.name = 'ShadowProxy';
      mesh.layers.set(o.shadowProxyLayer);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      mesh.userData.shadowProxy = true;
      const kind = (mesh.material as Material).uuid + ((mesh as InstancedMesh & { isInstancedMesh?: boolean }).isInstancedMesh ? ':i' : ':m');
      const first = firstProxy.get(kind);
      if (first) mesh.userData.sharesPipelineWith = first;
      else firstProxy.set(kind, mesh);
      scene.add(mesh);
      proxies.push(mesh);
    };
    for (const entry of instancedBySig.values()) {
      for (const list of entry.cells.values()) {
        const mesh = new THREE.InstancedMesh(entry.geometry as never, entry.material, list.length / 16);
        (mesh.instanceMatrix.array as Float32Array).set(list);
        mesh.computeBoundingSphere();
        addProxy(mesh);
      }
    }
    for (const [side, bySide] of triCells) {
      for (const list of bySide.values()) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(list, 3));
        g.computeBoundingSphere();
        addProxy(new THREE.Mesh(g, proxyMaterial(side)));
      }
    }
    for (const cam of cams) cam.layers.enable(o.shadowProxyLayer);
  }

  // 3. The remaining large batches: cells for frustum culling, full draw distance (stand-ins above kept their casting).
  for (const mesh of largeMeshes) {
    if (!mesh.castShadow) replaceWithChunks(mesh, o.staticCell);
  }

  return {
    culled,
    proxies,
    update({ x, y, z }) {
      for (const c of culled) {
        const dx = c.x - x; const dy = c.y - y; const dz = c.z - z;
        c.mesh.visible = Math.sqrt(dx * dx + dy * dy + dz * dz) - c.r < c.d;
      }
    },
  };
}
