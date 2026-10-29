// perf/tier-presets.ts: the world's streaming and budget presets, after
// Valdrada's client/public/data/tiers.json (schema valdrada.tiers/0). There a
// preset carries the L0 cell grid, the screen-space error threshold, the LOD
// byte and node budgets and the shadow and post toggles; content is the same
// at every tier and only budgets and shading differ. Here a preset carries the
// same kinds of numbers, sized for the devices this game ships on:
//
//   ipad-a12x  iPad Pro 12.9" 3rd gen: A12X, 4 GB shared by CPU and GPU,
//              2732 x 2048 drawing buffer, Dawn on Metal, Hermes.
//   phone      iPhone 17: 2622 x 1206 at 3x.
//   high       an M-class iPad or a desktop: a 1 px threshold and room to spare.
//
// Valdrada picks a preset only from `?tier=` and never detects the device
// (client/src/lod/tiers.js). Here EXPO_PUBLIC_WORLD_PRESET picks one, and
// without it the canvas's logical size decides (detectWorldPreset): a long
// side of 1000 pt or more is an iPad, which this code cannot tell apart from
// an M-series iPad, so every iPad takes the conservative A12X row. Logical
// points, not drawing-buffer pixels: GameScreen already caps the physical
// city's pixel ratio to the iPhone 17's pixel count (perf/pixel-budget.ts),
// so the 12.9" iPad draws 2049 x 1536, not 2732 x 2048, and a pixel test
// would read it as a phone.
//
// The pixel ratio is not a preset field for that reason. The shadow tile and
// the bloom scale are caps over the world tier row (perf/tier.ts), which
// keeps its other physical fields (SSR, light pools).
//
// Where the numbers come from. The geometry figures were measured with the
// recording-GPU harness at 2732 x 2048 on the bundled Harlem tile
// (world/cells/cell-stream.walk.test.ts, a scripted run along 125th Street
// and back): resident cell bytes, cell draws and triangles at 1, 30, 60, 90
// and 120 s. Each budget sits above the measured peak, so it only bites when
// the content grows. The render-target figures are the first frame's own
// textures (output rgba16float 44.8 MB, two depth32float 22.4 MB each, the
// 4096 x 2048 shadow atlas 2 x 33.6 MB at a 2048 tile). Device numbers on the
// A12X are still to come; these are the harness's.
import { parseSkyRigFlag } from '../world/sky-rig.ts';

export type WorldPresetName = 'ipad-a12x' | 'phone' | 'high';

/** One device class's streaming thresholds, budgets and render-target caps. */
export interface WorldPreset {
  readonly name: WorldPresetName;
  /**
   * Screen-space error threshold, px (Valdrada screenErrorPx). A cell layer is wanted while
   * geometricError * K / boxDistance >= this, with K = drawing-buffer height / (2 tan(fovV / 2)).
   */
  readonly screenErrorPx: number;
  /**
   * Hard cap on the resident radius, metres, from the camera to a cell's box (Valdrada loadedGrid.nearRadiusM). The
   * streamed layers are near detail whose screen error already falls under the threshold about here; the shells and
   * the ground never stream (world/cells/cell-stream.ts CELL_LAYERS), so the cap leaves no edge in view.
   */
  readonly residentRadiusM: number;
  /** A resident cell layer is evicted only once its screen error falls under this share of the threshold. */
  readonly hysteresis: number;
  /** Seconds a cell must stay unwanted before it is evicted (Valdrada EVICT_AFTER_S). */
  readonly evictAfterS: number;
  /** Budgets for the streamed cells. A load that would cross one is refused and counted (stats.overBudget). */
  readonly budget: {
    /** GPU vertex bytes of the resident cell meshes. */
    readonly geometryBytes: number;
    /** Resident cell meshes (each is one draw per pass when in view). */
    readonly cellDraws: number;
    readonly triangles: number;
  };
  /** Per-frame streaming work (Valdrada attaches one chunk a frame). */
  readonly stream: {
    /** JS milliseconds of cell builds per frame; at least one cell always goes. */
    readonly msPerFrame: number;
    /** Vertex bytes handed to the GPU per frame. */
    readonly uploadBytesPerFrame: number;
  };
  /** Seconds a streamed-in near layer takes to rise into place (Valdrada FADE_S). */
  readonly fadeS: number;
  /** Cap on the physical sun shadow tile, px (the atlas is two tiles wide: 2048 is 2 x 33.6 MB of colour + depth). */
  readonly shadowTile: number;
  /** Cap on the physical bloom chain's resolution scale. */
  readonly bloomResolutionScale: number;
  /**
   * The vd port's own budgets (world/vd-port), outside `budget`: the blocks' near level (cells/cell-stream.ts external
   * layer budget) and the resident vertices of lane C's streamed structures (vk, pk, lk).
   */
  readonly vdPort: {
    /** errorM: the near layer's reach knob (cells/cell-stream.ts: wanted while errorM x K / distance >= screenErrorPx). */
    readonly blocksNear: { readonly geometryBytes: number; readonly cellDraws: number; readonly triangles: number; readonly errorM: number; readonly level: 'near' | 'lite' };
    readonly structureVertices: number;
  };
}

const MiB = 1 << 20;

export const WORLD_PRESETS: Readonly<Record<WorldPresetName, WorldPreset>> = {
  'ipad-a12x': {
    name: 'ipad-a12x',
    screenErrorPx: 2,
    // The 0.3 m layers reach 0.3 * K / 2 = 330 m at the harness's K (2048 px buffer); the cap binds just past it.
    residentRadiusM: 360,
    hysteresis: 0.8,
    evictAfterS: 4,
    // Walk peak (harness, 125th St out and back, cell-stream.walk.test.ts): 61 chunks, 18.0 MB, 83k triangles.
    budget: { geometryBytes: 32 * MiB, cellDraws: 96, triangles: 160_000 },
    stream: { msPerFrame: 3, uploadBytesPerFrame: 6 * MiB },
    fadeS: 0.45,
    shadowTile: 2048,
    // Bloom's first level is 3 rgba16float targets at the scale (11.2 MB each at 0.5 of 2732 x 2048).
    bloomResolutionScale: 0.35,
    // The blocks' near level held to 350k triangles on the A12X until a device measurement says otherwise: the lite cells
    // (Valdrada's near mesh simplified to 10 cm, 2 cm on the heroes) inside a third of the high tier's reach. Walk peak
    // (cell-stream.walk.test.ts) 305k triangles, no refused load. Lane C's structures 250k vertices (structures.test.ts).
    vdPort: { blocksNear: { geometryBytes: 24 * MiB, cellDraws: 12, triangles: 350_000, errorM: 0.03, level: 'lite' }, structureVertices: 250_000 },
  },
  phone: {
    name: 'phone',
    screenErrorPx: 2,
    residentRadiusM: 360,
    hysteresis: 0.8,
    evictAfterS: 4,
    // The phone's buffer is shorter than the harness's 2048 px, so its K and its want set are smaller still.
    budget: { geometryBytes: 32 * MiB, cellDraws: 96, triangles: 160_000 },
    stream: { msPerFrame: 3, uploadBytesPerFrame: 8 * MiB },
    fadeS: 0.45,
    shadowTile: 2048,
    bloomResolutionScale: 0.5,
    vdPort: { blocksNear: { geometryBytes: 24 * MiB, cellDraws: 12, triangles: 350_000, errorM: 0.03, level: 'lite' }, structureVertices: 250_000 },
  },
  high: {
    name: 'high',
    screenErrorPx: 1,
    residentRadiusM: 1200,
    hysteresis: 0.8,
    evictAfterS: 4,
    budget: { geometryBytes: 256 * MiB, cellDraws: 400, triangles: 2_000_000 },
    stream: { msPerFrame: 6, uploadBytesPerFrame: 32 * MiB },
    fadeS: 0.45,
    shadowTile: 3072,
    bloomResolutionScale: 0.5,
    vdPort: { blocksNear: { geometryBytes: 256 * MiB, cellDraws: 64, triangles: 4_000_000, errorM: 0.09, level: 'near' }, structureVertices: 2_000_000 },
  },
};

export function parseWorldPreset(value: string | undefined | null): WorldPresetName | null {
  const v = value?.trim().toLowerCase();
  return v === 'ipad-a12x' || v === 'phone' || v === 'high' ? v : null;
}

/** EXPO_PUBLIC_WORLD_PRESET; null when unset, so the drawing buffer decides. */
export const WORLD_PRESET_SELECTED = parseWorldPreset(process.env.EXPO_PUBLIC_WORLD_PRESET);

/**
 * EXPO_PUBLIC_WORLD_STREAM: true or false when set (1/true/on or 0/false/off), null when unset. See
 * worldStreamEnabled for the default.
 */
export const WORLD_STREAM_SELECTED: boolean | null = (() => {
  const v = process.env.EXPO_PUBLIC_WORLD_STREAM;
  return v == null || v.trim() === '' ? null : parseSkyRigFlag(v);
})();

/**
 * Whether the city streams its cells (world/cells/). Unset, it streams under the physical stack (the iPad and the
 * iPhone 17, where memory is the failure) and not without it: the Surface Duo stays on today's look and draw count
 * (perf/tier.ts G4), and its limit is per-draw encode, which chunking adds to. An explicit value wins either way.
 */
export function worldStreamEnabled(physical: boolean, selected: boolean | null = WORLD_STREAM_SELECTED): boolean {
  return selected ?? physical;
}

/** Logical long side, points, from which a canvas is an iPad's. */
export const IPAD_MIN_LONG_SIDE_PT = 1000;

/**
 * The preset for a canvas of `logical` size in points. An explicit selector wins; then the world tier 'high'
 * (EXPO_PUBLIC_WORLD_TIER) maps to 'high'; then an iPad-sized canvas takes 'ipad-a12x' and anything smaller 'phone'.
 */
export function detectWorldPreset(
  logical: { width: number; height: number },
  selected: WorldPresetName | null = WORLD_PRESET_SELECTED,
  worldTierHigh = process.env.EXPO_PUBLIC_WORLD_TIER?.trim().toLowerCase() === 'high',
): WorldPreset {
  if (selected) return WORLD_PRESETS[selected];
  if (worldTierHigh) return WORLD_PRESETS.high;
  const long = Math.max(logical.width, logical.height);
  return long >= IPAD_MIN_LONG_SIDE_PT ? WORLD_PRESETS['ipad-a12x'] : WORLD_PRESETS.phone;
}

/**
 * The preset's name without a canvas: 'high' when the selector or the world tier says so, else whichever of the iPad and
 * phone rows the canvas will pick, which share every row the loader needs (vd-port blocks' near level). For a loader that
 * runs before the canvas is sized.
 */
export function worldPresetWithoutCanvas(
  selected: WorldPresetName | null = WORLD_PRESET_SELECTED,
  worldTierHigh = process.env.EXPO_PUBLIC_WORLD_TIER?.trim().toLowerCase() === 'high',
): WorldPreset {
  return detectWorldPreset({ width: IPAD_MIN_LONG_SIDE_PT, height: 0 }, selected, worldTierHigh);
}

/** Pixels per metre at one metre: K = heightPx / (2 tan(fovV / 2)), fovV in degrees (Valdrada stream.mjs). */
export function screenErrorScale(heightPx: number, fovDeg: number): number {
  return heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
}

/** Screen-space error in px of a feature of `errorM` metres at `distanceM` (Valdrada: err * K / max(1, dist)). */
export function screenError(errorM: number, distanceM: number, k: number): number {
  return (errorM * k) / Math.max(1, distanceM);
}

/** The distance at which a feature of `errorM` metres falls to `thresholdPx`: errorM * K / thresholdPx. */
export function screenErrorDistance(errorM: number, k: number, thresholdPx: number): number {
  return (errorM * k) / Math.max(1e-6, thresholdPx);
}
