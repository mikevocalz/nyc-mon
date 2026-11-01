// Where the stick, the six-button cluster and the START/STOP pill go, for the
// current container, insets, folds, hardware family and controller profile.
// Pure: no react-native import, so node --test covers every profile in the
// directive's §10 table and the foldable skill's acceptance scenarios.
//
// Policy, in order of authority:
// 1. Every control rect lies wholly inside ONE usable region (insets removed,
//    container cut by every splitting fold). Nothing straddles a hinge, ever,
//    including a saved position: those are revalidated here on every call.
// 2. The §10 table picks the arrangement per profile. Compact: stick
//    lower-left, cluster lower-right, pill in the upper safe band. Landscape:
//    both groups in the lower grip zones, centre clear. Book: groups in the
//    reachable grips of separate segments. Tabletop: gameplay in the upper
//    region, controller in the lower, pill centred on the controller region's
//    upper edge. Trifold: every fold processed; the pill only takes a segment
//    wide enough for it. Tablet: clusters near the real grip regions (raised
//    bottom corners), adjustable. Web: pointer, same geometry as the aspect
//    suggests.
// 3. Hands are physical. Left-handed mirrors the groups; RTL does not: a
//    locale changes reading order, not which thumb is where. `isRTL` is
//    accepted so children can lay out their own labels and is echoed back.
//    Decision: BUILD mirror on handedness only; RTL never mirrors (§2A/§2B
//    name a left stick and a right cluster as the arcade convention).
// 4. Scale shrinks until both groups fit their region(s) side by side with
//    the pill above, so they never overlap. Below USABLE_SCALE_MIN the layout
//    reports `cramped` (0.8, the arch's own floor): AdaptiveControlLayout
//    then drops the stick and cluster and keeps the pill; the resolver never
//    fakes room. The pill never scales below 1 so its height
//    stays at or above the 44 pt target (WCAG 2.5.5; 2.5.8 needs 24).
// 5. The stage is the largest rectangle clear of all three controls (and of
//    any fully occluding hinge). A non-occluding separating crease may run
//    through the stage: the world canvas spans the container (Game HUD rule),
//    and the stage is a sightline, not a touch target.
import { WINDOW_SIZE_CLASS_MIN_WIDTH_DP } from '../../adaptive-panes/constants.ts';
import type { FoldLayout, FoldPosture } from '../../adaptive-panes/fold-layout.ts';
import type { HardwareFamily } from '../../hardware-family.ts';
import type { ControllerProfile, LayoutProfile } from '../contract.ts';
import {
  clampIntoRegion,
  foldSplits,
  intersects,
  largestClearRect,
  usableRegions,
  type Insets,
  type Rect,
} from './geometry.ts';
import { revalidatePosition, type SavedControlLayouts } from './revalidate-positions.ts';

export type { Insets, Rect } from './geometry.ts';

/** Which runtime draws the controller. Web has a pointer and no hinge module. */
export type ControllerRuntime = 'native' | 'web';

/** Input to {@linkcode resolveControllerLayout}. All geometry is container-local. */
export interface ControllerLayoutInput {
  readonly width: number;
  readonly height: number;
  /** Safe-area insets the host has not already consumed. */
  readonly insets: Insets;
  /** Folds in container-local coordinates, every one reported. */
  readonly folds: readonly FoldLayout[];
  /** Physical edge holding the navigation rail, or null for a bottom bar / none. */
  readonly railEdge: 'left' | 'right' | null;
  readonly isRTL: boolean;
  readonly hardwareFamily: HardwareFamily;
  readonly runtime: ControllerRuntime;
  /** The parts of the controller profile that move geometry. */
  readonly controller: Pick<ControllerProfile, 'handedness' | 'scale'>;
  /** Saved customizations, already shape-validated. Re-placed here on every call. */
  readonly saved?: SavedControlLayouts;
}

/**
 * The resolved arrangement, returned by {@linkcode resolveControllerLayout}.
 * Every rect is wholly inside one entry of `regions`.
 */
export interface ControllerLayout {
  readonly profile: LayoutProfile;
  /** Posture of the splitting fold the layout was built around, or `flat`. */
  readonly posture: FoldPosture;
  /** Usable regions after insets and folds, top-to-bottom then left-to-right. */
  readonly regions: readonly Rect[];
  readonly stick: Rect;
  readonly cluster: Rect;
  readonly pill: Rect;
  /** The world's clear sightline: the largest rect clear of the three controls. */
  readonly stage: Rect;
  /** The scale the controls were laid out at, after shrink-to-fit. */
  readonly scale: number;
  /**
   * True when fitting forced `scale` under {@linkcode USABLE_SCALE_MIN}: the
   * segment is too small for a usable touch controller. The rects are still
   * valid and non-overlapping; the host chooses what to do with them.
   */
  readonly cramped: boolean;
  /** True when the groups are mirrored for a left-handed player. */
  readonly mirrored: boolean;
  readonly isRTL: boolean;
}

/** Control footprints at scale 1, in layout units. */
export const CONTROL_SIZE_DP = {
  /** Stick base diameter: the contract's 56 dp clamp radius plus a ring. */
  stick: { width: 128, height: 128 },
  /** Six 56 dp caps in two staggered rows of three with 12 dp gaps and a 12 dp arch rise. */
  // The -45° cluster box is 193 x 188 (six-button-arch.ts) plus the old +16/+8 padding.
  cluster: { width: 209, height: 196 },
  /** START/STOP pill. Height stays at or above 44 pt whatever the scale. */
  pill: { width: 168, height: 48 },
} as const;

/** Clearance from a region's edge for phones, foldables and web. */
export const CONTROL_MARGIN_DP = 16;
/** The groups sit this close to the bottom edge (above the safe-area inset): low, where the thumbs rest. */
export const CONTROL_BOTTOM_MARGIN_DP = 8;
/** Tablets are held further in from the corners; the groups follow the thumbs. */
export const TABLET_GRIP_MARGIN_DP = 16;
/** On a tablet the thumbs rest above the bottom corner, so the groups rise. */
// Decision (2026-10-16, device): 0. On the spanned Surface Duo (classed tablet)
// the raise left the stick 88 dp above the bottom edge; Mike: "bring whole
// gamepad down close to bottom". Thumbs reach the bottom corners on every
// profile we ship today.
export const TABLET_GRIP_RAISE_DP = 0;
/** Extra clearance between a group and a navigation rail on the same physical edge. */
export const RAIL_CLEARANCE_DP = 8;
/**
 * Below this scale the stick and caps are too small to play; the layout
 * reports `cramped`. It equals the profile schema's lower bound and the
 * clamp `sixButtonArch` applies, so an uncramped cluster slot always holds
 * the arch it renders (finding M3: at 0.6 the slot shrank under the arch's
 * 0.8 floor and caps overflowed onto a hinge).
 */
export const USABLE_SCALE_MIN = 0.8;
/** Breathing room between the stage and a control. */
const STAGE_GAP_DP = 8;

/** Android's medium width class lower bound: 600 dp (`widthClassMinDp` token). */
const TABLET_SMALLEST_SIDE_DP = WINDOW_SIZE_CLASS_MIN_WIDTH_DP.medium;

/**
 * Which §10 row applies. A splitting fold decides first (the hardware family
 * may still read `unknown` on the first frame a hinge reports); then the
 * family; then, for `unknown`, the current size (the foldable skill: usable
 * space chooses content layout, and unknown never means "verified phone").
 */
export function resolveLayoutProfile(
  input: Pick<ControllerLayoutInput, 'runtime' | 'hardwareFamily' | 'width' | 'height' | 'folds'>,
): LayoutProfile {
  if (input.runtime === 'web') return 'web';
  const splitting = input.folds.filter(foldSplits);
  if (splitting.some((fold) => fold.orientation === 'horizontal')) return 'fold-tabletop';
  if (splitting.length > 0) return 'fold-book';
  const smallestSide = Math.min(input.width, input.height);
  const landscape = input.width > input.height;
  switch (input.hardwareFamily) {
    case 'tablet':
    case 'headset':
      return 'tablet';
    case 'foldable':
      // No splitting fold: the cover screen, or the inner display open flat
      // with a non-separating crease. The latter is a tablet-sized surface.
      return smallestSide >= TABLET_SMALLEST_SIDE_DP ? 'tablet' : 'fold-outer';
    case 'phone':
      return landscape ? 'phone-landscape' : 'phone-portrait';
    case 'unknown':
      if (smallestSide >= TABLET_SMALLEST_SIDE_DP) return 'tablet';
      return landscape ? 'phone-landscape' : 'phone-portrait';
  }
}

interface Size {
  readonly width: number;
  readonly height: number;
}

function scaled(size: Size, scale: number): Size {
  return { width: size.width * scale, height: size.height * scale };
}

function right(r: Rect): number {
  return r.x + r.width;
}

function bottom(r: Rect): number {
  return r.y + r.height;
}

/** The scale at which `need` (at scale 1) fits in `room`, capped at `scale`, never negative. */
function fitScale(scale: number, constraints: readonly { need: number; room: number }[]): number {
  let fitted = scale;
  for (const { need, room } of constraints) {
    if (need > 0) fitted = Math.min(fitted, room / need);
  }
  return Math.max(0, fitted);
}

/** Among `candidates`, the one whose centre is nearest `centreX`; ties go to `preferred`. */
function centreMost(candidates: readonly Rect[], centreX: number, preferred: Rect): Rect {
  let best = candidates[0] ?? preferred;
  let bestDistance = Infinity;
  for (const region of candidates) {
    const distance = Math.abs(region.x + region.width / 2 - centreX);
    if (distance < bestDistance - 1e-6 || (Math.abs(distance - bestDistance) <= 1e-6 && region === preferred)) {
      best = region;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Lay the controller out. Deterministic for equal input, so a resize or fold
 * that changes nothing relevant yields an identical layout.
 *
 * @see {@linkcode ControllerLayout} for what comes back and its guarantees.
 */
export function resolveControllerLayout(input: ControllerLayoutInput): ControllerLayout {
  const profile = resolveLayoutProfile(input);
  const regions = usableRegions(input.width, input.height, input.insets, input.folds);
  const empty: Rect = { x: input.insets.left, y: input.insets.top, width: 0, height: 0 };
  const all: readonly Rect[] = regions.length > 0 ? regions : [empty];
  const splittingFold = input.folds.find(foldSplits);
  const posture: FoldPosture = splittingFold?.posture ?? 'flat';
  const mirrored = input.controller.handedness === 'left';
  const tablet = profile === 'tablet';
  const margin = tablet ? TABLET_GRIP_MARGIN_DP : CONTROL_MARGIN_DP;
  const raise = tablet ? TABLET_GRIP_RAISE_DP : 0;
  const leftClearance = input.railEdge === 'left' ? RAIL_CLEARANCE_DP : 0;
  const rightClearance = input.railEdge === 'right' ? RAIL_CLEARANCE_DP : 0;

  // Grip regions: the bottom row of usable regions, left to right.
  const bottomY = Math.max(...all.map((r) => r.y));
  const bottomRow = all.filter((r) => r.y === bottomY).sort((a, b) => a.x - b.x);
  const first = bottomRow[0] ?? empty;
  const last = bottomRow[bottomRow.length - 1] ?? first;
  const stickRegion = mirrored ? last : first;
  const clusterRegion = mirrored ? first : last;

  // Pill region: the controller row's centre-most segment in tabletop, else the
  // top row's centre-most segment wide enough for it; the cluster's segment
  // (the dominant hand) when none is.
  const topY = Math.min(...all.map((r) => r.y));
  const pillRow = profile === 'fold-tabletop' ? bottomRow : all.filter((r) => r.y === topY);
  const centreX = input.width / 2;

  // Shrink-to-fit. Saved scale replaces the profile scale for this layout profile.
  const savedForProfile = input.saved?.[profile];
  const requested = savedForProfile?.scale ?? input.controller.scale;
  const sameRegion = stickRegion === clusterRegion;
  const pillH1 = CONTROL_SIZE_DP.pill.height;
  const tallest = Math.max(CONTROL_SIZE_DP.stick.height, CONTROL_SIZE_DP.cluster.height);
  const scale = fitScale(requested, sameRegion
    ? [
        { need: CONTROL_SIZE_DP.stick.width + CONTROL_SIZE_DP.cluster.width, room: stickRegion.width - 3 * margin - leftClearance - rightClearance },
        { need: tallest, room: stickRegion.height - 3 * margin - raise - pillH1 },
      ]
    : [
        { need: CONTROL_SIZE_DP.stick.width, room: stickRegion.width - 2 * margin - leftClearance - rightClearance },
        { need: CONTROL_SIZE_DP.cluster.width, room: clusterRegion.width - 2 * margin - leftClearance - rightClearance },
        { need: CONTROL_SIZE_DP.stick.height, room: stickRegion.height - 3 * margin - raise - pillH1 },
        { need: CONTROL_SIZE_DP.cluster.height, room: clusterRegion.height - 3 * margin - raise - pillH1 },
      ]);
  const stickSize = scaled(CONTROL_SIZE_DP.stick, scale);
  const clusterSize = scaled(CONTROL_SIZE_DP.cluster, scale);
  const pillSize = scaled(CONTROL_SIZE_DP.pill, Math.max(1, scale));

  const pillWide = pillRow.filter((r) => r.width >= pillSize.width + 2 * margin);
  const pillRegion = centreMost(pillWide.length > 0 ? pillWide : [clusterRegion], centreX, clusterRegion);

  // Default corners. The group on the physical left keeps the left clearance,
  // the one on the physical right keeps the right clearance.
  const placeLeft = (region: Rect, size: Size): Rect => ({
    x: region.x + margin + leftClearance,
    y: bottom(region) - CONTROL_BOTTOM_MARGIN_DP - raise - size.height,
    ...size,
  });
  const placeRight = (region: Rect, size: Size): Rect => ({
    x: right(region) - margin - rightClearance - size.width,
    y: bottom(region) - CONTROL_BOTTOM_MARGIN_DP - raise - size.height,
    ...size,
  });
  const stickDefault = mirrored ? placeRight(stickRegion, stickSize) : placeLeft(stickRegion, stickSize);
  const clusterDefault = mirrored ? placeLeft(clusterRegion, clusterSize) : placeRight(clusterRegion, clusterSize);
  const pill = clampIntoRegion(
    { x: pillRegion.x + (pillRegion.width - pillSize.width) / 2, y: pillRegion.y + margin, ...pillSize },
    pillRegion,
    margin,
  );

  // Saved offsets, revalidated against the current regions. A pair of offsets
  // that makes the groups collide, or lands one on the pill, is corrupt for
  // these metrics and is discarded as a pair rather than half-applied.
  let stick = revalidatePosition(stickDefault, savedForProfile?.stick, all, margin);
  let cluster = revalidatePosition(clusterDefault, savedForProfile?.cluster, all, margin);
  if (intersects(stick, cluster) || intersects(stick, pill) || intersects(cluster, pill)) {
    stick = revalidatePosition(stickDefault, undefined, all, margin);
    cluster = revalidatePosition(clusterDefault, undefined, all, margin);
  }

  // Stage. Tabletop: the upper region(s), where the world is. Otherwise the
  // largest clear rect across the container cut only by occluding hinges.
  const obstacles = [stick, cluster, pill];
  let stage: Rect;
  if (profile === 'fold-tabletop' && all.some((r) => r.y < bottomY)) {
    const upper = all.filter((r) => r.y < bottomY);
    stage = upper
      .map((r) => largestClearRect(r, obstacles, STAGE_GAP_DP))
      .reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  } else {
    const occluding = input.folds.filter((f) => f.occlusionType === 'full');
    const sightRegions = usableRegions(input.width, input.height, input.insets, occluding);
    stage = (sightRegions.length > 0 ? sightRegions : all)
      .map((r) => largestClearRect(r, obstacles, STAGE_GAP_DP))
      .reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  }

  return {
    profile,
    posture,
    regions: all,
    stick,
    cluster,
    pill,
    stage,
    scale,
    cramped: scale < USABLE_SCALE_MIN,
    mirrored,
    isRTL: input.isRTL,
  };
}
