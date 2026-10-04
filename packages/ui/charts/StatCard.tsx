'use client';

import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { Card } from '../Card';
import { Text } from '../Text';
import { View } from '../tw';
import { districtTone, type ChartTone, type District } from './district-tones';
import { NeonSparkline } from './NeonSparkline';

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
  className?: string;
}

const PRESET: Record<'cyan' | 'pink' | 'green', ChartTone> = { cyan: 'carolina', pink: 'apple', green: 'leaf' };

const stat = tv({
  slots: {
    root: 'relative gap-3 border-2 border-ink-800 bg-ink-900',
    band: 'absolute inset-x-0 top-0 h-1.5',
    head: 'flex-row items-start justify-between gap-3 pt-1',
    label: 'text-silver-300',
    valueRow: 'flex-row items-baseline gap-1.5',
    value: 'font-display text-4xl text-white md:text-5xl',
    unit: 'font-display text-lg text-silver-300',
    change: 'flex-row items-center gap-2',
    changeLabel: 'text-xs text-silver-500',
  },
  variants: {
    tone: {
      orange: { band: 'bg-orange-500' },
      royal: { band: 'bg-royal-500' },
      carolina: { band: 'bg-carolina-500' },
      leaf: { band: 'bg-leaf-500' },
      apple: { band: 'bg-apple-500' },
    },
  },
});

const ARROWS: Record<StatTrend, string> = { up: '▲', down: '▼', neutral: '–' };
const TREND_WORD: Record<StatTrend, string> = { up: 'up', down: 'down', neutral: 'flat' };
const TREND_CLASS: Record<StatTrend, string> = { up: 'text-leaf-400', down: 'text-apple-400', neutral: 'text-silver-400' };

/**
 * NeonBlade's StatCard on the kit Card: a solid tone band across the top
 * (the scoreboard strip), the number in the jersey face, the change in leaf
 * or apple, and a sparkline along the bottom edge.
 */
export function StatCard({
  value, label, unit, trend, change, changeLabel, sparkData, color, district = 'midtown', icon, className,
}: StatCardProps) {
  const tone: ChartTone = color ? (color in PRESET ? PRESET[color as keyof typeof PRESET] : (color as ChartTone)) : districtTone(district);
  const s = stat({ tone });
  const spoken = [label, `${value}${unit ? ` ${unit}` : ''}`, change ? `${trend ? `${TREND_WORD[trend]} ` : ''}${change}` : null, changeLabel]
    .filter(Boolean)
    .join(', ');

  return (
    <Card elevation="flat" className={s.root({ className })} aria-label={spoken}>
      <View aria-hidden className={s.band()} />
      <View className={s.head()}>
        <Text variant="label" className={s.label()}>{label}</Text>
        {icon ? <View aria-hidden>{icon}</View> : null}
      </View>
      <View className={s.valueRow()}>
        <Text className={s.value()}>{String(value)}</Text>
        {unit ? <Text className={s.unit()}>{unit}</Text> : null}
      </View>
      {change ? (
        <View className={s.change()}>
          <Text className={`text-sm font-semibold ${TREND_CLASS[trend ?? 'neutral']}`}>
            {`${ARROWS[trend ?? 'neutral']} ${change}`}
          </Text>
          {changeLabel ? <Text className={s.changeLabel()}>{changeLabel}</Text> : null}
        </View>
      ) : null}
      {sparkData?.length ? (
        <NeonSparkline data={sparkData} width="100%" height={44} color={tone} district={district} label={label} />
      ) : null}
    </Card>
  );
}
