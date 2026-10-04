/**
 * Geometry of the decorative scanner fan drawn by `ScannerLed`. The fan
 * rises from the emitter to the top edge of the black head and never leaves
 * it (DIRECTION.md "Translation choices": never over the status bar).
 * Angle and spread are `TODO(canon)` until the Decision #16 sheet lands.
 */
export interface ScannerFanProps {
  /** wedge width at the head's top edge, in points */
  widthPt: number;
  /** wedge height, emitter to head top, in points */
  heightPt: number;
}

/** Wedge polygon in percent of its box: apex at the bottom centre. */
export const FAN_POLYGON: readonly [number, number][] = [
  [0, 0],
  [100, 0],
  [56, 100],
  [44, 100],
];
