'use client';
// RN globals (__DEV__) must exist before Reanimated evaluates on web.
import './rn-globals-shim';
import { tv, type VariantProps } from 'tailwind-variants';
import { css, type CSSAnimationKeyframes } from 'react-native-reanimated';
import { View } from './tw';
import { AnimatedView, cssAnimation } from './progress/motion';
import { useReducedMotion } from './backgrounds/use-reduced-motion';
import { TONE_CLASSES, resolveControlTone, type ControlTone, type District } from './district';
import { litWindow, skylineHeights } from './surface-look';

/**
 * The NYC-MON skeleton: a skyline shimmer. Each placeholder is a night block
 * holding a row of solid buildings; on taller blocks a few windows glow in
 * the district light, and a pale band sweeps across like headlights down an
 * avenue. Under reduced motion it is the same skyline, still.
 */
const skeleton = tv({
  slots: {
    root: 'relative overflow-hidden border-2 border-ink-800 bg-ink-950',
    skyline: 'absolute inset-x-1 bottom-0 top-[28%] flex-row items-end gap-0.5',
    building: 'relative flex-1 bg-ink-800',
    window: 'absolute left-[30%] top-[18%] h-1 w-1',
    sweep: 'absolute inset-y-0 left-0 w-1/3 bg-ink-50/10',
  },
  variants: {
    variant: {
      line: { root: 'h-4 w-full' },
      card: { root: 'h-32 w-full', skyline: 'inset-x-2 top-[20%] gap-1', window: 'h-1.5 w-1.5' },
      avatar: { root: 'h-12 w-12', skyline: 'top-[20%]' },
      custom: {},
    },
  },
  defaultVariants: { variant: 'line' },
});

// The headlight band: starts one band-width left of the block, ends past its right edge (band is 1/3 wide).
const SWEEP = css.keyframes({
  from: { transform: [{ translateX: '-100%' }] },
  to: { transform: [{ translateX: '320%' }] },
});

const BUILDINGS = { line: 14, card: 12, avatar: 4, custom: 12 } as const;

export interface LoadingSkeletonProps extends VariantProps<typeof skeleton> {
  /** Number of blocks to render (default 1). */
  count?: number;
  className?: string;
  /** Window light colour by neighbourhood. Default midtown. */
  district?: District;
  /** Window light colour; overrides the district. */
  tone?: ControlTone;
}

export function LoadingSkeleton({ variant, count = 1, className, district, tone }: LoadingSkeletonProps) {
  const reduced = useReducedMotion();
  const light = TONE_CLASSES[resolveControlTone(tone, district)].light;
  const s = skeleton({ variant });
  const kind = variant ?? 'line';
  // A 16px line has no room for windows; every taller block gets them.
  const windows = kind !== 'line';

  const block = (row: number) => (
    <View key={row} aria-hidden className={s.root({ className })}>
      <View className={s.skyline()}>
        {skylineHeights(row, BUILDINGS[kind]).map((h, i) => (
          // Computed geometry: each building's height is a share of the block.
          <View key={i} className={s.building()} style={{ height: `${h}%` }}>
            {windows && litWindow(row, i) ? (
              <AnimatedView
                className={s.window({ className: light })}
                // Animated: windows switch on and off at their own pace.
                style={cssAnimation(reduced, 'pulse', 2400, { delay: (i * 370 + row * 210) % 2400, timing: 'ease-in-out' })}
              />
            ) : null}
          </View>
        ))}
      </View>
      {reduced ? null : (
        <AnimatedView
          className={s.sweep()}
          // Animated: the headlight sweep, a Reanimated CSS loop staggered per row.
          style={{
            animationName: SWEEP as unknown as CSSAnimationKeyframes,
            animationDuration: '1600ms',
            animationDelay: `${row * 120}ms`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationFillMode: 'both',
          }}
        />
      )}
    </View>
  );

  if (count <= 1) {
    return block(0);
  }
  return (
    <View aria-hidden className="gap-2">
      {Array.from({ length: count }, (_, i) => block(i))}
    </View>
  );
}
