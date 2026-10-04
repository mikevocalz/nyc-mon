'use client';

import { useMemo } from 'react';
import { tv } from 'tailwind-variants';
import { brand } from '@acme/theme';
import { Figure, List, ListItem } from '../primitives';
import { Text } from '../Text';
import { shadeSteps } from '../neon/shade';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { Text as TWText, View } from '../tw';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import {
  bandAt, barLayout, categoryLabels, formatValue, resolveSeries, type ChartDatum, type SeriesInput,
} from './chart-model';
import { DISTRICT_LIGHT, districtSeries, seriesColor, seriesShades, type District } from '../district';
import { BarCanvas } from './BarCanvas';
import { GLOW_BLUR, type GlowLevel } from './LinePlot.types';
import { plotPointer } from './plot-pointer';

export interface NeonBarChartProps {
  data: ChartDatum[];
  /** Bar series. Omit for one series and use the dataKey/color/label shorthand. */
  series?: SeriesInput[];
  /** Default "value". */
  dataKey?: string;
  color?: string;
  label?: string;
  /** Default "name". */
  xAxisKey?: string;
  district?: District;
  /** Plot height in px. Default 260. */
  height?: number;
  /** NeonBlade name: "vertical" bars stand up as buildings, "horizontal" bars lie along the street. Default vertical. */
  layout?: 'vertical' | 'horizontal';
  /** Fraction of each category band left as street, 0 to 0.9. Default 0.35. */
  barGap?: number;
  grid?: boolean;
  /** Legend under the plot. Default: on with more than one series. */
  legend?: boolean;
  showYAxis?: boolean;
  showXAxis?: boolean;
  /** Accent glow around the selected building. Default medium. */
  glowIntensity?: GlowLevel;
  /** Single series: each building takes the next district colour. Default false. */
  multiColor?: boolean;
  /** Lit windows on the faces. Default true. */
  windows?: boolean;
  /** The tallest building gets its district's crown (spire, deco top, cornice, sky bridge). Default true. */
  crown?: boolean;
  /** Called with the selected category index, or null. */
  onBarSelected?: (index: number | null) => void;
  title?: string;
  className?: string;
}

const chart = tv({
  slots: {
    root: 'w-full gap-3',
    body: 'flex-row gap-2',
    yAxis: 'relative w-10',
    tick: 'absolute right-0 text-xs text-silver-500',
    catAxis: 'relative w-20',
    catLabel: 'absolute right-0 text-right text-xs text-silver-400',
    plot: 'relative flex-1',
    gridLine: 'absolute border-royal-900',
    xAxis: 'relative h-5',
    xLabel: 'absolute top-0 text-center text-xs text-silver-400',
    tickLabel: 'absolute top-0 w-16 text-center text-xs text-silver-500',
    tip: 'absolute border-2 border-ink-700 bg-ink-950 px-3 py-2',
    tipTitle: 'text-xs text-silver-400',
    // No colour class: the value colour is set inline (see NeonLineChart).
    tipValue: 'font-display text-lg',
    legend: 'flex-row flex-wrap gap-x-4 gap-y-1',
    legendItem: 'flex-row items-center gap-2',
    swatch: 'h-3 w-3',
  },
});

/**
 * NeonBlade's NeonBarChart, redrawn as a block of the city: each value is a
 * solid building with a side wall, a lit roof and windows, standing on a
 * street, and the tallest wears its district's crown. Pointer hover (web) or
 * a tap (touch) selects a category and shows its values. Skia on every
 * platform (CanvasKit on web).
 */
export function NeonBarChart({
  data,
  series,
  dataKey = 'value',
  color,
  label,
  xAxisKey = 'name',
  district = 'midtown',
  height = 260,
  layout: orientation = 'vertical',
  barGap = 0.35,
  grid = true,
  legend,
  showYAxis = true,
  showXAxis = true,
  glowIntensity = 'medium',
  multiColor = false,
  windows = true,
  crown = true,
  onBarSelected,
  title,
  className,
}: NeonBarChartProps) {
  const reduced = useReducedMotion();
  const vertical = orientation === 'vertical';
  const { size, onLayout } = useLayoutSize();
  const resolved = useMemo(() => resolveSeries(data, series, { dataKey, label, color }), [data, series, dataKey, label, color]);
  const labels = useMemo(() => categoryLabels(data, xAxisKey), [data, xAxisKey]);
  const geometry = useMemo(
    () => barLayout({ series: resolved, width: size.width, height, layout: orientation, barGap }),
    [resolved, size.width, height, orientation, barGap],
  );
  const shades = useMemo(() => {
    const tones = districtSeries(district);
    return geometry.bars.map((b) =>
      multiColor && resolved.length === 1 && !resolved[0]!.color
        ? shadeSteps(tones[b.index % tones.length]!)
        : seriesShades(b.series, district, resolved[b.series]!.color),
    );
  }, [geometry, district, multiColor, resolved]);

  const selection = useInstanceStore<{ index: number }>(() => ({ index: -1 }));
  const selected = useStore(selection, (s) => s.index);
  const select = (index: number) => {
    if (index === selection.getState().index) return;
    selection.setState({ index });
    onBarSelected?.(index < 0 ? null : index);
  };
  const pointer = plotPointer(
    (x, y) => select(bandAt(vertical ? x : y, geometry)),
    () => select(-1),
  );

  const s = chart();
  const { ticks } = geometry;
  const span = ticks.max - ticks.min || 1;
  // Value-axis position of a tick, matching barLayout's scale.
  const across = vertical ? height : size.width;
  const headroom = Math.min(across * 0.12, 18) + (geometry.bars[0]?.depth ?? 0);
  const usable = Math.max(1, across - headroom);
  const tickPos = (t: number) => (vertical ? across - ((t - ticks.min) / span) * usable : ((t - ticks.min) / span) * usable);
  const showLegend = legend ?? resolved.length > 1;
  const legendColor = (i: number) => seriesColor(i, district, resolved[i]!.color);
  const summary = `${title ? `${title}. ` : ''}${resolved
    .map((r) => `${r.label}: ${r.values.map((v, i) => `${labels[i]} ${formatValue(v)}`).join(', ')}`)
    .join('. ')}.`;

  const center = selected >= 0 ? geometry.centers[selected] ?? 0 : 0;
  const tipWidth = 144;

  return (
    <Figure className={s.root({ className })} aria-label={summary}>
      <View className={s.body()}>
        {vertical && showYAxis ? (
          // Computed geometry: axis as tall as the plot.
          <View aria-hidden className={s.yAxis()} style={{ height }}>
            {ticks.ticks.map((t) => (
              <Text key={t} className={s.tick()} style={{ top: tickPos(t) - 8 }}>
                {formatValue(t)}
              </Text>
            ))}
          </View>
        ) : null}
        {!vertical && showXAxis ? (
          <View aria-hidden className={s.catAxis()} style={{ height }}>
            {labels.map((l, i) => (
              <Text key={`${l}-${i}`} numberOfLines={1} className={s.catLabel()} style={{ top: (geometry.centers[i] ?? 0) - 8 }}>
                {l}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Computed geometry: plot height is a numeric prop. */}
        <View className={s.plot()} style={{ height }} onLayout={onLayout} {...pointer}>
          {grid
            ? ticks.ticks.map((t) =>
                vertical ? (
                  <View key={t} aria-hidden className={`${s.gridLine()} inset-x-0 border-t`} style={{ top: tickPos(t) }} />
                ) : (
                  <View key={t} aria-hidden className={`${s.gridLine()} inset-y-0 border-l`} style={{ left: tickPos(t) }} />
                ),
              )
            : null}
          {size.width > 1 ? (
            <BarCanvas
              layout={geometry}
              width={size.width}
              height={height}
              orientation={orientation}
              shades={shades}
              light={DISTRICT_LIGHT[district]}
              district={district}
              selected={selected}
              windows={windows}
              crown={crown}
              glow={GLOW_BLUR[glowIntensity]}
              reduced={reduced}
            />
          ) : null}
          {selected >= 0 ? (
            <View
              pointerEvents="none"
              className={s.tip()}
              // Computed geometry: the readout follows the selected category, clamped inside the plot.
              style={
                vertical
                  ? { top: 4, left: Math.min(Math.max(0, center - tipWidth / 2), Math.max(0, size.width - tipWidth)), width: tipWidth }
                  : { right: 4, top: Math.min(Math.max(0, center - 30), Math.max(0, height - 64)), width: tipWidth }
              }
            >
              <Text className={s.tipTitle()}>{labels[selected]}</Text>
              {resolved.map((r, i) => (
                <View key={r.dataKey} className="flex-row items-baseline gap-2">
                  {/* Series colour is a runtime value. */}
                  <TWText className={s.tipValue()} style={{ color: resolved.length > 1 ? legendColor(i) : brand.white }}>
                    {formatValue(r.values[selected] ?? 0)}
                  </TWText>
                  {resolved.length > 1 ? <Text className="text-xs text-silver-400">{r.label}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {vertical && showXAxis ? (
        <View aria-hidden className={s.xAxis()} style={showYAxis ? { marginLeft: 48 } : undefined}>
          {labels.map((l, i) => (
            // Computed geometry: label centred under its building.
            <Text
              key={`${l}-${i}`}
              numberOfLines={1}
              className={s.xLabel()}
              style={{ left: (geometry.centers[i] ?? 0) - (geometry.band - 4) / 2, width: geometry.band - 4 }}
            >
              {l}
            </Text>
          ))}
        </View>
      ) : null}
      {!vertical && showYAxis ? (
        <View aria-hidden className={s.xAxis()} style={showXAxis ? { marginLeft: 88 } : undefined}>
          {ticks.ticks.map((t) => (
            <Text key={t} className={s.tickLabel()} style={{ left: tickPos(t) - 32 }}>
              {formatValue(t)}
            </Text>
          ))}
        </View>
      ) : null}

      {showLegend ? (
        <List className={s.legend()}>
          {resolved.map((r, i) => (
            <ListItem key={r.dataKey} className={s.legendItem()}>
              {/* Series colour is a runtime value. */}
              <View aria-hidden className={s.swatch()} style={{ backgroundColor: legendColor(i) }} />
              <Text variant="caption" className="text-silver-300">{r.label}</Text>
            </ListItem>
          ))}
        </List>
      ) : null}
    </Figure>
  );
}
