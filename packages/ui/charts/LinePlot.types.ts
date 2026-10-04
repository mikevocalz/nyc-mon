import type { CurveType } from './chart-model';

export type GlowLevel = 'none' | 'low' | 'medium' | 'high';

export const GLOW_BLUR: Record<GlowLevel, number> = { none: 0, low: 3, medium: 6, high: 10 };

export interface PlotSeries {
  values: number[];
  /** Resolved CSS colour. */
  color: string;
  /** Badge keyline under the stroke (royal under orange, like the wordmark). */
  keyline: string;
}

/**
 * The drawing surface shared by NeonLineChart and NeonSparkline. Native draws
 * it with react-native-graph; web draws the same curve with a Skia path (see
 * LinePlot.web.tsx for why).
 */
export interface LinePlotProps {
  series: PlotSeries[];
  /** Shared y range so stacked series line up. */
  range: { min: number; max: number };
  /** Stroke width in px. */
  strokeWidth: number;
  /** Gradient fill under each line. */
  area: boolean;
  /** Draw the keyline under each stroke. */
  keylines: boolean;
  glow: GlowLevel;
  /** Pan (native) or pointer (web) selection of a point. */
  selectable: boolean;
  /** Pulsing dot at the end of the first series. */
  indicator: boolean;
  /** Called with the selected index while scrubbing, and null when it ends. */
  onSelect?: (index: number | null) => void;
  /** Reduced motion: no intro, no pulse. */
  reduced: boolean;
  /** Inset so the stroke and the selection dot never clip. */
  pad: number;
  /**
   * Line shape. Web draws every kind; native draws react-native-graph's
   * spline, so non-smooth kinds fall back to the Skia plot there.
   */
  curve?: CurveType;
}
