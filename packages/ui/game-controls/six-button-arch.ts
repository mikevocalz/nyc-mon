// Geometry of the six-button right cluster (Master Directive v2 §2B). Pure:
// no react-native import, so `node --test` proves the 44 pt floor, the
// no-overlap rule and the mirror at every profile scale.
//
// Row shape comes from lane A's measured table (docs/design/research/
// arcade-ergonomics.md §7): cap Ø56, pitch 64 along a row, row pitch 62, the
// bottom row shifted 8 dp along its row toward the thumb, the middle column
// the crest (+10 dp) and the ring column +4 dp.
// Decision: BUILD the -45° cluster the player asked for on the device
// (2026-10-15, "right buttons should be in a -45 deg arc"). The §7 rows are
// rotated rigidly by -45° in screen space (+y down), so each row rises toward
// the upper right and every pairwise spacing lane A measured survives; only
// rounding to whole dp moves a centre, by at most 0.5. Then the box shrinks
// to the caps' tight bounds: 193 × 188. Pulling the bottom row along the
// diagonal would save about 5 % of the area but gives up the thumbward
// stagger, so STRIKE that.
//
// The literal table below is the one source the hit test, the touch targets
// and `right-six/scene.rml` share. `sixButtonCentresFromRows` re-derives it
// from the row parameters, and six-button-arch.test.ts checks the table
// against the derivation and against the RML placements.
// The mirror rule is §7's: x' = width − x.
import { type ButtonId, type Handedness } from './contract.ts';

/** Apple HIG / WCAG 2.5.8 floor for a touch target, in dp. Enforced at every scale. */
export const SIX_BUTTON_MIN_TARGET_DP = 44;

/** Cap diameter at reference scale 1.0, in dp (arcade-ergonomics.md §7). */
export const SIX_BUTTON_DIAMETER_DP = 56;

/** Screen-space angle of each row's baseline, in degrees, +y down: −45 rises toward the upper right. */
export const SIX_BUTTON_ROW_ANGLE_DEG = -45;

/**
 * Row parameters at reference scale 1.0, in dp, measured in the row's own
 * frame before the {@linkcode SIX_BUTTON_ROW_ANGLE_DEG} rotation
 * (arcade-ergonomics.md §7).
 */
export const SIX_BUTTON_ROW_GEOMETRY_DP = {
  /** Centre to centre along a row. */
  pitch: 64,
  /** Top-row baseline to bottom-row baseline, across the rows. */
  rowPitch: 62,
  /** How far the bottom row slides along its baseline toward the thumb. */
  stagger: 8,
  /** Rise off the baseline for the index, middle and ring columns: the arch. */
  arch: [0, 10, 4],
} as const;

/** The cluster's bounding box at reference scale 1.0, in dp: the caps' tight bounds. */
export const SIX_BUTTON_BOX_DP = { width: 193, height: 188 } as const;

/**
 * Cap centres at reference scale 1.0, cluster-local dp, +y down, right hand.
 * Top row X Y Z and bottom row A B C, each rising toward the upper right.
 *
 * @see {@linkcode sixButtonCentresFromRows} for the derivation this table must match.
 */
export const SIX_BUTTON_CENTRES_DP: Readonly<Record<ButtonId, { readonly x: number; readonly y: number }>> = {
  x: { x: 28, y: 121 },
  y: { x: 66, y: 69 },
  z: { x: 116, y: 28 },
  a: { x: 77, y: 160 },
  b: { x: 116, y: 107 },
  c: { x: 165, y: 66 },
};

/** One button's place in the cluster. `x`/`y` are the cap centre in cluster-local dp, +y down. */
export interface ButtonSlot {
  readonly id: ButtonId;
  readonly x: number;
  readonly y: number;
  readonly diameterDp: number;
  /** 0 = index-finger column, 2 = ring-finger column, before any mirroring. */
  readonly column: 0 | 1 | 2;
  readonly row: 'top' | 'bottom';
}

/** What {@linkcode sixButtonArch} resolves: the six slots and the box that holds them. */
export interface SixButtonArch {
  readonly slots: readonly ButtonSlot[];
  readonly widthDp: number;
  readonly heightDp: number;
  readonly diameterDp: number;
  /** The scale the geometry was built at, after clamping. */
  readonly scale: number;
}

/** Options for {@linkcode sixButtonArch}. */
export interface SixButtonArchOptions {
  /** {@linkcode ControllerProfile.scale}: 0.8…1.4. Out-of-range values are clamped; non-finite reads as 1. */
  readonly scale: number;
  /** Which hand rests on the cluster. `left` mirrors the box so the index column stays inboard. */
  readonly handedness: Handedness;
}

const ORDER: readonly ButtonId[] = ['x', 'y', 'z', 'a', 'b', 'c'];
const COLUMN: Readonly<Record<ButtonId, 0 | 1 | 2>> = { x: 0, y: 1, z: 2, a: 0, b: 1, c: 2 };
const ROW: Readonly<Record<ButtonId, 'top' | 'bottom'>> = { x: 'top', y: 'top', z: 'top', a: 'bottom', b: 'bottom', c: 'bottom' };

/**
 * Derives the reference centres from {@linkcode SIX_BUTTON_ROW_GEOMETRY_DP}
 * and {@linkcode SIX_BUTTON_ROW_ANGLE_DEG}: lay both rows out in the row
 * frame, rotate, round to whole dp, then translate so the caps' tight bounds
 * start at (0, 0). Returns the centres and the box that holds the caps.
 *
 * @see {@linkcode SIX_BUTTON_CENTRES_DP}, the committed result.
 */
export function sixButtonCentresFromRows(): {
  centres: Record<ButtonId, { x: number; y: number }>;
  width: number;
  height: number;
} {
  const { pitch, rowPitch, stagger, arch } = SIX_BUTTON_ROW_GEOMETRY_DP;
  const radius = SIX_BUTTON_DIAMETER_DP / 2;
  const angle = (SIX_BUTTON_ROW_ANGLE_DEG * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const raw = ORDER.map((id) => {
    const bottom = ROW[id] === 'bottom';
    // Row frame: +along runs index → ring, +y runs down; the arch rises (−y).
    const along = COLUMN[id] * pitch + (bottom ? stagger : 0);
    const across = -arch[COLUMN[id]] + (bottom ? rowPitch : 0);
    return { id, x: along * cos - across * sin, y: along * sin + across * cos };
  });
  const minX = Math.min(...raw.map((p) => p.x)) - radius;
  const minY = Math.min(...raw.map((p) => p.y)) - radius;
  const centres = {} as Record<ButtonId, { x: number; y: number }>;
  for (const p of raw) centres[p.id] = { x: Math.round(p.x - minX), y: Math.round(p.y - minY) };
  const width = Math.max(...ORDER.map((id) => centres[id].x)) + radius;
  const height = Math.max(...ORDER.map((id) => centres[id].y)) + radius;
  return { centres, width, height };
}

/**
 * Places the six buttons on the -45° arch. Every centre and the diameter are
 * the reference table multiplied by the clamped scale; the left hand mirrors
 * x inside the box (its rows rise toward the upper left) and keeps every
 * label on its button.
 *
 * Every cap is at least {@linkcode SIX_BUTTON_MIN_TARGET_DP} across (56 × 0.8
 * = 44.8) and no two caps overlap, at every scale the profile schema allows.
 *
 * @see {@linkcode SIX_BUTTON_CENTRES_DP} for the reference table and its source.
 */
export function sixButtonArch({ scale, handedness }: SixButtonArchOptions): SixButtonArch {
  const s = Number.isFinite(scale) ? Math.min(Math.max(scale, 0.8), 1.4) : 1;
  const diameterDp = SIX_BUTTON_DIAMETER_DP * s;
  const widthDp = SIX_BUTTON_BOX_DP.width * s;
  const heightDp = SIX_BUTTON_BOX_DP.height * s;
  const slots = ORDER.map((id): ButtonSlot => {
    const centre = SIX_BUTTON_CENTRES_DP[id];
    const rawX = centre.x * s;
    return {
      id,
      x: handedness === 'left' ? widthDp - rawX : rawX,
      y: centre.y * s,
      diameterDp,
      column: COLUMN[id],
      row: ROW[id],
    };
  });
  return { slots, widthDp, heightDp, diameterDp, scale: s };
}
