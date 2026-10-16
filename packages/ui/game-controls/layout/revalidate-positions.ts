// Saved controller positions, and how they are trusted: never as-is.
//
// A player can move the stick and the six-button cluster (directive §10
// tablet row, §13 "cluster placement") and the choice is persisted per
// LayoutProfile by the app's controller-layout store. Two things make the
// saved data unsafe to apply blindly: the blob outlives releases, so its
// shape may rot, and the metrics it was saved under (window, posture, hinge,
// insets) are gone by the time it is read. So the store parses the blob
// through {@linkcode parseSavedControlLayouts}, which drops anything that is
// not a finite in-range number, and the layout resolver re-places every saved
// control through {@linkcode revalidatePosition} on every metrics change,
// which pulls it back inside a usable region and off every splitting fold.
//
// Pure: no react-native import, so node --test covers it.
import type { LayoutProfile } from '../contract.ts';
import { clampIntoRegion, regionFor, type Rect } from './geometry.ts';

/** How far a control was dragged from its default place, in layout units. */
export interface ControlOffset {
  readonly dx: number;
  readonly dy: number;
}

/** The two movable groups. The START/STOP pill keeps its safe band and never moves. */
export type MovableControl = 'stick' | 'cluster';

/**
 * One profile's customization. Every field is optional: a missing one means
 * "use the resolver's default".
 *
 * @see {@linkcode SavedControlLayouts}
 */
export interface SavedProfileLayout {
  readonly stick?: ControlOffset;
  readonly cluster?: ControlOffset;
  /** Replaces the controller profile's scale for this layout profile only. 0.8…1.4. */
  readonly scale?: number;
}

/**
 * Customizations keyed by the {@linkcode LayoutProfile} they were made under,
 * so a tabletop arrangement never applies to a phone in portrait.
 *
 * @see {@linkcode parseSavedControlLayouts}
 */
export type SavedControlLayouts = Readonly<Partial<Record<LayoutProfile, SavedProfileLayout>>>;

/** Every layout profile, for iteration and validation. Mirrors the contract's union. */
export const LAYOUT_PROFILES = [
  'phone-portrait',
  'phone-landscape',
  'fold-outer',
  'fold-book',
  'fold-tabletop',
  'tablet',
  'web',
] as const satisfies readonly LayoutProfile[];

/** Offsets beyond this are a corrupt blob, not a drag: no window is that wide. */
export const MAX_OFFSET_DP = 4096;
/** The control-scale range the contract documents on `ControllerProfile.scale`. */
export const CONTROL_SCALE_MIN = 0.8;
export const CONTROL_SCALE_MAX = 1.4;

/** The empty map, shared so equality checks stay cheap. */
export const EMPTY_SAVED_LAYOUTS: SavedControlLayouts = Object.freeze({});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLayoutProfile(value: string): value is LayoutProfile {
  return (LAYOUT_PROFILES as readonly string[]).includes(value);
}

/**
 * Clamp a dragged offset into the sane range. Throws on a non-finite value
 * because that is a programming error in the gesture, not user data.
 *
 * @throws {RangeError} when `dx` or `dy` is not a finite number.
 */
export function clampControlOffset(offset: ControlOffset): ControlOffset {
  if (!Number.isFinite(offset.dx) || !Number.isFinite(offset.dy)) {
    throw new RangeError(`Control offset must be finite, got dx=${offset.dx} dy=${offset.dy}`);
  }
  return {
    dx: Math.min(MAX_OFFSET_DP, Math.max(-MAX_OFFSET_DP, offset.dx)),
    dy: Math.min(MAX_OFFSET_DP, Math.max(-MAX_OFFSET_DP, offset.dy)),
  };
}

/**
 * Clamp a control scale into the contract's 0.8…1.4 range.
 *
 * @throws {RangeError} when `scale` is not a finite number.
 */
export function clampControlScale(scale: number): number {
  if (!Number.isFinite(scale)) throw new RangeError(`Control scale must be finite, got ${scale}`);
  return Math.min(CONTROL_SCALE_MAX, Math.max(CONTROL_SCALE_MIN, scale));
}

/** A saved offset, or `undefined` when the value is not two finite in-range numbers. */
export function parseControlOffset(raw: unknown): ControlOffset | undefined {
  if (!isRecord(raw)) return undefined;
  const { dx, dy } = raw;
  if (typeof dx !== 'number' || typeof dy !== 'number') return undefined;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return undefined;
  if (Math.abs(dx) > MAX_OFFSET_DP || Math.abs(dy) > MAX_OFFSET_DP) return undefined;
  return { dx, dy };
}

/**
 * One profile's saved layout with every invalid field dropped, or `undefined`
 * when nothing valid remains (so the caller stores no empty entry).
 */
export function parseSavedProfileLayout(raw: unknown): SavedProfileLayout | undefined {
  if (!isRecord(raw)) return undefined;
  const out: { stick?: ControlOffset; cluster?: ControlOffset; scale?: number } = {};
  const stick = parseControlOffset(raw.stick);
  const cluster = parseControlOffset(raw.cluster);
  if (stick) out.stick = stick;
  if (cluster) out.cluster = cluster;
  const { scale } = raw;
  if (typeof scale === 'number' && Number.isFinite(scale) && scale >= CONTROL_SCALE_MIN && scale <= CONTROL_SCALE_MAX) {
    out.scale = scale;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The whole persisted map with unknown profiles and invalid entries dropped.
 * Never throws: a corrupt blob yields `{}` and the resolver's defaults, which
 * are always a safe layout.
 *
 * @see {@linkcode SavedControlLayouts}
 */
export function parseSavedControlLayouts(raw: unknown): SavedControlLayouts {
  if (!isRecord(raw)) return EMPTY_SAVED_LAYOUTS;
  const out: Partial<Record<LayoutProfile, SavedProfileLayout>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isLayoutProfile(key)) continue;
    const entry = parseSavedProfileLayout(value);
    if (entry) out[key] = entry;
  }
  return out;
}

/**
 * Re-place one control for the current metrics: the resolver's default rect
 * plus the saved offset, pulled back inside the usable region it lands in,
 * `margin` clear of that region's edges. Because usable regions already
 * exclude insets and splitting folds, the result can never straddle a hinge
 * or sit under a system bar. With no offset the default rect is still clamped,
 * so a default that no longer fits (a narrower segment) is corrected too.
 *
 * @see {@linkcode parseSavedControlLayouts} for the shape validation that runs before this.
 */
export function revalidatePosition(
  defaultRect: Rect,
  offset: ControlOffset | undefined,
  regions: readonly Rect[],
  margin: number,
): Rect {
  // No saved offset: the resolver already placed the default against the edges
  // (its bottom clearance is tighter than `margin`), so only keep it inside its
  // region (no extra margin); an oversized default still shrinks to fit.
  if (!offset) {
    const home = regionFor(defaultRect, regions);
    return home ? clampIntoRegion(defaultRect, home, 0) : { ...defaultRect, width: 0, height: 0 };
  }
  const moved: Rect = { ...defaultRect, x: defaultRect.x + offset.dx, y: defaultRect.y + offset.dy };
  const region = regionFor(moved, regions) ?? regionFor(defaultRect, regions);
  if (!region) return { ...defaultRect, width: 0, height: 0 };
  return clampIntoRegion(moved, region, margin);
}
