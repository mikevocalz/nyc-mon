// The streamed structures of lane C (vk viaducts and stations, pk street hardware, lk street life): Valdrada's cell
// loader (client/src/cells/cellLoader.js) as a package source for the cell streamer of PR #128 (world/cells/cell-stream.ts),
// which owns the streaming rules and the budget for every layer, this one's included:
//   * a package is one cell level's merged geometry in one material slot (cell-package.ts poseCell, as pk/lk merge per
//     key per cell); its size comes from the manifest's table (tooling structure-slots.mjs), its bytes from the cell's
//     Metro asset, fetched when the streamer first wants it or a package within one cell of its reach (the prefetch
//     ring), one cell file at a time;
//   * a layer per (level, slot, casts): the slot's material, which carries the streamer's dither itself and is shared by
//     the slot's layers; the near level within the manifest's NEAR_M of a cell's box, the far level out to the preset's
//     resident radius (360 m on the iPad and phone presets), by distance as Valdrada's stream.mjs wants them;
//   * one budget for all of the lane's layers: the preset's resident vertex cap (250k on the iPad tier). A cell level's
//     packages form one group (CellPackage.group): it starts only if all of it fits, so a level the budget refuses
//     leaves the far level drawn and never half a near level over it;
//   * near replaces far: a cell's far meshes hide while every one of its near packages is resident and faded in
//     (Valdrada's near mask, as the blocks' shells do: vd-port/blocks), and its far packages are then unwanted
//     (CellPackage.suppressed), so they leave and give the budget back; as the near level fades out the far is wanted
//     again and builds from the cell file already in memory.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import type { CellAttribute, CellPackage } from '../../cells/cell-rules.ts';
import { ditherFadeMask } from '../../cells/cell-stream.ts';
import type { VdLayerBudget, VdStreamLayer } from '../types.ts';
import { decodePlacements, decodeProto, poseCell, type CellMeta, type Placement, type Proto, type SlotDesc, type StructureManifest } from './cell-package.ts';

type Mesh = InstanceType<Three['Mesh']>;
type Group = InstanceType<Three['Group']>;
type Material = InstanceType<Three['Material']>;

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
} as const;

export const STRUCTURE_NAME = 'vd-structure';

export interface Structures {
  /** Resolves when the shared prototypes, the atlas and the textures are in and the layers are registered. */
  ready: Promise<void>;
  /** Once a frame: the near mask, and the counts below. */
  update(): void;
  /** Resident vertices, cells with a near or far level drawn, cell files on their way. */
  stats(): { vertices: number; near: number; far: number; pending: number };
  dispose(): void;
}

export interface StructureOptions {
  manifest: StructureManifest;
  /** The preset's radius and vertex cap; STRUCTURE_LIMITS (the ipad-a12x row) when absent. */
  limits?: { radiusM: number; maxVertices: number };
  assets: FurnitureAssets;
  group: Group;
  /** Builds the material of a slot (std / pbr / vk families), once the textures are in. */
  material(desc: SlotDesc, slot: number): Material;
  /** Prepares the materials that need the sign atlas, once it has loaded. */
  onAtlas(bytes: ArrayBuffer): void;
  /** Hands a layer to the cell streamer (VdPortCtx.registerChunks). */
  register(template: Mesh, layer: VdStreamLayer, packages: readonly CellPackage[], budget: VdLayerBudget): void;
}

interface CellSource {
  meta: CellMeta;
  num: number;
  placements: Placement[] | null;
  queued: boolean;
  /** The group keys of its near and far packages. */
  groups: [object, object];
  /** Near packages in the cell (the near mask's count). */
  nearPackages: number;
}

export function createStructures(THREE: Three, o: StructureOptions): Structures {
  const { manifest } = o;
  const radiusM = o.limits?.radiusM ?? STRUCTURE_LIMITS.radiusM;
  const budget: VdLayerBudget = {
    name: 'structures',
    // Valdrada's structures carry a vertex cap only (the old private streamer's one rule)
    geometryBytes: Number.POSITIVE_INFINITY, cellDraws: Number.POSITIVE_INFINITY, triangles: Number.POSITIVE_INFINITY,
    vertices: o.limits?.maxVertices ?? STRUCTURE_LIMITS.maxVertices,
  };
  const sources: CellSource[] = manifest.cells.map((meta, num) => ({ meta, num, placements: null, queued: false, groups: [{}, {}], nearPackages: 0 }));
  const fileOf = new Map<string, ArrayBuffer>();   // cell key -> its file (its own prototypes and placements)
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
  let disposed = false;

  // Cell files, one in flight at a time (cellLoader.js fetches one chunk at a time). ponytail: first asked, first
  // fetched; order the queue by distance if a walk ever waits on a far cell's file.
  const queue: CellSource[] = [];
  let inflight = 0;
  const pump = () => {
    while (inflight === 0 && queue.length > 0 && !disposed) {
      const c = queue.shift()!;
      inflight++;
      void o.assets.cell(c.meta.key).then((buf) => {
        fileOf.set(c.meta.key, buf);
        c.placements = decodePlacements(buf, c.meta, manifest.placementBytes);
      }).catch(() => { /* a cell that fails to load stays out (queued, so never asked again); the pools still draw */ })
        .finally(() => { inflight--; pump(); });
    }
  };
  const request = (c: CellSource) => {
    if (c.placements || c.queued) return;
    c.queued = true;
    queue.push(c);
    pump();
  };

  // One attribute set for every package (the union of the prototypes' layouts: uv, colour and the vk extras), zeros
  // (white for colour) where a slot has none: three's render-pipeline key lists a geometry's attributes, so one material
  // over two layouts builds two pipelines. A material reads only what its graph uses, so the padding changes no pixel.
  const extrasUnion: [string, number][] = [];
  for (const p of manifest.protos) for (const [n, size] of p?.extras ?? []) if (!extrasUnion.some(([m]) => m === n)) extrasUnion.push([n, size]);
  const vertexBytes = 12 + 12 + 8 + 12 + extrasUnion.reduce((a, [, size]) => a + size * 4, 0);
  const layout = (n: number, b: ReturnType<typeof poseCell>[number] | null): Record<string, CellAttribute> => {
    const attrs: Record<string, CellAttribute> = {
      position: { array: b?.position ?? new Float32Array(n * 3), itemSize: 3, normalized: false },
      normal: { array: b?.normal ?? new Float32Array(n * 3), itemSize: 3, normalized: false },
      uv: { array: b?.uv ?? new Float32Array(n * 2), itemSize: 2, normalized: false },
      color: { array: b?.color ?? new Float32Array(n * 3).fill(1), itemSize: 3, normalized: false },
    };
    for (const [name, size] of extrasUnion) attrs[name] = { array: b?.extras[name] ?? new Float32Array(n * size), itemSize: size, normalized: false };
    return attrs;
  };

  // cells whose near level is all in (update): their far packages are suppressed
  const nearComplete = new Set<number>();
  const packageOf = (src: CellSource, level: 0 | 1, slot: number, vertices: number, indices: number): CellPackage => {
    let posed: ReturnType<typeof poseCell>[number] | null = null;
    const pose = () => {
      if (!posed) {
        if (!src.placements) throw new Error(`vd structures: cell ${src.meta.key} built before its file`);
        const mine = src.placements.filter((p) => p.lod === level && proto(p.proto).meta.slot === slot);
        posed = poseCell(mine, level, proto)[0] ?? null;
        if (!posed) throw new Error(`vd structures: cell ${src.meta.key} level ${level} has no slot ${slot}`);
      }
      return posed;
    };
    const [cx, cz] = src.meta.key.split('_').map(Number) as [number, number];
    return {
      cx, cz, num: src.num, size: manifest.cell,
      get attributes() { return layout(vertices, pose()); },
      get index() { return pose().index; },
      vertexCount: vertices,
      triangles: indices / 3,
      bounds: Float64Array.from(src.meta.bounds),
      bytes: vertices * vertexBytes + indices * 4,
      release() { posed = null; },
      ready: () => src.placements !== null,
      prefetch: () => request(src),
      group: src.groups[level],
      ...(level === 1 ? { suppressed: () => nearComplete.has(src.num) } : {}),
    };
  };

  const materials = new Map<number, Material>();
  const templates: Mesh[] = [];
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

  const register = () => {
    const layers = new Map<string, { level: 0 | 1; slot: number; cast: boolean; packages: CellPackage[] }>();
    for (const src of sources) {
      const t = src.meta.slots;
      for (let i = 0; i + 4 < t.length; i += 5) {
        const level = t[i] as 0 | 1, slot = t[i + 1]!, cast = t[i + 2] === 1;
        const key = `${level}:${slot}:${cast ? 1 : 0}`;
        let l = layers.get(key);
        if (!l) layers.set(key, (l = { level, slot, cast, packages: [] }));
        l.packages.push(packageOf(src, level, slot, t[i + 3]!, t[i + 4]!));
        if (level === 0) src.nearPackages++;
      }
    }
    for (const l of layers.values()) {
      const g = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(layout(3, null))) g.setAttribute(name, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array([0, 1, 2]), 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
      g.userData = { keepCpuArrays: true };
      const t = new THREE.Mesh(g, materialOf(l.slot));
      t.name = `${STRUCTURE_NAME}:${l.level ? 'far' : 'near'}:${l.slot}`;
      // a vk slot Valdrada draws without a shadow (vk-materials.ts noShadow) does not cast, whatever its pieces said
      t.castShadow = l.cast && !(manifest.slots[l.slot] as { noShadow?: boolean }).noShadow;
      t.receiveShadow = true;
      t.matrixAutoUpdate = false;
      t.userData = { vdStructure: l.level };
      // hidden until the streamer warms it on the layer's first build (warmOnBuild)
      t.visible = false;
      o.group.add(t);
      templates.push(t);
      o.register(t, {
        errorM: 0, chunk: manifest.cell, fade: true, pin: false, sharedMaterial: true, warmOnBuild: true,
        reachM: l.level === 0 ? manifest.nearM : radiusM,
      }, l.packages, budget);
    }
  };

  const ready = (async () => {
    const [p, a] = await Promise.all([o.assets.protos(), o.assets.signAtlas()]);
    if (disposed) return;
    shared = p;
    o.onAtlas(a);
    register();
  })();

  // the near mask and the counts; allocation-free per frame
  const nearIn = new Map<number, number>();
  const counts = { vertices: 0, near: 0, far: 0 };
  const nearCells = new Set<number>(), farCells = new Set<number>();
  return {
    ready,
    update() {
      nearIn.clear(); nearCells.clear(); farCells.clear();
      let vertices = 0;
      const kids = o.group.children;
      for (const m of kids) {
        const ud = m.userData as { vdStructure?: number; cell?: number; cellFade?: number };
        if (ud.vdStructure === undefined || ud.cell === undefined) continue;
        vertices += (m as Mesh).geometry.getAttribute('position').count;
        if (ud.vdStructure === 0) {
          nearCells.add(ud.cell);
          if ((ud.cellFade ?? 1) >= 1) nearIn.set(ud.cell, (nearIn.get(ud.cell) ?? 0) + 1);
        } else farCells.add(ud.cell);
      }
      nearComplete.clear();
      for (const [num, n] of nearIn) if (n === sources[num]!.nearPackages) nearComplete.add(num);
      for (const m of kids) {
        const ud = m.userData as { vdStructure?: number; cell?: number };
        if (ud.vdStructure !== 1 || ud.cell === undefined) continue;
        m.visible = !nearComplete.has(ud.cell);
      }
      counts.vertices = vertices; counts.near = nearCells.size; counts.far = farCells.size;
    },
    stats() {
      return { ...counts, pending: queue.length + inflight };
    },
    dispose() {
      disposed = true;
      queue.length = 0;
      for (const t of templates) { t.removeFromParent(); t.geometry.dispose(); }
      templates.length = 0;
      for (const m of materials.values()) m.dispose();
      materials.clear();
      protoCache.clear();
      fileOf.clear();
    },
  };
}
