// The gen lane (Phase 3 slices 1 + 4): seeded procedural buildings riding the Valdrada cell
// stack. Zero disk — a cell's package holds only its spec; `prefetch` runs the emission
// (buildings.ts, pure) when the streamer enters the reach plus a ring, `release` drops the
// arrays on eviction, and a regenerated cell is byte-identical to the one that left.
// Slice 4 takes the layer past the dataset square: the district profile (spec.ts) fills
// dataset-free cells deterministically from their keys, packages defer even the spec until
// the streamer nears them (genCellPackageDeferred), and the registered set is the bounded
// GEN_EXTENT square minus the cells the baked manifest already streams (genRecordCellAt).
//
// Content draws through lane A's blocks material (makeBlocksMaterial) on the near branch —
// no `vdShell` marker — so generated massing gets the same facet-normal lighting, sky mirror,
// sun disc and night handling as the record buildings, with its dim per-use emission standing
// in for the real windows the infill does not have. The fw14 texture stays out (the shell's
// window grid is far-tier business): a material with `null` multiplies by white, which is one
// fewer texture bind per frame for content that never takes the shell branch anyway.
//
// Streaming: a mid/near fill layer. reachM 320 sits between the blocks' near reach (60–120 m,
// the lite/near level) and the far tier's 13 km macro — inside the ipad/phone resident radius
// (360 m) so a cell the layer wants is always admissible, and fixed across presets so the
// vdPort.gen budget rows mean the same thing everywhere. Fades with the dither, never pinned
// (generated detail around a landmark evicts like the rest).
//
// Flag: EXPO_PUBLIC_WORLD_GEN, opt-in (the parseSkyRigFlag truthy set). Off, the parts list
// — and the render — is byte-identical to before the lane existed.
//
// Deferred to later slices: the district authority (real parcelization — interior lots sit on
// a fixed 38 m grid today and only approximate blocks), area massing past school/pitch, the
// VGC1 kind producers (colliders/pednet/spawns/labels read the spec's use tags, not written
// yet), and any look-verification on device.
import type { Three } from '@acme/ui/three';
import type { CityDatasetV3 } from '../../city-dataset.ts';
import { EMPTY_PART, type VdPortCtx, type VdPortPart, type VdStreamLayer } from '../vd-port/types.ts';
import { CELL, cellNum, type CellAttribute, type CellLocalPositionFrame, type CellPackage } from '../cells/cell-rules.ts';
import { ditherFadeMask } from '../cells/cell-stream.ts';
import { makeBlocksMaterial } from '../vd-port/blocks/shell-material.ts';
import type { NearArrays } from '../vd-port/blocks/codec.ts';
import { WORLD_PRESETS } from '../../perf/tier-presets.ts';
import { VD_CELL_MANIFEST } from '../cell-source/data/vd-cells-manifest.ts';
import { buildGenIndex, genSpecForCell, GEN_MAX_HEIGHT_M, type GenDataset, type GenSpec } from './spec.ts';
import { emitGenCell, genCellBounds, genCellBoxes, GEN_TRIS_PER_BOX, GEN_VERTS_PER_BOX, type GenBox } from './buildings.ts';
import { EXPERIMENTAL_WORLD_GEN } from './flag.ts';

type Mesh = InstanceType<Three['Mesh']>;

// The flag lives in flag.ts so the pure places/blocked consumers read it without
// this module's three chain; re-exported — the slice-1 import path keeps working.
export { EXPERIMENTAL_WORLD_GEN };

/** The layer's mesh name (the streamer names its cells after the template). */
export const GEN_NAME = 'city:vd-gen';

/**
 * The layer's fixed reach, metres. Inside the ipad/phone residentRadiusM (360), so every cell
 * the layer wants is admissible; fixed across presets so the want set — and the vdPort.gen
 * budget — is the same on every device class.
 */
export const GEN_REACH_M = 320;

/** The gen layer's own budget on the ipad-a12x row (perf/tier-presets.ts vdPort.gen); the ctx's preset wins. */
export const GEN_BUDGET = WORLD_PRESETS['ipad-a12x'].vdPort.gen;

/**
 * A gen cell as a streamer package: the spec is computed at registration (cheap: a handful of
 * rects, the package's counts and bounds come from the massing boxes, not the arrays), and the
 * arrays exist only between `prefetch` and `release`. Same contract as sourceNearPackage, with
 * the generation itself standing in for the fetch — `ready` flips the moment it runs, and the
 * resolved promise is the land-report that wakes the streamer for a fresh pick.
 */
export function genCellPackage(spec: GenSpec, groundY: (x: number, z: number) => number): CellPackage | null {
  const boxes = genCellBoxes(spec, groundY);
  if (boxes.length === 0) return null;
  const vertexCount = boxes.length * GEN_VERTS_PER_BOX;
  const triangles = boxes.length * GEN_TRIS_PER_BOX;
  let arrays: NearArrays | null = null;
  const get = () => (arrays ??= emitGenCell(spec, boxes));
  return {
    cx: spec.cx,
    cz: spec.cz,
    num: spec.num,
    size: CELL,
    positionFrame: {
      kind: 'cell-local',
      origin: [spec.cx * CELL + CELL / 2, 0, spec.cz * CELL + CELL / 2],
    } as CellLocalPositionFrame,
    get attributes(): Readonly<Record<string, CellAttribute>> {
      const a = get();
      return {
        position: { array: a.position, itemSize: 3, normalized: false },
        color: { array: a.color, itemSize: 4, normalized: true },
        emissive: { array: a.emissive, itemSize: 4, normalized: true },
        // the FW14 uv slot: unused on the near branch (blocks material), present to share its layout
        uv: { array: new Float32Array((a.position.length / 3) * 2), itemSize: 2, normalized: false },
      };
    },
    get index() {
      return get().index;
    },
    vertexCount,
    triangles,
    bounds: genCellBounds(boxes),
    // the near cell byte convention (blocks codec nearCellBytes): 28 B a vertex, u16 index
    bytes: vertexCount * 28 + triangles * 3 * 2,
    release() {
      arrays = null;
    },
    ready: () => arrays !== null,
    prefetch() {
      if (arrays) return;
      get();
      return Promise.resolve(true);
    },
  };
}

/** The layer's stream spec. `errorM` is the required vestige — reachM overrides it both ways (cell-stream.ts wanted/reachOf). */
export const GEN_LAYER: VdStreamLayer = { errorM: 0.48, chunk: CELL, fade: true, pin: false, reachM: GEN_REACH_M, sharedMaterial: true };

/**
 * The gen coverage square, half-width in cells (Phase 3 slice 4): gen cells are registered for
 * cx, cz in [-32, 31] — a [-4096, 4096) m region centred on the tile, ~67 km². It covers the
 * home tile plus the near void the walk camera actually reaches at ground level (Morningside,
 * Central Park, the near Bronx bank) — the ground where the gen layer is the only near-detail
 * content. Bounded because every registered cell is a streamer slot paying a distance test a
 * pick: ~4 k slots keeps that under a few tenths of a millisecond and registration O(1).
 * Full five-borough ground (~18 k cells) needs a streamed/instanced gen tier, not more slots —
 * a documented deferral, not a bigger square.
 */
export const GEN_EXTENT_CELLS = 32;

/**
 * Pre-spec estimates for a deferred package's stream fields. Registration reads `bytes` for
 * the streamer's packaged-bytes stat before any spec exists; the conservative bound covers the
 * densest cell the grid can raise (16 slots, two boxes each). Once a package's spec is computed
 * its getters answer the real counts — every read that feeds a budget decision happens after
 * prefetch, so the estimate only ever reaches the registration log.
 */
const GEN_DEFERRED_VERTS_EST = 16 * 2 * GEN_VERTS_PER_BOX;   // 640
const GEN_DEFERRED_TRIS_EST = 16 * 2 * GEN_TRIS_PER_BOX;     // 320
const GEN_DEFERRED_BYTES_EST = GEN_DEFERRED_VERTS_EST * 28 + GEN_DEFERRED_TRIS_EST * 3 * 2;

/** The deferred package's conservative y band, metres — ground plus the district height cap. */
const GEN_BOUNDS_DOWN_M = 24;
const GEN_BOUNDS_UP_M = 16;

/**
 * A gen cell whose spec is deferred (Phase 3 slice 4): registration costs a conservative
 * bounds estimate and field getters — no spec, no draws — so the layer can blanket the
 * GEN_EXTENT square at O(1) per cell. First `prefetch` computes the spec (sub-millisecond,
 * deterministic from the cell key), emits the arrays when the spec left massing, or marks the
 * package suppressed when it did not (an all-open records cell — the streamer then treats it
 * as unwanted and never asks again). `release` drops the arrays; the spec and boxes stay, so
 * a regenerated cell is byte-identical with no respeccing.
 */
export function genCellPackageDeferred(cx: number, cz: number, specFor: () => GenSpec, groundY: (x: number, z: number) => number): CellPackage {
  const x0 = cx * CELL, z0 = cz * CELL;
  const gy = groundY(x0 + CELL / 2, z0 + CELL / 2);
  let spec: GenSpec | null = null;
  let boxes: readonly GenBox[] | null = null;
  let arrays: NearArrays | null = null;
  let empty = false;
  let settled: Promise<boolean> | null = null;
  const specOf = () => (spec ??= specFor());
  const boxesOf = () => (boxes ??= genCellBoxes(specOf(), groundY));
  const get = () => (arrays ??= emitGenCell(specOf(), boxesOf()));
  return {
    cx,
    cz,
    num: cellNum(cx, cz),
    size: CELL,
    positionFrame: {
      kind: 'cell-local',
      origin: [x0 + CELL / 2, 0, z0 + CELL / 2],
    } as CellLocalPositionFrame,
    get attributes(): Readonly<Record<string, CellAttribute>> {
      const a = get();
      return {
        position: { array: a.position, itemSize: 3, normalized: false },
        color: { array: a.color, itemSize: 4, normalized: true },
        emissive: { array: a.emissive, itemSize: 4, normalized: true },
        uv: { array: new Float32Array((a.position.length / 3) * 2), itemSize: 2, normalized: false },
      };
    },
    get index() {
      return get().index;
    },
    get vertexCount() {
      return boxes ? boxes.length * GEN_VERTS_PER_BOX : GEN_DEFERRED_VERTS_EST;
    },
    get triangles() {
      return boxes ? boxes.length * GEN_TRIS_PER_BOX : GEN_DEFERRED_TRIS_EST;
    },
    // Conservative until the spec is known: the cell box in plan (every lot lives inside it)
    // and groundY at the centre padded down 24 m and up past GEN_MAX_HEIGHT_M. Covers the real
    // triangles for the want-test and the mesh's bounding sphere alike; it never tightens.
    bounds: Float64Array.from([
      x0, gy - GEN_BOUNDS_DOWN_M, z0,
      x0 + CELL, gy + GEN_MAX_HEIGHT_M + GEN_BOUNDS_UP_M, z0 + CELL,
    ]),
    get bytes() {
      return boxes ? boxes.length * GEN_VERTS_PER_BOX * 28 + boxes.length * GEN_TRIS_PER_BOX * 3 * 2 : GEN_DEFERRED_BYTES_EST;
    },
    release() {
      arrays = null;
    },
    ready: () => arrays !== null,
    // An empty spec (a records cell that rolled only open ground) is a permanent suppress:
    // the want test refuses it and the streamer never prefetches it twice.
    suppressed: () => empty,
    prefetch() {
      // After a release the spec and boxes are cached, so a re-prefetch re-emits the same
      // bytes and the memoized promise reports the same verdict — evict-and-regenerate stays
      // byte-identical like the eager package.
      if (!arrays) {
        if (boxesOf().length === 0) empty = true;
        else get();
      }
      return (settled ??= Promise.resolve(!empty));
    },
  };
}

/** Cells the baked manifest already streams — the home tile's near/lite and every baked ring.
 * Built on first use: flag-off, the lane never asks and the manifest scan never runs. */
let genRecordCells: ReadonlySet<number> | null = null;
function recordCells(): ReadonlySet<number> {
  if (genRecordCells) return genRecordCells;
  const cells = new Set<number>();
  for (const key of Object.keys(VD_CELL_MANIFEST.cells)) {
    // Far-tier keys are file names ('far/L4_-10_10.bin'), not streamer cells.
    if (key.startsWith('far/')) continue;
    const m = /(?:^|\/)(-?\d+)_(-?\d+)$/.exec(key);
    if (m) cells.add(cellNum(Number(m[1]), Number(m[2])));
  }
  return (genRecordCells = cells);
}

/**
 * Whether a gen cell must stay out of the record stream's way: true for manifest-covered cells
 * outside the dataset square — the baked ring districts stream their own near/lite there, and
 * district fill on top would raise buildings inside record buildings. Cells inside the square
 * are never record-suppressed: gen's whole job there is infill among the records.
 */
export function genRecordCellAt(cx: number, cz: number, extentMeters: number): boolean {
  if (Math.abs(cx * CELL + CELL / 2) <= extentMeters && Math.abs(cz * CELL + CELL / 2) <= extentMeters) return false;
  return recordCells().has(cellNum(cx, cz));
}

export interface GenCellPackagesOptions {
  /** Half-width of the registered square, cells (default GEN_EXTENT_CELLS). */
  readonly extentCells?: number;
  /** Cells to leave out entirely — the baked-manifest keep-out (buildGen passes genRecordCellAt). */
  readonly recordCell?: (cx: number, cz: number) => boolean;
}

/**
 * The lane's packages (Phase 3 slice 4): every 128 m cell in the GEN_EXTENT square, each a
 * deferred package — registration is O(1) a cell and the spec exists only once the streamer
 * nears it. The spec path splits inside genSpecForCell: cells inside the dataset square (or
 * known to its index) take the records path — byte-identical to before — and cells past it
 * take the district profile. Cells the baked rings already cover are excluded by
 * `recordCell` so gen never duplicates record massing.
 */
export function genCellPackages(
  dataset: GenDataset & { readonly extentMeters: number },
  groundY: (x: number, z: number) => number,
  inside: (x: number, z: number) => boolean,
  options?: GenCellPackagesOptions,
): CellPackage[] {
  const index = buildGenIndex(dataset);
  const half = dataset.extentMeters;
  const extent = options?.extentCells ?? GEN_EXTENT_CELLS;
  const packages: CellPackage[] = [];
  for (let cx = -extent; cx < extent; cx++) {
    for (let cz = -extent; cz < extent; cz++) {
      if (options?.recordCell?.(cx, cz)) continue;
      packages.push(genCellPackageDeferred(cx, cz, () => genSpecForCell(cx, cz, { index, inside, recordsExtentMeters: half }), groundY));
    }
  }
  return packages;
}

export function buildGen(ctx: VdPortCtx, dataset: CityDatasetV3): VdPortPart {
  // A streaming layer: a whole-built world has no streamer to feed, so the lane does nothing
  // there rather than registering packages nobody reads.
  if (!ctx.preset) return EMPTY_PART;
  const { THREE } = ctx;
  const mat = makeBlocksMaterial(THREE, ctx.env, null);
  // The fade rides the layer's own mask (sharedMaterial: the streamer adds no second one).
  (mat as unknown as { maskNode: unknown }).maskNode = ditherFadeMask(THREE);

  // The template: one zero-area triangle in the near layout, drawn by the START compile so a
  // streamed gen cell never compiles a pipeline.
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  tg.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  tg.setAttribute('emissive', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  tg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
  tg.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  tg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  tg.userData = { keepCpuArrays: true };
  const template: Mesh = new THREE.Mesh(tg, mat);
  template.name = GEN_NAME;
  template.matrixAutoUpdate = false;
  template.castShadow = true;
  template.receiveShadow = true;
  ctx.group.add(template);

  const packages = genCellPackages(dataset, ctx.groundY, ctx.inBounds, {
    recordCell: (cx, cz) => genRecordCellAt(cx, cz, dataset.extentMeters),
  });
  const budget = ctx.preset.vdPort.gen ?? GEN_BUDGET;
  ctx.registerChunks(template, GEN_LAYER, packages, { name: 'gen', ...budget });

  return {
    dispose() {
      tg.dispose();
      mat.dispose();
    },
    stats: { meshes: 1, triangles: 0, structures: packages.length },
  };
}
