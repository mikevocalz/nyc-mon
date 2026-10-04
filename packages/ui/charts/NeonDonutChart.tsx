'use client';

import { useMemo } from 'react';
import { tv } from 'tailwind-variants';
import { Figure, List, ListItem } from '../primitives';
import { Text } from '../Text';
import { neonColor } from '../neon/colors';
import { shadeSteps } from '../neon/shade';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { brand } from '@acme/theme';
import { Pressable, Text as TWText, View } from '../tw';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { donutSegments, formatValue, segmentAt } from './chart-model';
import { districtSeries, type District } from './district-tones';
import { DonutCanvas } from './DonutCanvas';
import { GLOW_BLUR, type GlowLevel } from './LinePlot.types';
import { plotPointer } from './plot-pointer';

export interface DonutSegmentInput {
  name: string;
  value: number;
  /** Preset, brand token or CSS colour. Default: the district's next colour. */
  color?: string;
}

export interface NeonDonutChartProps {
  data: DonutSegmentInput[];
  district?: District;
  /** Chart height in px. Default 260. */
  height?: number;
  /** Hole radius: a percentage string of the half-size, or px. Default "60%". */
  innerRadius?: string | number;
  /** Ring radius: a percentage string of the half-size, or px. Default "92%". */
  outerRadius?: string | number;
  /** Accent glow on the selected segment. Default medium. */
  glowIntensity?: GlowLevel;
  /** Gap between segments in degrees. Default 2. */
  paddingAngle?: number;
  /** Rounded segment corners in px. Default 3. */
  cornerRadius?: number;
  /** Total, or the selected segment, in the hole. Default true. */
  centerLabel?: boolean;
  /** Label above the total. Default "Total". */
  totalLabel?: string;
  /** Legend list (also selects segments by keyboard). Default true. */
  legend?: boolean;
  /** Primary colour: the total in the hole and segments with no colour of their own start here. Default: the district's palette. */
  color?: string;
  /** Floating readout next to the pointer while hovering a segment. Default true. */
  tooltip?: boolean;
  onSegmentSelected?: (index: number | null) => void;
  title?: string;
  className?: string;
}

const chart = tv({
  slots: {
    root: 'w-full items-center gap-4 md:flex-row md:items-center md:gap-8',
    stage: 'relative items-center justify-center',
    center: 'absolute items-center',
    centerLabel: 'text-xs text-silver-400',
    // No colour class: the value takes the selected segment's colour inline.
    centerValue: 'font-display text-3xl',
    tip: 'absolute border-2 border-ink-950 bg-ink-950 px-3 py-2',
    tipBand: 'absolute inset-x-0 top-0 h-1',
    tipName: 'pt-1 text-xs text-silver-300',
    tipValue: 'font-display text-lg',
    centerPct: 'text-sm font-semibold text-silver-300',
    legend: 'w-full gap-1 md:w-auto md:min-w-56',
    item: 'flex-row items-center gap-3 px-2 py-1.5',
    itemOn: 'bg-ink-800',
    swatch: 'h-4 w-4',
    name: 'flex-1 text-sm text-silver-200',
    value: 'font-display text-sm text-white',
  },
});

const radius = (r: string | number, half: number) =>
  typeof r === 'number' ? r : r.trim().endsWith('%') ? (parseFloat(r) / 100) * half : parseFloat(r) || half;

/**
 * NeonBlade's NeonDonutChart as a solid medallion: flat solid segments on a
 * darker edge, the selected one lifted out with an accent glow, the total
 * (or the selection) set in the jersey face in the hole. The legend is a list
 * of buttons, so keyboard and screen-reader users can select segments too.
 */
export function NeonDonutChart({
  data,
  district = 'midtown',
  height = 260,
  innerRadius = '60%',
  outerRadius = '92%',
  glowIntensity = 'medium',
  paddingAngle = 2,
  cornerRadius = 3,
  centerLabel = true,
  totalLabel = 'Total',
  legend = true,
  color,
  tooltip = true,
  onSegmentSelected,
  title,
  className,
}: NeonDonutChartProps) {
  const reduced = useReducedMotion();
  const { size: stageSize, onLayout } = useLayoutSize();
  const size = Math.max(1, Math.min(stageSize.width, height));
  const segments = useMemo(() => donutSegments(data.map((d) => d.value), paddingAngle), [data, paddingAngle]);
  const colors = useMemo(() => {
    const tones = color ? [color, ...districtSeries(district)] : districtSeries(district);
    return data.map((d, i) => (d.color ? neonColor(d.color).base : neonColor(tones[i % tones.length]!).base));
  }, [data, district, color]);
  const primary = color ? neonColor(color).base : brand.white;
  const shades = useMemo(() => segments.map((s) => shadeSteps(colors[s.index]!)), [segments, colors]);
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0);

  const depth = Math.max(4, Math.round(size * 0.035));
  const half = size / 2 - depth - 8;
  const outer = Math.max(4, radius(outerRadius, half));
  const inner = Math.min(outer - 4, Math.max(0, radius(innerRadius, half)));

  // Selection plus where the pointer is (null when chosen from the legend,
  // which has no pointer, so no floating tooltip).
  const selection = useInstanceStore<{ index: number; at: { x: number; y: number } | null }>(() => ({ index: -1, at: null }));
  const selected = useStore(selection, (s) => s.index);
  const at = useStore(selection, (s) => s.at);
  const select = (index: number, point: { x: number; y: number } | null = null) => {
    const prev = selection.getState().index;
    selection.setState({ index, at: index >= 0 ? point : null });
    if (index !== prev) onSegmentSelected?.(index < 0 ? null : index);
  };
  const offsetX = (stageSize.width - size) / 2;
  const pointer = plotPointer(
    (x, y) => select(segmentAt(x - offsetX, y, { cx: size / 2, cy: size / 2 - depth / 2, inner, outer: outer + 7 }, segments), { x, y }),
    () => select(-1),
  );
  const tipWidth = 150;

  const s = chart();
  const pick = selected >= 0 ? data[selected] : undefined;
  const pct = (v: number) => `${total ? Math.round((v / total) * 100) : 0}%`;
  const summary = `${title ? `${title}. ` : ''}${data.map((d) => `${d.name} ${formatValue(d.value)} (${pct(d.value)})`).join(', ')}. ${totalLabel} ${formatValue(total)}.`;

  return (
    <Figure className={s.root({ className })} aria-label={summary}>
      {/* Computed geometry: the stage is as tall as the height prop. */}
      <View className={`${s.stage()} w-full md:w-auto md:flex-1`} style={{ height }} onLayout={onLayout} {...pointer}>
        {stageSize.width > 1 ? (
          // The stage takes the pointer; the canvas must not be the touch target (native locationX is per target).
          <View pointerEvents="none">
          <DonutCanvas
            size={size}
            segments={segments}
            shades={shades}
            inner={inner}
            outer={outer}
            depth={depth}
            cornerRadius={cornerRadius}
            selected={selected}
            glow={GLOW_BLUR[glowIntensity]}
            reduced={reduced}
          />
          </View>
        ) : null}
        {centerLabel ? (
          <View pointerEvents="none" className={s.center()} style={{ maxWidth: inner * 1.6 }}>
            <Text numberOfLines={1} className={s.centerLabel()}>{pick ? pick.name : totalLabel}</Text>
            {/* Runtime colour: the selected segment's, or the primary colour for the total. */}
            <TWText className={s.centerValue()} style={{ color: pick ? colors[selected] : primary }}>
              {formatValue(pick ? pick.value : total)}
            </TWText>
            {pick ? <Text className={s.centerPct()}>{pct(pick.value)}</Text> : null}
          </View>
        ) : null}
        {tooltip && pick && at ? (
          <View
            pointerEvents="none"
            className={s.tip()}
            // Computed geometry: the readout follows the pointer, flipped and clamped inside the stage.
            style={{
              width: tipWidth,
              left: Math.max(0, Math.min(at.x + 14 + tipWidth > stageSize.width ? at.x - tipWidth - 14 : at.x + 14, stageSize.width - tipWidth)),
              top: Math.max(0, Math.min(at.y + 14, height - 70)),
            }}
          >
            {/* Segment colour is a runtime value. */}
            <View aria-hidden className={s.tipBand()} style={{ backgroundColor: colors[selected] }} />
            <Text numberOfLines={1} className={s.tipName()}>{pick.name}</Text>
            <View className="flex-row items-baseline gap-2">
              <TWText className={s.tipValue()} style={{ color: colors[selected] }}>{pick.value.toLocaleString()}</TWText>
              <Text className="text-xs text-silver-400">{pct(pick.value)}</Text>
            </View>
          </View>
        ) : null}
      </View>
      {legend ? (
        <List className={s.legend()}>
          {data.map((d, i) => (
            <ListItem key={`${d.name}-${i}`}>
              <Pressable
                role="button"
                aria-pressed={selected === i}
                aria-label={`${d.name}, ${formatValue(d.value)}, ${pct(d.value)}`}
                onPress={() => select(selected === i ? -1 : i)}
                className={`${s.item()} ${selected === i ? s.itemOn() : ''}`}
              >
                {/* Segment colour is a runtime value. */}
                <View aria-hidden className={s.swatch()} style={{ backgroundColor: colors[i] }} />
                <Text className={s.name()}>{d.name}</Text>
                <Text className={s.value()}>{pct(d.value)}</Text>
              </Pressable>
            </ListItem>
          ))}
        </List>
      ) : null}
    </Figure>
  );
}
