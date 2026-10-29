// The streamed structures of lane C (vk viaducts and stations, pk street hardware, lk street life): Valdrada's cell
// loader (client/src/cells/cellLoader.js) and decision core (core/streaming/stream.mjs) as the cell streamer of PR #128
// (world/cells/cell-stream.ts) runs them, for packages that arrive from disk instead of from a merged mesh in memory.
//
// #128's streamer cuts geometry it already holds; these cells are Metro assets fetched on demand (asset-bytes*.ts), so
// this module keeps #128's rules and reuses its pieces (cell-rules.ts boxDistance, cell-stream.ts ditherFadeMask):
//   * want: a cell's near level within NEAR_M of its box, its far level out to the preset radius (360 m, the ipad-a12x
//     and phone presets' residentRadiusM), nothing past it;
//   * budget: at most 250k resident vertices of vk/pk/lk (the ipad-a12x cap); a near level that would pass it is not
//     loaded and the far level stays;
//   * build: one package fetched at a time, one cell level built per frame (Valdrada attaches one chunk a frame), nearest
//     first; the shared prototypes and the sign atlas load once, first;
//   * evict with hysteresis (stream.mjs HYSTERESIS 0.8 on the distance, EVICT_AFTER_S 4) and fade in and out with the
//     dither (fadeS 0.5).
// A level is one merged mesh per material slot (cell-package.ts poseCell, as pk/lk merge per key per cell).
//
// The camera comes from the pooled instancer's driver (pool-instancer.ts onCamera): the port's update(timeS) has none.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { boxDistance } from '../../cells/cell-rules.ts';
import { ditherFadeMask } from '../../cells/cell-stream.ts';
import { decodePlacements, decodeProto, poseCell, type CellMeta, type Placement, type Proto, type SlotDesc, type StructureManifest } from './cell-package.ts';

type Mesh = InstanceType<Three['Mesh']>;
type Group = InstanceType<Three['Group']>;
type Material = InstanceType<Three['Material']>;
type Camera = InstanceType<Three['Camera']>;

/** The lane's binary assets (Metro assets on native: asset-bytes.native.ts). */
export interface FurnitureAssets {
  pools(): Promise<ArrayBuffer>;
  panelAtlas(): Promise<ArrayBuffer>;
  cell(key: string): Promise<ArrayBuffer>;
  protos(): Promise<ArrayBuffer>;
  signAtlas(): Promise<ArrayBuffer>;
  pbrAlbedo(): Promise<ArrayBuffer>;
  pbrOrm(): Promise<ArrayBuffer>;
  vkTextures(): Promise<ArrayBuffer>;
}

export const STRUCTURE_LIMITS = {
  /** ipad-a12x / phone residentRadiusM (perf/tier-presets.ts). */
  radiusM: 360,
  /** Resident vk + pk + lk vertices at once (the ipad-a12x cap). */
  maxVertices: 250_000,
  hysteresis: 0.8,
  evictAfterS: 4,
  fadeS: 0.5,
} as const;

interface CellState {
  meta: CellMeta;
  bounds: Float64Array;
  placements: Placement[] | null;
  loading: boolean;
  /** 0 near, 1 far, -1 none. */
  level: -1 | 0 | 1;
  meshes: Mesh[];
  vertices: number;
  unwantedSince: number;
  fade: number;
  fading: -1 | 0 | 1;
}

export interface Structures {
  /** Called with the main camera each frame it draws (the pool driver), and the scene time. */
  frame(camera: Camera, timeS: number): void;
  /** Resident vertices and cells, loads and evictions, for the budget tests and the perf log. */
  stats(): { vertices: number; near: number; far: number; loads: number; evictions: number; pending: number };
  /** Resolves when the shared prototypes and the atlas are in (tests). */
  ready: Promise<void>;
  dispose(): void;
}

export interface StructureOptions {
  manifest: StructureManifest;
  assets: FurnitureAssets;
  group: Group;
  /** Builds the material of a slot (std / pbr / vk families), given the sign atlas bytes. */
  material(desc: SlotDesc, slot: number): Material;
  /** Prepares the materials that need the sign atlas, once it has loaded. */
  onAtlas(bytes: ArrayBuffer): void;
}

export function createStructures(THREE: Three, o: StructureOptions): Structures {
  const { manifest } = o;
  const cells: CellState[] = manifest.cells.map((meta) => ({
    meta, bounds: Float64Array.from(meta.bounds), placements: null, loading: false, level: -1, meshes: [], vertices: 0, unwantedSince: -1, fade: 0, fading: 0,
  }));
  const fileOf = new Map<string, ArrayBuffer>();   // cell key -> its package
  let shared: ArrayBuffer | null = null;
  const protoCache = new Map<number, Proto>();
  const proto = (id: number): Proto => {
    let p = protoCache.get(id);
    if (!p) {
      const meta = manifest.protos[id];
      if (!meta) throw new Error(`vd structures: no prototype ${id}`);
      const buf = meta.file === '' ? shared : fileOf.get(meta.file);
      if (!buf) throw new Error(`vd structures: prototype ${id} before its file`);
      p = decodeProto(buf, meta);
      protoCache.set(id, p);
    }
    return p;
  };
  const materials = new Map<number, Material>();
  const fadeMask = ditherFadeMask(THREE);
  const materialOf = (slot: number) => {
    let m = materials.get(slot);
    if (!m) {
      m = o.material(manifest.slots[slot]!, slot);
      const mm = m as Material & { maskNode?: Node<'bool'> | null };
      mm.maskNode = mm.maskNode ? (mm.maskNode as unknown as { and(n: unknown): Node<'bool'> }).and(fadeMask) : fadeMask;
      materials.set(slot, m);
    }
    return m;
  };
  let vertices = 0, loads = 0, evictions = 0;
  let inflight = 0;
  let lastT = NaN;

  const ready = (async () => {
    const [p, a] = await Promise.all([o.assets.protos(), o.assets.signAtlas()]);
    shared = p;
    o.onAtlas(a);
  })();
  let isReady = false;
  void ready.then(() => { isReady = true; });

  const dropMeshes = (c: CellState) => {
    for (const m of c.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
      m.dispatchEvent({ type: 'dispose' } as never);
    }
    c.meshes = [];
    vertices -= c.vertices;
    c.vertices = 0;
    c.level = -1;
  };
  const build = (c: CellState, level: 0 | 1) => {
    const batches = poseCell(c.placements!, level, proto);
    const meshes: Mesh[] = [];
    let nv = 0;
    for (const b of batches) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(b.position, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(b.normal, 3));
      if (b.uv) g.setAttribute('uv', new THREE.BufferAttribute(b.uv, 2));
      if (b.color) g.setAttribute('color', new THREE.BufferAttribute(b.color, 3));
      for (const [name, a] of Object.entries(b.extras)) {
        const size = manifest.protos.find((p) => p && p.extras.some(([n]) => n === name))?.extras.find(([n]) => n === name)?.[1] ?? 1;
        g.setAttribute(name, new THREE.BufferAttribute(a, size));
      }
      g.setIndex(new THREE.BufferAttribute(b.index, 1));
      const bb = c.meta.bounds;
      g.boundingBox = new THREE.Box3(new THREE.Vector3(bb[0], bb[1], bb[2]), new THREE.Vector3(bb[3], bb[4], bb[5]));
      g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
      const mesh = new THREE.Mesh(g, materialOf(b.slot));
      mesh.name = `vd-structure:${c.meta.key}:${level ? 'far' : 'near'}:${b.slot}`;
      // a vk slot Valdrada draws without a shadow (vk-materials.ts noShadow) does not cast, whatever its pieces said
      mesh.castShadow = b.castShadow && !(manifest.slots[b.slot] as { noShadow?: boolean }).noShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.userData.cellFade = c.fade;
      o.group.add(mesh);
      meshes.push(mesh);
      nv += b.vertices;
    }
    if (c.level >= 0) dropMeshes(c);
    c.meshes = meshes;
    c.vertices = nv;
    vertices += nv;
    c.level = level;
    loads++;
  };
  const levelVerts = (c: CellState, level: 0 | 1) => (level === 0 ? c.meta.near : c.meta.far);

  return {
    ready,
    frame(camera, timeS) {
      if (!isReady) return;
      const dt = Number.isFinite(lastT) ? Math.min(0.1, Math.max(0, timeS - lastT)) : 0;
      lastT = timeS;
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements;
      const cx = e[12]!, cy = e[13]!, cz = e[14]!;
      // the stream's own clock (#128 cell-stream.ts nowS): the frame time, not the wall clock
      const t = timeS;
      // want set, nearest first
      const order = cells.map((c) => ({ c, d: boxDistance(c.bounds, cx, cy, cz) })).sort((a, b) => a.d - b.d);
      let built = false;
      for (const { c, d } of order) {
        const keepNear = c.level === 0 && d <= manifestNear() / STRUCTURE_LIMITS.hysteresis;
        const want: -1 | 0 | 1 = d <= manifestNear() || keepNear ? 0 : d <= STRUCTURE_LIMITS.radiusM ? 1 : (c.level >= 0 && d <= STRUCTURE_LIMITS.radiusM / STRUCTURE_LIMITS.hysteresis ? c.level : -1);
        if (want === c.level) { c.unwantedSince = -1; continue; }
        if (want === -1) {
          if (c.unwantedSince < 0) c.unwantedSince = t;
          else if (t - c.unwantedSince >= STRUCTURE_LIMITS.evictAfterS && c.fading !== -1) c.fading = -1;
          continue;
        }
        c.unwantedSince = -1;
        if (!c.placements) {
          if (!c.loading && inflight === 0) {
            c.loading = true; inflight++;
            void o.assets.cell(c.meta.key).then((buf) => {
              fileOf.set(c.meta.key, buf);
              c.placements = decodePlacements(buf, c.meta, manifest.placementBytes);
            }).catch(() => { /* a cell that fails to load stays out; the pools still draw */ }).finally(() => { c.loading = false; inflight--; });
          }
          continue;
        }
        if (built) continue;
        // budget: a level that would pass the resident cap is not loaded (a near level falls back to far)
        let level: 0 | 1 = want;
        const cur = c.level >= 0 ? c.vertices : 0;
        if (vertices - cur + levelVerts(c, level) > STRUCTURE_LIMITS.maxVertices) {
          if (level === 0 && vertices - cur + levelVerts(c, 1) <= STRUCTURE_LIMITS.maxVertices) level = 1;
          else continue;
          if (level === c.level) continue;
        }
        const fadeIn = c.level < 0;
        build(c, level);
        if (fadeIn) { c.fade = 0; c.fading = 1; }
        built = true;
      }
      // fades
      const step = STRUCTURE_LIMITS.fadeS > 0 ? dt / STRUCTURE_LIMITS.fadeS : 1;
      for (const c of cells) {
        if (c.fading === 0 || c.level < 0) continue;
        c.fade = Math.min(1, Math.max(0, c.fade + c.fading * step));
        for (const m of c.meshes) m.userData.cellFade = c.fade;
        if (c.fading === 1 && c.fade >= 1) c.fading = 0;
        else if (c.fading === -1 && c.fade <= 0) { dropMeshes(c); c.fading = 0; evictions++; }
      }
    },
    stats() {
      return {
        vertices,
        near: cells.filter((c) => c.level === 0).length,
        far: cells.filter((c) => c.level === 1).length,
        loads, evictions,
        pending: cells.filter((c) => c.loading).length,
      };
    },
    dispose() {
      for (const c of cells) if (c.level >= 0) dropMeshes(c);
      for (const m of materials.values()) m.dispose();
      materials.clear();
      protoCache.clear();
    },
  };
  function manifestNear() { return manifest.nearM; }
}
