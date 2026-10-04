'use client';

import { useMemo } from 'react';
import { tv } from 'tailwind-variants';
import { brand } from '@acme/theme';
import { Figure, List, ListItem } from '../primitives';
import { Text } from '../Text';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { Text as TWText, View } from '../tw';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import {
  categoryLabels, describeSeries, formatValue, niceTicks, resolveSeries,
  type ChartDatum, type SeriesInput,
} from './chart-model';
import { keylineFor, seriesColor, type District } from './district-tones';
import { LinePlot } from './LinePlot';
import type { GlowLevel, PlotSeries } from './LinePlot.types';

export type { ChartDatum, SeriesInput, District, GlowLevel };

export interface NeonLineChartProps {
  /** One object per x category, keyed by `xAxisKey` and each series' dataKey. */
  data: ChartDatum[];
  /** Series to draw. Omit for one series and use the dataKey/color/label shorthand. */
  series?: SeriesInput[];
  /** Single-series shorthand. Default "value". */
  dataKey?: string;
  /** Single-series shorthand: preset (cyan, pink, green...), brand token or CSS colour. Default: the district's hero colour. */
  color?: string;
  /** Single-series shorthand label. */
  label?: string;
  /** Key for the x labels. Default "name". */
  xAxisKey?: string;
  /** Neighbourhood palette. Default midtown (orange over royal). */
  district?: District;
  /** Plot height in px. Default 260. */
  height?: number;
  /** Gradient fill under each line. Default true. */
  area?: boolean;
  /** Horizontal grid lines at the y ticks. Default true. */
  grid?: boolean;
  /** Legend under the plot. Default: on when there is more than one series. */
  legend?: boolean;
  /** Line width in px. Default 3. */
  strokeWidth?: number;
  /** Royal keyline under each line, the wordmark's outline. Default true. */
  keyline?: boolean;
  /** Accent glow under the line. Default low. */
  glowIntensity?: GlowLevel;
  showYAxis?: boolean;
  showXAxis?: boolean;
  /** Scrub to read a point: pan on native, pointer on web. Default true. */
  selectable?: boolean;
  /** Pulsing dot on the latest point. Default true. */
  indicator?: boolean;
  /** Called with the scrubbed index, or null when scrubbing ends. */
  onPointSelected?: (index: number | null) => void;
  /** Caption for the figure; also the readout heading. */
  title?: string;
  className?: string;
}

const chart = tv({
  slots: {
    root: 'w-full gap-3',
    head: 'flex-row items-end justify-between gap-3',
    readLabel: 'text-silver-400',
    // No colour class: the lead is white, the rest take their series colour
    // inline (on web a colour utility is !important and would beat it).
    readValue: 'font-display text-2xl md:text-3xl',
    body: 'flex-row gap-2',
    yAxis: 'relative w-10',
    tick: 'absolute right-0 text-xs text-silver-500',
    plot: 'relative flex-1 overflow-hidden',
    gridLine: 'absolute inset-x-0 border-t border-royal-900',
    xAxis: 'relative h-5',
    xLabel: 'absolute top-0 w-12 text-center text-xs text-silver-500',
    legend: 'flex-row flex-wrap gap-x-4 gap-y-1',
    legendItem: 'flex-row items-center gap-2',
    swatch: 'h-3 w-3 border-2',
  },
});

/**
 * NeonBlade's NeonLineChart, NYC-MON style: thick solid lines on a royal
 * keyline (the wordmark's orange-on-royal), a gradient fill, a scrub readout
 * in the jersey face, and district palettes. Native draws with
 * react-native-graph; web with a Skia path (see LinePlot.web.tsx).
 */
export function NeonLineChart({
  data,
  series,
  dataKey = 'value',
  color,
  label,
  xAxisKey = 'name',
  district = 'midtown',
  height = 260,
  area = true,
  grid = true,
  legend,
  strokeWidth = 3,
  keyline = true,
  glowIntensity = 'low',
  showYAxis = true,
  showXAxis = true,
  selectable = true,
  indicator = true,
  onPointSelected,
  title,
  className,
}: NeonLineChartProps) {
  const reduced = useReducedMotion();
  const { size: plotSize, onLayout: onPlotLayout } = useLayoutSize();
  const resolved = useMemo(() => resolveSeries(data, series, { dataKey, label, color }), [data, series, dataKey, label, color]);
  const labels = useMemo(() => categoryLabels(data, xAxisKey), [data, xAxisKey]);
  const ticks = useMemo(() => niceTicks(resolved.flatMap((s) => s.values), 4), [resolved]);
  const plotSeries = useMemo<PlotSeries[]>(
    () =>
      resolved.map((s, i) => {
        const c = seriesColor(i, district, s.color);
        return { values: s.values, color: c, keyline: keylineFor(c) };
      }),
    [resolved, district],
  );
  const range = useMemo(() => ({ min: ticks.min, max: ticks.max }), [ticks]);

  const selection = useInstanceStore<{ index: number }>(() => ({ index: -1 }));
  const selected = useStore(selection, (s) => s.index);
  const onSelect = (index: number | null) => {
    selection.setState({ index: index ?? -1 });
    onPointSelected?.(index);
  };

  const pad = strokeWidth + 6;
  const n = labels.length;
  const shown = selected >= 0 ? selected : n - 1;
  const lead = resolved[0];
  const s = chart();
  const yOf = (t: number) => pad + (height - pad * 2) * (1 - (t - ticks.min) / (ticks.max - ticks.min || 1));
  // Thin the x labels to what fits: one per ~56px of plot.
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotSize.width / 56))));
  const xOf = (i: number) => pad + (n <= 1 ? 0.5 : i / (n - 1)) * (plotSize.width - pad * 2);
  const summary = resolved.map((r) => describeSeries(r, labels)).join(' ');
  const showLegend = legend ?? resolved.length > 1;

  return (
    <Figure className={s.root({ className })} aria-label={title ? `${title}. ${summary}` : summary}>
      {lead && n ? (
        <View className={s.head()}>
          <View className="gap-0.5">
            <Text variant="caption" className={s.readLabel()}>
              {title ? `${title}, ${labels[shown]}` : labels[shown]}
            </Text>
            <View className="flex-row flex-wrap items-baseline gap-x-4">
              {resolved.map((r, i) => (
                <TWText
                  key={r.dataKey}
                  className={s.readValue()}
                  // Series colour is a runtime value, not a theme class.
                  style={{ color: i > 0 ? plotSeries[i]!.color : brand.white }}
                >
                  {formatValue(r.values[shown] ?? 0)}
                </TWText>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      <View className={s.body()}>
        {showYAxis ? (
          // Computed geometry: the axis is as tall as the plot.
          <View aria-hidden className={s.yAxis()} style={{ height }}>
            {ticks.ticks.map((t) => (
              // Computed geometry: each tick sits at its value's y.
              <Text key={t} className={s.tick()} style={{ top: yOf(t) - 8 }}>
                {formatValue(t)}
              </Text>
            ))}
          </View>
        ) : null}
        {/* Computed geometry: plot height is a numeric prop. */}
        <View className={s.plot()} style={{ height }} onLayout={onPlotLayout}>
          {grid
            ? ticks.ticks.map((t) => <View key={t} aria-hidden className={s.gridLine()} style={{ top: yOf(t) }} />)
            : null}
          <LinePlot
            series={plotSeries}
            range={range}
            strokeWidth={strokeWidth}
            area={area}
            keylines={keyline}
            glow={glowIntensity}
            selectable={selectable}
            indicator={indicator}
            onSelect={onSelect}
            reduced={reduced}
            pad={pad}
          />
        </View>
      </View>

      {showXAxis && n ? (
        <View aria-hidden className={s.xAxis()} style={showYAxis ? { marginLeft: 48 } : undefined}>
          {labels.map((l, i) =>
            i % every === 0 ? (
              // Computed geometry: label centred under its point, kept inside the plot.
              <Text
                key={`${l}-${i}`}
                numberOfLines={1}
                className={s.xLabel()}
                style={{ left: Math.min(Math.max(0, xOf(i) - 24), Math.max(0, plotSize.width - 48)) }}
              >
                {l}
              </Text>
            ) : null,
          )}
        </View>
      ) : null}

      {showLegend ? (
        <List className={s.legend()}>
          {resolved.map((r, i) => (
            <ListItem key={r.dataKey} className={s.legendItem()}>
              {/* Series colour is a runtime value. */}
              <View aria-hidden className={s.swatch()} style={{ backgroundColor: plotSeries[i]!.color, borderColor: plotSeries[i]!.keyline }} />
              <Text variant="caption" className="text-silver-300">{r.label}</Text>
            </ListItem>
          ))}
        </List>
      ) : null}
    </Figure>
  );
}
