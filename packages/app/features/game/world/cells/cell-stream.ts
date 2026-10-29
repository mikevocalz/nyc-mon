// Cell streaming for the bundled tile, after Valdrada's cell loader
// (client/src/cells/cellLoader.js) and decision core
// (core/streaming/stream.mjs). The tile is still baked once on the CPU
// (city-mesh.ts); this module then:
//
//  1. Packages. Each streamed layer's merged geometry is cut into chunks
//     by triangle plan centroid (cell-rules.ts) and the full-tile geometry
//     is dropped before it ever reaches the GPU. The shells and the ground
//     stay whole: the persistent tier (CELL_LAYERS).
//  2. Picks the want set. A layer's cell is wanted while its screen-space
//     error, geometricError * K / boxDistance(camera), is at least the
//     preset's threshold and the box lies within the preset's resident
//     radius (Valdrada stream.mjs, sse = err * K / max(1, boxDist)). A layer's
//     geometric error is the size of the smallest feature it carries
//     (CELL_LAYERS), so street detail leaves long before the walls do.
//  3. Builds the requests nearest first, a few milliseconds and a few MB of
//     vertex data per frame (Valdrada attaches one chunk a frame), and never
//     past the preset's byte, draw and triangle budgets.
//  4. Evicts with hysteresis: a resident cell stays while its error holds
//     above `hysteresis` x the threshold and it is within one cell of the
//     radius, and leaves only after `evictAfterS` seconds unwanted (Valdrada
//     HYSTERESIS 0.8, EVICT_AFTER_S 4). Eviction disposes the geometry (its
//     GPU buffers) and the mesh's render objects (bindings, node state, the
//     pipeline's use count). Materials are the layer's shared live ones and
//     are never disposed here, as in Valdrada.
//  5. Fades the layers in and out with Valdrada's dither (shellMaterial.js:
//     interleaved gradient noise against a per-object fade, discard where it
//     loses), so detail rises in over `fadeS` instead of popping.
//
// Landmark cells are pinned: never evicted, loaded at prime.
//
// Shader warm-up (Valdrada compiles every program before the first draw and
// shares one material per kind across cells). Each layer keeps its source
// mesh in the scene as a template over a one-triangle geometry with the same
// attribute layout and material. The START compile (load-game-scene.ts
// compileAsync) builds the template's pipeline, so a cell streamed in later
// draws through a pipeline that already exists; the template then hides, but
// its render object keeps that pipeline alive when every cell of the layer
// has been evicted. Scene passes that set per-object state by name (shadow
// roles) reach the template, and new cells copy it.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import type { WorldPreset } from '../../perf/tier-presets.ts';
import { boxDistance, CELL, splitByCell, splittable, type CellPackage } from './cell-rules.ts';

type Mesh = InstanceType<Three['Mesh']>;
type Material = InstanceType<Three['Material']>;

/**
 * Per streamed layer: geometric error (metres, the smallest feature it carries), the chunk edge it is packaged at
 * (Valdrada's chunk sizes are CELL * 2^n, cell-package.md §12) and whether it fades. Layers not listed stay whole.
 *
 * The ground and the building shells (areas, sidewalks, roads, walls, roofs, neon, billboards) are not listed: they
 * are the persistent tier, Valdrada's never-evicted L6 shells. This city has no simplified far shell to fall back to,
 * and on the physical stack the aerial fog is thin (FogExp2 0.00024 / m, about 2 % at 640 m), so an evicted shell
 * would leave a visible edge where the street ends. The near detail carries the bulk of the bytes (street detail,
 * facelift, contact shadows and road paint are about 77 of the bake's 120 MB) and its features fall under the
 * threshold well inside the radius, so it streams without a seam. 256 m chunks: at 128 m the same reach cost about
 * twice the draws on the walk for a few MB less residency.
 */
export const CELL_LAYERS: Readonly<Record<string, { errorM: number; chunk: number; fade: boolean; pin?: boolean }>> = {
  // Stoops, awnings, parapets, roof AC and chimney pots, NYCHA panels.
  'city:street-detail': { errorM: 0.25, chunk: 2 * CELL, fade: true },
  // The facelift's panels, balconies and light strips on the walls.
  'city:facelift': { errorM: 0.3, chunk: 2 * CELL, fade: true },
  // Lane and crossing markings.
  'physical:road-paint': { errorM: 0.3, chunk: 2 * CELL, fade: true },
  // The soft contact strips at the foot of the walls (city-mesh.ts drew them only within SHADOW_RADIUS 160 m).
  'city:contact-shadows': { errorM: 0.2, chunk: 2 * CELL, fade: true },
};

/** Where Valdrada's dither keeps a pixel: interleaved gradient noise over the fragment coordinate. */
export function ditherFadeMask(THREE: Three): Node<'bool'> {
  const T = THREE.TSL;
  const fade = T.uniform(1).onObjectUpdate(({ object }) => {
    const f = (object?.userData as { cellFade?: number } | undefined)?.cellFade;
    return f === undefined ? 1 : f;
  });
  const xy = T.screenCoordinate.xy;
  const ign = T.fract(T.fract(T.dot(xy, T.vec2(0.06711056, 0.00583715))).mul(52.9829189));
  return ign.lessThan(fade) as unknown as Node<'bool'>;
}

export interface CellStreamStats {
  /** Resident cell meshes (fading ones included). */
  cells: number;
  /** Vertex bytes of the resident cell meshes. */
  bytes: number;
  triangles: number;
  /** Cumulative loads and evictions. */
  loads: number;
  evictions: number;
  /** Cell builds this frame, and their JS milliseconds. */
  builtThisFrame: number;
  buildMsThisFrame: number;
  /** Longest single cell build so far, ms. */
  maxBuildMs: number;
  /** Wanted cells not yet built. */
  pending: number;
  /** Loads refused because a budget was full. */
  overBudget: number;
  /**
   * The layers held to their own budget (ExternalLayer.budget: the vd port's blocks): what they hold resident and the
   * loads their budget refused. cells, bytes, triangles and overBudget above include them; the preset's budget does not.
   */
  own: { cells: number; bytes: number; triangles: number; overBudget: number };
  /** The same, per named budget (ExternalLayer.budget.name: the blocks' near level, lane C's structures). */
  budgets: Record<string, { cells: number; bytes: number; triangles: number; vertices: number; overBudget: number }>;
  /** Wanted packages whose bytes are still on their way (CellPackage.ready). */
  fetching: number;
  /** Packaged cells per layer, and their total bytes (the CPU store). */
  packages: number;
  packageBytes: number;
}

export interface CellStream {
  readonly stats: Readonly<CellStreamStats>;
  /**
   * The START set: builds every wanted cell within `startRadius` of the camera now, synchronously (Valdrada's
   * cells within the start position's ring), and pinned cells. The rest stream over the next frames.
   */
  prime(camera: Vec3, k: number, startRadius: number): void;
  /** One frame: re-picks the want set when the camera moved or a moment passed, builds, evicts, fades. True while work is left. */
  update(camera: Vec3, k: number, nowS: number): boolean;
  /**
   * Adds an external layer after the streamer was made (a part whose materials wait for assets: world/vd-port/furniture).
   * Its template is warmed on its first build if its spec says so, else on the next update.
   */
  addExternal(ext: ExternalLayer): void;
  /** Every cell mesh and any material cloned for the fade; packages are dropped. */
  dispose(): void;
}

export interface Vec3 { x: number; y: number; z: number }

export interface CellStreamOptions {
  preset: WorldPreset;
  /**
   * Chunks never evicted, by their ground square: x in [x0, x0 + size), z in [z0, z0 + size). A layer whose spec says
   * `pin: false` (streamed detail around a landmark: storefronts, furniture) is never pinned and evicts like any other.
   */
  pinned?: (x0: number, z0: number, size: number) => boolean;
  /** Stage timing lines (EXPO_PUBLIC_GAME_PERF), or undefined for none. */
  log?: (line: string, data: Record<string, unknown>) => void;
  now?: () => number;
  /**
   * Layers whose packages arrive already cut (world/vd-port): the template mesh (in the scene, its material and attribute
   * layout, one triangle) and the packages, which may be indexed and decode lazily (CellPackage). A layer with `budget`
   * is held to it and kept out of the preset's budget, so it can neither starve the near-detail layers nor be starved.
   */
  external?: readonly ExternalLayer[];
}

export interface ExternalLayer {
  template: Mesh;
  /**
   * sharedMaterial: the template's material is shared and carries the dither already: no clone, no second mask.
   * reachM: wanted within this distance of the cell's box (kept to reachM / hysteresis), in place of the screen-error rule
   * (Valdrada's structures stream by distance: stream.mjs NEAR_M and the resident radius).
   * warmOnBuild: the template draws for two frames when the layer's first cell builds, not at the START compile (a
   * layer that may never build keeps its pipelines unbuilt).
   */
  spec: { errorM: number; chunk: number; fade: boolean; pin?: boolean; sharedMaterial?: boolean; reachM?: number; warmOnBuild?: boolean };
  packages: readonly CellPackage[];
  /**
   * The layer's own budget, outside the preset's. Layers handed the same budget object share it (one budget for all of
   * lane C's material layers); `vertices` caps resident vertices where given; `name` keys stats.budgets.
   */
  budget?: ExternalBudget;
}

export interface ExternalBudget {
  readonly name?: string;
  readonly geometryBytes: number;
  readonly cellDraws: number;
  readonly triangles: number;
  readonly vertices?: number;
}

interface Held { bytes: number; triangles: number; vertices: number; cells: number; overBudget: number }

interface Slot {
  readonly pkg: CellPackage;
  readonly layer: Layer;
  readonly pinned: boolean;
  mesh: Mesh | null;
  fade: number;
  /** 1 rising, -1 leaving, 0 still. */
  fading: -1 | 0 | 1;
  unwantedSince: number;
  distance: number;
}

interface Layer {
  readonly name: string;
  readonly template: Mesh;
  readonly material: Material;
  readonly errorM: number;
  readonly fade: boolean;
  /** The fade mask went on a clone of the source material, which this module then owns. */
  readonly cloned: boolean;
  readonly slots: Slot[];
  /** An external layer's own budget, and what it (and every layer sharing that budget) holds resident. */
  readonly budget: ExternalBudget | null;
  readonly held: Held;
  readonly reachM: number | null;
  readonly chunk: number;
  /** Updates left with the template drawn; -1: hidden and done, -2: waiting for its first build (warmOnBuild). */
  templateFrames: number;
}

const triangleCount = (pkg: CellPackage) => pkg.triangles ?? pkg.vertexCount / 3;

/**
 * Packages `meshes` (those named in CELL_LAYERS whose geometry splitByCell can cut) and returns the streamer. Meshes it
 * does not take are left as they are. Call before any frame draws: the source geometry is disposed unuploaded.
 */
export function createCellStream(THREE: Three, meshes: readonly Mesh[], options: CellStreamOptions): CellStream {
  const preset = options.preset;
  const now = options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const log = options.log;
  const layers: Layer[] = [];
  const slots: Slot[] = [];
  // The fade mask goes on a layer's own material; a material another mesh also draws with is cloned first, so the
  // dither (a discard, which costs the shared surface its early depth test) stays on the near layers.
  const users = new Map<Material, number>();
  const root = meshes[0]?.parent ?? null;
  root?.traverse((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) users.set(x, (users.get(x) ?? 0) + 1);
  });
  const stats: CellStreamStats = {
    cells: 0, bytes: 0, triangles: 0, loads: 0, evictions: 0, builtThisFrame: 0, buildMsThisFrame: 0, maxBuildMs: 0,
    pending: 0, overBudget: 0, packages: 0, packageBytes: 0, own: { cells: 0, bytes: 0, triangles: 0, overBudget: 0 },
    budgets: {}, fetching: 0,
  };
  const heldOf = new Map<ExternalBudget, Held>();
  const heldFor = (budget: ExternalBudget | null): Held => {
    if (!budget) return { bytes: 0, triangles: 0, vertices: 0, cells: 0, overBudget: 0 };
    let h = heldOf.get(budget);
    if (!h) {
      heldOf.set(budget, (h = { bytes: 0, triangles: 0, vertices: 0, cells: 0, overBudget: 0 }));
      if (budget.name) stats.budgets[budget.name] = h;
    }
    return h;
  };
  const t0 = now();
  for (const mesh of meshes) {
    // A vd-port mesh carries its own layer (world/vd-port/types.ts VdStreamLayer).
    const spec = CELL_LAYERS[mesh.name] ?? (mesh.userData.cellLayer as (typeof CELL_LAYERS)[string] | undefined);
    if (!spec || Array.isArray(mesh.material) || !splittable(mesh.geometry)) continue;
    const packages = splitByCell(mesh.geometry, spec.chunk);
    let material = mesh.material as Material;
    let cloned = false;
    if (spec.fade) {
      if ((users.get(material) ?? 0) > 1) { material = material.clone(); cloned = true; }
      const m = material as Material & { maskNode?: Node<'bool'> | null };
      const dither = ditherFadeMask(THREE);
      m.maskNode = (m.maskNode ? (m.maskNode as unknown as { and(n: unknown): Node<'bool'> }).and(dither) : dither);
      m.needsUpdate = true;
    }
    // The template: same material and attribute layout, one zero-area triangle.
    const source = mesh.geometry;
    const template = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(source.attributes)) {
      const attr = a as InstanceType<Three['BufferAttribute']>;
      const Ctor = attr.array.constructor as new (n: number) => Float32Array;
      template.setAttribute(name, new THREE.BufferAttribute(new Ctor(3 * attr.itemSize), attr.itemSize, attr.normalized));
    }
    template.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    template.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
    template.userData = { keepCpuArrays: true };
    mesh.geometry = template;
    mesh.material = material;
    mesh.frustumCulled = false;
    source.dispose();
    const layer: Layer = {
      name: mesh.name, template: mesh, material, errorM: spec.errorM, fade: spec.fade, cloned, slots: [], budget: null, held: heldFor(null),
      reachM: null, chunk: spec.chunk, templateFrames: 2,
    };
    for (const pkg of packages) {
      const slot: Slot = {
        pkg, layer, pinned: spec.pin !== false && (options.pinned?.(pkg.cx * pkg.size, pkg.cz * pkg.size, pkg.size) ?? false), mesh: null, fade: 0, fading: 0, unwantedSince: -1, distance: Infinity,
      };
      layer.slots.push(slot);
      slots.push(slot);
      stats.packages++;
      stats.packageBytes += pkg.bytes;
    }
    layers.push(layer);
  }
  // External layers: already cut, their template already in the scene.
  const addExternal = (ext: ExternalLayer) => {
    const mesh = ext.template;
    let material = mesh.material as Material;
    let cloned = false;
    if (ext.spec.fade && !ext.spec.sharedMaterial) {
      if ((users.get(material) ?? 0) > 1) { material = material.clone(); cloned = true; }
      const m = material as Material & { maskNode?: Node<'bool'> | null };
      const dither = ditherFadeMask(THREE);
      m.maskNode = (m.maskNode ? (m.maskNode as unknown as { and(n: unknown): Node<'bool'> }).and(dither) : dither);
      m.needsUpdate = true;
      mesh.material = material;
    }
    mesh.frustumCulled = false;
    const warmOnBuild = ext.spec.warmOnBuild === true;
    if (warmOnBuild) mesh.visible = false;
    const layer: Layer = {
      name: mesh.name, template: mesh, material, errorM: ext.spec.errorM, fade: ext.spec.fade, cloned, slots: [],
      budget: ext.budget ?? null, held: heldFor(ext.budget ?? null), reachM: ext.spec.reachM ?? null, chunk: ext.spec.chunk,
      templateFrames: warmOnBuild ? -2 : 2,
    };
    for (const pkg of ext.packages) {
      const slot: Slot = {
        pkg, layer, pinned: ext.spec.pin !== false && (options.pinned?.(pkg.cx * pkg.size, pkg.cz * pkg.size, pkg.size) ?? false), mesh: null, fade: 0, fading: 0, unwantedSince: -1, distance: Infinity,
      };
      layer.slots.push(slot);
      slots.push(slot);
      if (pkg.group) { const g = groups.get(pkg.group); if (g) g.push(slot); else groups.set(pkg.group, [slot]); }
      stats.packages++;
      stats.packageBytes += pkg.bytes;
    }
    layers.push(layer);
  };
  for (const ext of options.external ?? []) addExternal(ext);
  // What the budgeted (external) layers hold, kept out of the preset's budget.
  const own = stats.own;
  log?.('packaged', {
    layers: layers.length, packages: stats.packages, mb: +(stats.packageBytes / 1e6).toFixed(1), ms: +(now() - t0).toFixed(1),
  });

  function refuse(slot: Slot) {
    stats.overBudget++;
    if (slot.layer.budget) { own.overBudget++; slot.layer.held.overBudget++; }
  }

  function hold(layer: Layer, pkg: CellPackage, sign: 1 | -1) {
    const t = triangleCount(pkg);
    const h = layer.held;
    h.bytes += sign * pkg.bytes; h.triangles += sign * t; h.vertices += sign * pkg.vertexCount; h.cells += sign;
    if (layer.budget) { own.bytes += sign * pkg.bytes; own.triangles += sign * t; own.cells += sign; }
  }

  const build = (slot: Slot, fadeIn: boolean) => {
    const start = now();
    const { pkg, layer } = slot;
    const geometry = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(pkg.attributes)) {
      geometry.setAttribute(name, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized));
    }
    if (pkg.index) geometry.setIndex(new THREE.BufferAttribute(pkg.index, 1));
    const b = pkg.bounds;
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    // The package arrays are the store a later rebuild reads: world/release-uploaded.ts must leave them. A package that
    // decodes on demand (it has `release`) is its own store: its decoded arrays go once uploaded, and a rebuild decodes.
    geometry.userData = { keepCpuArrays: !pkg.release };
    pkg.release?.();
    const t = layer.template;
    const mesh = new THREE.Mesh(geometry, layer.material);
    mesh.name = t.name;
    mesh.renderOrder = t.renderOrder;
    mesh.castShadow = t.castShadow;
    mesh.receiveShadow = t.receiveShadow;
    mesh.layers.mask = t.layers.mask;
    mesh.matrixAutoUpdate = false;
    mesh.userData = { ...t.userData, cell: pkg.num, cellFade: 1 };
    slot.mesh = mesh;
    if (layer.fade && fadeIn) {
      slot.fade = 0;
      slot.fading = 1;
      mesh.userData.cellFade = 0;
    } else {
      slot.fade = 1;
      slot.fading = 0;
    }
    slot.unwantedSince = -1;
    (t.parent ?? root)?.add(mesh);
    stats.cells++;
    stats.bytes += pkg.bytes;
    stats.triangles += triangleCount(pkg);
    stats.loads++;
    hold(layer, pkg, 1);
    if (layer.templateFrames === -2) { layer.template.visible = true; layer.templateFrames = 2; }
    const ms = now() - start;
    stats.builtThisFrame++;
    stats.buildMsThisFrame += ms;
    if (ms > stats.maxBuildMs) stats.maxBuildMs = ms;
  };

  const evict = (slot: Slot) => {
    const mesh = slot.mesh;
    if (!mesh) return;
    mesh.parent?.remove(mesh);
    // Geometry first (its GPU buffers; three's listener still reads the render object), then the object's render
    // objects: pipeline use count, bindings and node state (three r186 RenderObjects.createRenderObject onDispose).
    mesh.geometry.dispose();
    mesh.dispatchEvent({ type: 'dispose' } as never);
    slot.mesh = null;
    slot.fade = 0;
    slot.fading = 0;
    slot.unwantedSince = -1;
    stats.cells--;
    stats.bytes -= slot.pkg.bytes;
    stats.triangles -= triangleCount(slot.pkg);
    stats.evictions++;
    hold(slot.layer, slot.pkg, -1);
    // A lazily decoded package drops its arrays with the mesh; it decodes again if it is wanted again.
    slot.pkg.release?.();
  };

  // Grouped packages (CellPackage.group): the slots of each group, for fitsGroup.
  const groups = new Map<object, Slot[]>();
  const fits = (slot: Slot) => {
    if (slot.pinned) return true;
    const g = slot.pkg.group ? groups.get(slot.pkg.group) : undefined;
    if (g && slot.layer.budget && !g.some((s) => s.mesh !== null)) {
      // a group not yet started starts only if the whole of it fits (members share their layers' budget)
      const b = slot.layer.budget, h = slot.layer.held;
      let bytes = 0, tris = 0, verts = 0, cells = 0;
      for (const s of g) if (s.mesh === null) { bytes += s.pkg.bytes; tris += triangleCount(s.pkg); verts += s.pkg.vertexCount; cells++; }
      return h.bytes + bytes <= b.geometryBytes && h.cells + cells <= b.cellDraws && h.triangles + tris <= b.triangles
        && (b.vertices === undefined || h.vertices + verts <= b.vertices);
    }
    const b = slot.layer.budget, h = slot.layer.held, t = triangleCount(slot.pkg);
    if (b) {
      return h.bytes + slot.pkg.bytes <= b.geometryBytes && h.cells + 1 <= b.cellDraws && h.triangles + t <= b.triangles
        && (b.vertices === undefined || h.vertices + slot.pkg.vertexCount <= b.vertices);
    }
    return stats.bytes - own.bytes + slot.pkg.bytes <= preset.budget.geometryBytes
      && stats.cells - own.cells + 1 <= preset.budget.cellDraws
      && stats.triangles - own.triangles + t <= preset.budget.triangles;
  };

  const requests: Slot[] = [];
  const last = { x: NaN, y: NaN, z: NaN, at: -Infinity, k: NaN, frameAt: NaN };

  /** Wanted at `d` (rise: the load rule; else the keep rule, eased by the hysteresis). */
  const wanted = (layer: Layer, d: number, k: number, rise: boolean) => {
    if (layer.reachM !== null) return d <= (rise ? layer.reachM : layer.reachM / preset.hysteresis);
    const sse = (layer.errorM * k) / Math.max(1, d);
    return sse >= (rise ? preset.screenErrorPx : preset.screenErrorPx * preset.hysteresis);
  };
  /** The reach in metres (what a package within one chunk of it prefetches against). */
  const reachOf = (layer: Layer, k: number) => (layer.reachM !== null ? layer.reachM : (layer.errorM * k) / preset.screenErrorPx);

  const pick = (camera: Vec3, k: number, nowS: number, radius: number) => {
    const keepRadius = radius + CELL;
    requests.length = 0;
    stats.fetching = 0;
    for (const slot of slots) {
      const d = boxDistance(slot.pkg.bounds, camera.x, camera.y, camera.z);
      slot.distance = d;
      const resident = slot.mesh !== null && slot.fading !== -1;
      if (slot.pinned) {
        if (slot.mesh === null) requests.push(slot);
        else if (slot.fading === -1) slot.fading = 1;
        continue;
      }
      if (resident) {
        const keep = d <= keepRadius && wanted(slot.layer, d, k, false) && !slot.pkg.suppressed?.();
        if (keep) slot.unwantedSince = -1;
        else if (slot.unwantedSince < 0) slot.unwantedSince = nowS;
        else if (nowS - slot.unwantedSince >= preset.evictAfterS) {
          if (slot.layer.fade) slot.fading = -1;
          else evict(slot);
        }
      } else if (d <= radius && wanted(slot.layer, d, k, true) && !slot.pkg.suppressed?.()) {
        // A leaving near cell that is wanted again turns around where it is.
        if (slot.mesh !== null) { slot.fading = 1; slot.unwantedSince = -1; continue; }
        // bytes still on their way: ask for them, build once they are in
        if (slot.pkg.ready && !slot.pkg.ready()) { slot.pkg.prefetch?.(); stats.fetching++; continue; }
        requests.push(slot);
      } else if (slot.mesh === null && slot.pkg.prefetch && d <= Math.min(radius, reachOf(slot.layer, k) + slot.layer.chunk)) {
        // the prefetch ring: one chunk past the reach, so a cell's bytes are in before it is wanted
        slot.pkg.prefetch();
      }
    }
    requests.sort((a, b) => (a.pinned === b.pinned ? a.distance - b.distance : a.pinned ? -1 : 1));
  };

  const advanceFades = (dt: number) => {
    let active = false;
    const step = preset.fadeS > 0 ? dt / preset.fadeS : 1;
    for (const slot of slots) {
      if (slot.fading === 0 || !slot.mesh) continue;
      active = true;
      slot.fade = Math.min(1, Math.max(0, slot.fade + slot.fading * step));
      slot.mesh.userData.cellFade = slot.fade;
      if (slot.fading === 1 && slot.fade >= 1) slot.fading = 0;
      else if (slot.fading === -1 && slot.fade <= 0) evict(slot);
    }
    return active;
  };

  // A template draws through the START compile and the next frame (or, warmOnBuild, the two frames after its layer's
  // first build), then hides; hidden, it keeps its render objects and so its pipelines.
  const advanceTemplates = () => {
    for (const layer of layers) {
      if (layer.templateFrames <= 0) continue;
      if (--layer.templateFrames === 0) { layer.template.visible = false; layer.templateFrames = -1; }
    }
  };

  return {
    stats,
    prime(camera, k, startRadius) {
      const t = now();
      stats.builtThisFrame = 0;
      stats.buildMsThisFrame = 0;
      pick(camera, k, 0, preset.residentRadiusM);
      let built = 0;
      for (const slot of requests) {
        if (!slot.pinned && slot.distance > startRadius) continue;
        if (!fits(slot)) { refuse(slot); continue; }
        build(slot, false);
        built++;
      }
      // A fresh pick next frame streams the rest.
      last.at = -Infinity;
      stats.pending = requests.length - built + stats.fetching;
      log?.('start', {
        cells: stats.cells, mb: +(stats.bytes / 1e6).toFixed(1), tris: stats.triangles, ms: +(now() - t).toFixed(1),
        pending: stats.pending, radius: startRadius,
      });
    },
    update(camera, k, nowS) {
      advanceTemplates();
      const dt = Number.isFinite(last.frameAt) ? Math.min(0.1, Math.max(0, nowS - last.frameAt)) : 0;
      last.frameAt = nowS;
      stats.builtThisFrame = 0;
      stats.buildMsThisFrame = 0;
      const moved = Math.hypot(camera.x - last.x, camera.y - last.y, camera.z - last.z);
      if (!(moved < 1) || nowS - last.at >= 0.25 || k !== last.k) {
        pick(camera, k, nowS, preset.residentRadiusM);
        last.x = camera.x; last.y = camera.y; last.z = camera.z; last.at = nowS; last.k = k;
      }
      const start = now();
      let uploaded = 0;
      let i = 0;
      for (; i < requests.length; i++) {
        const slot = requests[i]!;
        if (slot.mesh !== null) continue;
        if (stats.builtThisFrame > 0 && (now() - start >= preset.stream.msPerFrame || uploaded + slot.pkg.bytes > preset.stream.uploadBytesPerFrame)) break;
        if (!fits(slot)) { refuse(slot); continue; }
        build(slot, true);
        uploaded += slot.pkg.bytes;
      }
      requests.splice(0, i);
      stats.pending = requests.length + stats.fetching;
      const fading = advanceFades(dt);
      if (log && (stats.builtThisFrame > 0)) {
        log('frame', {
          built: stats.builtThisFrame, buildMs: +stats.buildMsThisFrame.toFixed(2), cells: stats.cells,
          mb: +(stats.bytes / 1e6).toFixed(1), tris: stats.triangles, pending: stats.pending, evictions: stats.evictions,
        });
      }
      return stats.pending > 0 || fading;
    },
    addExternal,
    dispose() {
      for (const slot of slots) if (slot.mesh) evict(slot);
      // The template geometry stays with its mesh, whose builder disposes it (city-mesh.ts, facelift, road paint);
      // only a material this module cloned is its own.
      for (const layer of layers) if (layer.cloned) layer.material.dispose();
      slots.length = 0;
      layers.length = 0;
      groups.clear();
    },
  };
}
