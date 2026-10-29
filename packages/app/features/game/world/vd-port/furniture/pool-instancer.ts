// The pooled instancer: Valdrada client/src/city/instancer.js on three r186 WebGPU.
//
// What carries over, piece for piece:
//   * one draw per pool (instancer.js: one InstancedMesh per pool), fed from a compact store: only instances whose
//     sphere meets the padded frustum are copied into the draw buffer (pool-cull.ts), on camera moves;
//   * per-pool LOD (setLOD): a pool that ships a coarse level (furnitureKit `def.lod`, the subway stair) draws it past
//     its distance through a second mesh of the same material;
//   * ROOF_LOW: low roof clutter skipped from below the roof plane past 25 m;
//   * the shadow set: pools other than glow and NO_SHADOW cast (shadowSide DoubleSide, materials.ts);
//   * DC29: a pool with nothing in view is hidden, and shown again when it has instances.
//
// What changes for this renderer: no InstancedMesh. three r186 keys an InstancedMesh's render object on its uuid
// (vd-instanced.ts header), so 70 pools would be 70 node builds and pipelines. Each pool is a plain Mesh over an
// InstancedBufferGeometry whose per-instance data is one InstancedInterleavedBuffer of three vec4s (vdPoolA x y z yaw,
// vdPoolB sx sy sz maxScale, vdPoolC r g b 0; 48 bytes a record, vec4-aligned), read by the material's positionNode.
// Every pool of a material kind has the same attribute layout (position, normal, color, uv + the three), so the kind is
// one node build and one pipeline (plus its shadow pipeline) for all its pools.
//
// The draw buffers are written only when the camera has moved (0.5 m or ~1 degree), and only the used range is
// re-uploaded (updateRanges). Static usage: three r186 re-uploads a DynamicDrawUsage buffer on every frame it draws.
//
// Culling needs the camera, which the port's update(timeS) does not carry: one always-drawn pool mesh (the driver,
// never hidden) runs the cull from its onBeforeRender for every pool when the main (perspective) camera draws it. The
// shadow pass's orthographic camera is ignored, so casters are the main view's set (Valdrada keeps a second set inside
// the near shadow box; this port does not, see the lane C report).
import type { Three } from '@acme/ui/three';
import { decodeGeometry, decodeInstances, INSTANCE_FLOATS, type PackedGeometry, type PackedPool } from './pool-data.ts';
import { cullPool, indexCells, PAD_MAIN, type CellIndex, type CullView } from './pool-cull.ts';
import { createPoolMaterials, VD_POOL_ATTRIBUTES, type PoolMaterials } from './materials.ts';
import type { Node } from 'three/webgpu';

type Mesh = InstanceType<Three['Mesh']>;
type Group = InstanceType<Three['Group']>;
type Texture = InstanceType<Three['Texture']>;
type BufferGeometry = InstanceType<Three['BufferGeometry']>;
type InstancedGeometry = InstanceType<Three['InstancedBufferGeometry']>;
type Interleaved = InstanceType<Three['InstancedInterleavedBuffer']>;
type Camera = InstanceType<Three['Camera']>;

export interface PoolInstancerInput {
  pools: readonly PackedPool[];
  geometry: Readonly<Record<string, PackedGeometry>>;
  lod: Readonly<Record<string, { distance: number; geometry: PackedGeometry }>>;
  groundY(x: number, z: number): number;
  night: Node<'float'>;
  physical: boolean;
  atlas: Texture;
}

interface Draw {
  mesh: Mesh;
  geometry: InstancedGeometry;
  buffer: Interleaved;
  array: Float32Array;
  count: number;
}
interface Pool {
  name: string;
  index: CellIndex;
  roofLow: boolean;
  lodDistance: number;
  main: Draw;
  far: Draw | null;
}

export interface PoolInstancer {
  /** Every pool mesh (main and LOD), already in `group`. */
  meshes: Mesh[];
  /** Instances per pool, as baked. */
  counts: Readonly<Record<string, number>>;
  /** Runs the cull for a camera now (the driver does this on its own each frame the main camera draws). */
  cull(camera: Camera): void;
  /** Instances drawn after the last cull. */
  drawn(): number;
  materials: PoolMaterials;
  dispose(): void;
}

function baseGeometry(THREE: Three, g: PackedGeometry): BufferGeometry {
  const d = decodeGeometry(g);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(d.position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(d.normal, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(d.color, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
  geo.setIndex(new THREE.BufferAttribute(d.index, 1));
  return geo;
}

function makeDraw(THREE: Three, base: BufferGeometry, capacity: number, material: InstanceType<Three['Material']>, name: string): Draw {
  const geometry = new THREE.InstancedBufferGeometry();
  for (const [k, a] of Object.entries(base.attributes)) geometry.setAttribute(k, a as Parameters<InstancedGeometry['setAttribute']>[1]);
  geometry.setIndex(base.index);
  const array = new Float32Array(Math.max(1, capacity) * INSTANCE_FLOATS);
  const buffer = new THREE.InstancedInterleavedBuffer(array, INSTANCE_FLOATS, 1);
  VD_POOL_ATTRIBUTES.forEach((attr, i) => geometry.setAttribute(attr, new THREE.InterleavedBufferAttribute(buffer, 4, i * 4)));
  geometry.instanceCount = 0;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;       // the pool culls its own instances
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;             // shown by the first cull that finds instances
  return { mesh, geometry, buffer, array, count: 0 };
}

export function createPoolInstancer(THREE: Three, group: Group, input: PoolInstancerInput): PoolInstancer {
  const materials = createPoolMaterials(THREE, input.night, input.physical, input.atlas);
  const pools: Pool[] = [];
  const meshes: Mesh[] = [];
  const counts: Record<string, number> = {};
  const bases: BufferGeometry[] = [];
  for (const p of input.pools) {
    const g = input.geometry[p.name];
    if (!g || p.count === 0) continue;
    const inst = decodeInstances(p, input.groundY);
    const index = indexCells(inst.record, inst.count, g.radius);
    const material = materials.get(p.material);
    const base = baseGeometry(THREE, g);
    bases.push(base);
    const main = makeDraw(THREE, base, inst.count, material, `vd-pool:${p.name}`);
    main.mesh.castShadow = p.shadow;
    main.mesh.receiveShadow = true;
    const lod = input.lod[p.name];
    let far: Draw | null = null;
    if (lod) {
      const lb = baseGeometry(THREE, lod.geometry);
      bases.push(lb);
      far = makeDraw(THREE, lb, inst.count, material, `vd-pool:${p.name}:lod`);
      far.mesh.castShadow = p.shadow;
      far.mesh.receiveShadow = true;
    }
    pools.push({ name: p.name, index, roofLow: p.roofLow, lodDistance: lod ? lod.distance : Infinity, main, far });
    counts[p.name] = inst.count;
    meshes.push(main.mesh);
    if (far) meshes.push(far.mesh);
  }
  for (const m of meshes) group.add(m);

  const frustum = new THREE.Frustum();
  const pv = new THREE.Matrix4();
  const planes = new Float32Array(24);
  const view: CullView = { planes, x: 0, y: 0, z: 0 };
  const last = { x: NaN, y: NaN, z: NaN, dx: NaN, dy: NaN, dz: NaN };
  const dir = new THREE.Vector3();
  let drawnTotal = 0;

  const commit = (d: Draw, n: number) => {
    d.count = n;
    d.geometry.instanceCount = n;
    if (n > 0) {
      d.buffer.clearUpdateRanges();
      d.buffer.addUpdateRange(0, n * INSTANCE_FLOATS);
      d.buffer.needsUpdate = true;
    }
  };
  const cull = (camera: Camera) => {
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    camera.getWorldDirection(dir);
    const moved = !(Math.abs(e[12]! - last.x) < 0.5 && Math.abs(e[13]! - last.y) < 0.5 && Math.abs(e[14]! - last.z) < 0.5
      && dir.x * last.dx + dir.y * last.dy + dir.z * last.dz > 0.99985);
    if (!moved) return;
    last.x = e[12]!; last.y = e[13]!; last.z = e[14]!; last.dx = dir.x; last.dy = dir.y; last.dz = dir.z;
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    for (let i = 0; i < 6; i++) {
      const p = frustum.planes[i]!;
      planes[i * 4] = p.normal.x; planes[i * 4 + 1] = p.normal.y; planes[i * 4 + 2] = p.normal.z; planes[i * 4 + 3] = p.constant;
    }
    view.x = e[12]!; view.y = e[13]!; view.z = e[14]!;
    drawnTotal = 0;
    for (const p of pools) {
      const [n, f] = cullPool(p.index, view, { pad: PAD_MAIN, roofLow: p.roofLow, lodDistance: p.lodDistance }, p.main.array, p.far ? p.far.array : null);
      commit(p.main, n);
      if (p.far) commit(p.far, f);
      drawnTotal += n + f;
      // DC29: hidden at count 0 (the driver stays visible: it runs this)
      p.main.mesh.visible = n > 0 || p.main.mesh === driver;
      if (p.far) p.far.mesh.visible = f > 0;
    }
  };
  // The driver: the most populous street pool (lamp poles in practice) stays visible so its onBeforeRender always runs.
  const driverPool = pools.reduce<Pool | null>((best, p) => (!p.roofLow && (!best || p.index.count > best.index.count) ? p : best), null);
  const driver = driverPool ? driverPool.main.mesh : null;
  if (driver) {
    driver.visible = true;
    driver.onBeforeRender = (_r: unknown, _s: unknown, camera: Camera) => {
      if ((camera as { isPerspectiveCamera?: boolean }).isPerspectiveCamera) cull(camera);
    };
  }

  return {
    meshes,
    counts,
    cull,
    drawn: () => drawnTotal,
    materials,
    dispose() {
      for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); }
      for (const b of bases) b.dispose();
      materials.dispose();
    },
  };
}
