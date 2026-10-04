'use client';

import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { Card } from '../Card';
import { Text } from '../Text';
import { View } from '../tw';
import { districtTone, type ChartTone, type District } from './district-tones';
import { NeonSparkline } from './NeonSparkline';
import type { GlowLevel } from './LinePlot.types';

export type StatTrend = 'up' | 'down' | 'neutral';

export interface StatCardProps {
  /** The metric, set large. */
  value: string | number;
  /** What the metric is. */
  label: string;
  /** Appended to the value, smaller (e.g. "ms", "%"). */
  unit?: string;
  /** Arrow and colour for the change line. */
  trend?: StatTrend;
  /** The change (e.g. "+12.4%"). */
  change?: string;
  /** After the change (e.g. "vs last week"). */
  changeLabel?: string;
  /** Sparkline points; each needs `value`. */
  sparkData?: { value: number }[];
  /** Accent: a tone family or a NeonBlade preset. Default: the district's hero tone. */
  color?: ChartTone | 'cyan' | 'pink' | 'green';
  district?: District;
  /** Top right. */
  icon?: ReactNode;
  /** Face fill: any CSS colour (NeonBlade's `background`). Default the night face. */
  background?: string;
  /** Accent glow around the card and under the sparkline. Default low. */
  glowIntensity?: GlowLevel;
  className?: string;
  /** Opt-in rounded corners in place of the corner cut. Default false. */
  rounded?: boolean;
}

const PRESET: Record<'cyan' | 'pink' | 'green', ChartTone> = { cyan: 'carolina', pink: 'apple', green: 'leaf' };

// The card itself is the kit's corner-cut Card (night face, tone ring, depth
// plate). These slots only lay out what sits on its face.
const stat = tv({
  slots: {
    band: 'absolute left-0 right-0 top-0 h-1.5',
    bracket: 'absolute left-0 top-0 h-4 w-4 border-l-4 border-t-4',
    head: 'flex-row items-start justify-between gap-3 pt-2',
    label: 'font-display text-xs tracking-wide text-silver-300',
    valueRow: 'flex-row items-baseline gap-1.5',
    value: 'font-display text-4xl text-white md:text-5xl',
    unit: 'font-display text-lg text-silver-300',
    change: 'flex-row items-center gap-2',
    changeLabel: 'text-xs text-silver-400',
  },
  variants: {
    tone: {
      orange: { band: 'bg-orange-500', bracket: 'border-orange-300' },
      royal: { band: 'bg-royal-500', bracket: 'border-royal-300' },
      carolina: { band: 'bg-carolina-500', bracket: 'border-carolina-300' },
      leaf: { band: 'bg-leaf-500', bracket: 'border-leaf-300' },
      apple: { band: 'bg-apple-500', bracket: 'border-apple-300' },
    },
  },
});

const ARROWS: Record<StatTrend, string> = { up: '▲', down: '▼', neutral: '–' };
const TREND_WORD: Record<StatTrend, string> = { up: 'up', down: 'down', neutral: 'flat' };
const TREND_CLASS: Record<StatTrend, string> = { up: 'text-leaf-400', down: 'text-apple-400', neutral: 'text-silver-400' };

/**
 * NeonBlade's StatCard as a neon card: the kit's corner-cut Card in the
 * district tone (night face, heavy tone ring, depth plate, the cut at the
 * bottom right), a solid tone accent bar across the top with a cornice
 * bracket in the opposite corner, the number in the jersey face, the change
 * in leaf or apple, and the sparkline along the bottom. Glow is an accent:
 * low by default, `glowIntensity="none"` drops it.
 */
export function StatCard({
  value, label, unit, trend, change, changeLabel, sparkData, color, district = 'midtown', icon,
  background, glowIntensity = 'low', className, rounded = false,
}: StatCardProps) {
  const tone: ChartTone = color ? (color in PRESET ? PRESET[color as keyof typeof PRESET] : (color as ChartTone)) : districtTone(district);
  const s = stat({ tone });
  const spoken = [label, `${value}${unit ? ` ${unit}` : ''}`, change ? `${trend ? `${TREND_WORD[trend]} ` : ''}${change}` : null, changeLabel]
    .filter(Boolean)
    .join(', ');

  return (
    <Card
      variant="cornerCut"
      tone={tone}
      size="md"
      cornerSize={18}
      glow={glowIntensity !== 'none'}
      rounded={rounded}
      className={className}
      aria-label={spoken}
    >
      <View aria-hidden className={s.band()} />
      <View aria-hidden className={s.bracket()} />
      {background ? (
        // Runtime colour: `background` takes any CSS colour (NeonBlade's prop), which no class can name.
        <View aria-hidden className="absolute inset-0 -z-10" style={{ backgroundColor: background }} />
      ) : null}
      <View className={s.head()}>
        <Text className={s.label()}>{label}</Text>
        {icon ? <View aria-hidden>{icon}</View> : null}
      </View>
      <View className={s.valueRow()}>
        <Text className={s.value()}>{String(value)}</Text>
        {unit ? <Text className={s.unit()}>{unit}</Text> : null}
      </View>
      {change ? (
        <View className={s.change()}>
          <Text className={`font-display text-sm ${TREND_CLASS[trend ?? 'neutral']}`}>
            {`${ARROWS[trend ?? 'neutral']} ${change}`}
          </Text>
          {changeLabel ? <Text className={s.changeLabel()}>{changeLabel}</Text> : null}
        </View>
      ) : null}
      {sparkData?.length ? (
        <NeonSparkline data={sparkData} width="100%" height={44} color={tone} district={district} label={label} glowIntensity={glowIntensity} />
      ) : null}
    </Card>
  );
}