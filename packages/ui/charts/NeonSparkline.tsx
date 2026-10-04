'use client';

import { useMemo } from 'react';
import { Text } from '../Text';
import { useInstanceStore, useStore } from '../use-instance-store';
import { View } from '../tw';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { describeSeries, formatValue } from './chart-model';
import { keylineFor, seriesColor, type District } from './district-tones';
import { LinePlot } from './LinePlot';
import type { GlowLevel } from './LinePlot.types';

export interface NeonSparklineProps {
  /** Points; each needs a number under `dataKey`. */
  data: Record<string, unknown>[];
  /** Default "value". */
  dataKey?: string;
  /** Preset, brand token or CSS colour. Default: the district's hero colour. */
  color?: string;
  district?: District;
  /** Width in px, or "100%" to fill the parent. Default 120. */
  width?: number | '100%';
  /** Height in px. Default 40. */
  height?: number;
  /** Default 2. */
  strokeWidth?: number;
  /** Default none: a sparkline sits inside text and cards. */
  glowIntensity?: GlowLevel;
  /** Gradient fill. Default true. */
  area?: boolean;
  /** Keyline under the stroke. Default false at sparkline size. */
  keyline?: boolean;
  /** Scrub readout in the corner. Default true. */
  tooltip?: boolean;
  /** Accessible name; the trend summary is appended. */
  label?: string;
  className?: string;
}

/**
 * NeonBlade's NeonSparkline: the line plot at word size, no axes. Scrubbing
 * shows the value in the corner.
 */
export function NeonSparkline({
  data,
  dataKey = 'value',
  color,
  district = 'midtown',
  width = 120,
  height = 40,
  strokeWidth = 2,
  glowIntensity = 'none',
  area = true,
  keyline = false,
  tooltip = true,
  label = 'Trend',
  className,
}: NeonSparklineProps) {
  const reduced = useReducedMotion();
  const values = useMemo(() => data.map((d) => Number(d[dataKey]) || 0), [data, dataKey]);
  // Tight to the data: a sparkline shows shape, not scale.
  const range = useMemo(() => {
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    return lo === hi ? { min: lo - 1, max: hi + 1 } : { min: lo, max: hi };
  }, [values]);
  const series = useMemo(() => {
    const c = seriesColor(0, district, color);
    return [{ values, color: c, keyline: keylineFor(c) }];
  }, [values, district, color]);
  const selection = useInstanceStore<{ index: number }>(() => ({ index: -1 }));
  const selected = useStore(selection, (s) => s.index);

  return (
    <View
      role="img"
      aria-label={describeSeries({ label, values }, [])}
      className={className}
      // Computed geometry: width and height are numeric props.
      style={{ width, height }}
    >
      <LinePlot
        series={series}
        range={range}
        strokeWidth={strokeWidth}
        area={area}
        keylines={keyline}
        glow={glowIntensity}
        selectable={tooltip}
        indicator={false}
        onSelect={(index) => selection.setState({ index: index ?? -1 })}
        reduced={reduced}
        pad={strokeWidth + 2}
      />
      {tooltip && selected >= 0 ? (
        <View pointerEvents="none" className="absolute right-0 top-0 bg-ink-950 px-1">
          <Text className="font-display text-xs text-white">{formatValue(values[selected] ?? 0)}</Text>
        </View>
      ) : null}
    </View>
  );
}
