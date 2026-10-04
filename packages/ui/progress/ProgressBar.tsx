'use client';
import { useMemo } from 'react';
import { tv } from 'tailwind-variants';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import type { NeonColorInput } from '../neon/colors';
import { toneClasses, type District, type Tone } from '../elements/tones';
import { Text, View } from '../tw';
import { AnimatedView, cssAnimation, cssTransition } from './motion';
import {
  blockFills, isIndeterminate, percentLabel, progressA11y, progressFraction, skylineHeights,
} from './progress-model';

export type ProgressBarVariant = 'solid' | 'segmented' | 'striped' | 'pulse';
export type ProgressBarSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * A skyline that builds up block by block. Ported from NeonBlade UI's
 * ProgressBar (MIT, see THIRD-PARTY-NOTICES.md), keeping its prop names;
 * the bar is redrawn as a row of lots that fill in with solid buildings.
 */
export interface ProgressBarProps {
  /** Current value, 0..max. Leave unset (or set `indeterminate`) when the end is unknown. */
  value?: number;
  /** Default 100. */
  max?: number;
  /** Loop a construction wave instead of showing a value. */
  indeterminate?: boolean;
  /** Skyline shape and colour. Default midtown. */
  district?: District;
  /** Overrides the district colour with a brand token or NeonBlade preset. */
  color?: NeonColorInput | Tone;
  /**
   * solid: buildings shoulder to shoulder.
   * segmented: a street between every lot.
   * striped: lit floor bands across each building.
   * pulse: the building going up glows in time.
   * Default solid.
   */
  variant?: ProgressBarVariant;
  /** Skyline height: 20, 32, 48 or 72 px. Default md. */
  size?: ProgressBarSize;
  /** Lots on the block. Default 16. */
  blocks?: number;
  /** Same seed, same skyline. Default 1. */
  seed?: number;
  /** Show the percentage (or `label`) above the skyline. Default false. */
  showLabel?: boolean;
  /** Text shown in place of the percentage. */
  label?: string;
  /** Accent glow on the building going up. Default true. */
  glow?: boolean;
  /** What is loading, for screen readers. Default "Progress". */
  accessibilityLabel?: string;
  className?: string;
}

const bar = tv({
  slots: {
    root: 'w-full gap-1.5',
    header: 'flex-row items-baseline justify-between gap-3',
    label: 'text-sm font-semibold text-text',
    value: 'font-display text-sm text-text',
    skyline: 'w-full flex-row items-end',
    lot: 'h-full flex-1 justify-end',
    ghost: 'w-full border-t-2 border-ink-700 bg-ink-800',
    built: 'absolute inset-x-0 bottom-0 overflow-hidden',
    cap: 'h-1 w-full',
    windows: 'absolute inset-x-[18%] bottom-1 top-2 gap-0.5',
    floor: 'flex-1 flex-row gap-0.5',
    pane: 'flex-1',
    stripe: 'absolute inset-x-0 h-0.5 opacity-80',
    street: 'h-1 w-full',
  },
  variants: {
    size: {
      xs: { skyline: 'h-5' },
      sm: { skyline: 'h-8' },
      md: { skyline: 'h-12' },
      lg: { skyline: 'h-18' },
    },
    variant: {
      solid: { skyline: 'gap-px' },
      segmented: { skyline: 'gap-1' },
      striped: { skyline: 'gap-px' },
      pulse: { skyline: 'gap-px' },
    },
  },
});

const STRIPES = [0.3, 0.55, 0.8];
/** Floors in a full-height building, per size. */
const FLOORS: Record<ProgressBarSize, number> = { xs: 0, sm: 3, md: 5, lg: 8 };
/** A fixed lit/unlit pattern, about two in three windows on. */
const windowLit = (lot: number, floor: number, col: number) => ((lot * 7 + floor * 3 + col * 5) % 3) !== 0;

export function ProgressBar({
  value,
  max = 100,
  indeterminate,
  district = 'midtown',
  color,
  variant = 'solid',
  size = 'md',
  blocks = 16,
  seed = 1,
  showLabel = false,
  label,
  glow = true,
  accessibilityLabel = 'Progress',
  className,
}: ProgressBarProps) {
  const reduced = useReducedMotion();
  const tone = toneClasses(district, color);
  const s = bar({ size, variant });
  const busy = isIndeterminate(value, indeterminate);
  const fraction = progressFraction(value, max);
  const count = Math.max(2, Math.round(blocks));
  const heights = useMemo(() => skylineHeights(count, district, seed), [count, district, seed]);
  const fills = busy ? null : blockFills(fraction, count);
  const leading = fills ? fills.findIndex((f) => f < 1) : -1;
  const showWindows = size !== 'xs';
  const cycle = 1800;

  return (
    <View {...progressA11y({ value, max, indeterminate, label: accessibilityLabel })} className={s.root({ className })}>
      {showLabel ? (
        <View className={s.header()}>
          <Text className={s.label()}>{label ?? accessibilityLabel}</Text>
          <Text aria-hidden className={s.value()}>{busy ? '' : percentLabel(fraction)}</Text>
        </View>
      ) : null}

      <View aria-hidden className={s.skyline()}>
        {heights.map((h, i) => {
          const fill = fills ? fills[i]! : 1;
          const building = i === leading;
          return (
            <View key={i} className={s.lot()}>
              {/* Lot heights are computed per building, so they can't be classes. */}
              <View className={s.ghost()} style={{ height: `${h * 100}%` }} />
              <AnimatedView
                className={s.built({ className: `${tone.face} ${building && glow ? tone.glow : ''}` })}
                // Animated: the build fill (transition) or the construction wave (keyframes).
                style={{
                  height: `${h * 100}%`,
                  transformOrigin: 'bottom',
                  transform: [{ scaleY: busy ? 1 : fill }],
                  opacity: busy && reduced ? 0.5 : 1,
                  ...(busy
                    ? cssAnimation(reduced, 'build', cycle, { delay: (i * cycle * 0.6) / count, timing: 'ease-in-out' })
                    : cssTransition(reduced, 360)),
                }}
              >
                <View className={s.cap({ className: tone.top })} />
                {showWindows && variant === 'striped'
                  ? STRIPES.map((y) => (
                      // Stripe offsets are fractions of the building height.
                      <View key={y} className={s.stripe({ className: tone.light })} style={{ top: `${y * 100}%` }} />
                    ))
                  : null}
                {showWindows && variant !== 'striped' ? (
                  <View className={s.windows()}>
                    {Array.from({ length: Math.max(1, Math.round(h * FLOORS[size])) }, (_, f) => (
                      <View key={f} className={s.floor()}>
                        {[0, 1].map((c) => (
                          <View key={c} className={s.pane({ className: windowLit(i, f, c) ? tone.light : tone.side })} />
                        ))}
                      </View>
                    ))}
                  </View>
                ) : null}
                {variant === 'pulse' && building && !busy ? (
                  <AnimatedView
                    className={`absolute inset-0 ${tone.top}`}
                    style={cssAnimation(reduced, 'pulse', 900, { timing: 'ease-in-out' })}
                  />
                ) : null}
              </AnimatedView>
            </View>
          );
        })}
      </View>
      <View aria-hidden className={s.street({ className: tone.side })} />
    </View>
  );
}
