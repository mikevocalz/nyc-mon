// Hit tests the touch adapters run inside gesture callbacks. Pure, no
// react-native import; the 'worklet' directive lets react-native-worklets run
// them on the UI thread (the plugin runs over kit sources in the mobile Babel
// config and the Storybook pre-transform). Under node the directive is an
// inert string.
import type { Direction8 } from './contract.ts';

/** True when (x, y) lies inside the circle centred at (cx, cy) with radius r. On the edge counts. */
export function insideCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  'worklet';
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Stick geometry at reference scale 1.0, in dp (docs/design/research/arcade-ergonomics.md §8). */
export const STICK_GEOMETRY_DP = {
  /** Round housing diameter. */
  housing: 128,
  /** The recessed well inside the housing. */
  well: 112,
  /** The thumbpad. */
  pad: 56,
  /**
   * How far the pad centre can travel from the housing centre: the well
   * radius 56 minus the pad radius 28, plus the 8 the pad may show past the
   * well edge. A full push parks the pad here, at the gate.
   */
  padTravel: 36,
  /** Glow margin the `left-stick` artboards add around the housing (LeftStick) and the pad (Thumbpad). */
  glowMargin: 8,
} as const;

/** Pill geometry, in dp; the pill never scales with the profile (G01 08-handoff.md § Layout). */
export const PILL_GEOMETRY_DP = {
  width: 120,
  height: 44,
  /** The touch target around the pill: 144 × 48, the Android floor named in `07-a11y.md`. */
  targetWidth: 144,
  targetHeight: 48,
  cornerCut: 8,
} as const;

/** The spoken value of the stick, G01 `05-copy.md` `g01.stick.value`. */
export const DIRECTION_WORDS: Readonly<Record<Direction8, string>> = {
  none: 'Centre',
  n: 'North',
  ne: 'North-east',
  e: 'East',
  se: 'South-east',
  s: 'South',
  sw: 'South-west',
  w: 'West',
  nw: 'North-west',
};
