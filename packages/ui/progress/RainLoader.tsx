'use client';
import { useMemo } from 'react';
import { tv } from 'tailwind-variants';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import type { NeonColorInput } from '../neon/colors';
import { toneClasses, type District, type Tone } from '../district';
import { View } from '../tw';
import { AnimatedView, cssAnimation, cssTransition, steps } from './motion';
import {
  blockFills, clampInt, isIndeterminate, progressA11y, progressFraction, quantize, resolveSize, skylineHeights,
} from './progress-model';

export type RainLoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
export type GlowLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * Towers whose windows light up floor by floor. Ported from NeonBlade UI's
 * RainLoader (MIT, see THIRD-PARTY-NOTICES.md): the falling neon bars became
 * rising window lights, and the NeonBlade props carry over.
 */
export interface RainLoaderProps {
  /** Brand token or NeonBlade preset; overrides the district colour. */
  color?: NeonColorInput | Tone;
  /** Height preset (16, 24, 36, 48, 64 px) or a px number. Default md. */
  size?: RainLoaderSize;
  /** One fill cycle in ms. Default 1600. */
  duration?: number;
  /** Towers, 2-8. Default 5. */
  barCount?: number;
  /** Tower width as a fraction of the height, 0.1-0.5. Default 0.28. */
  barWidthRatio?: number;
  /** Gap between towers in px. Default 3. */
  gap?: number;
  /** Accent glow on the lit windows. Default low. */
  glowIntensity?: GlowLevel;
  /** Tower silhouettes and colour. Default midtown. */
  district?: District;
  /** Optional value: towers fill in turn, left to right. Unset loops. */
  value?: number;
  max?: number;
  indeterminate?: boolean;
  /** What is loading, for screen readers. Default "Loading". */
  accessibilityLabel?: string;
  className?: string;
}

const SIZES = { xs: 16, sm: 24, md: 36, lg: 48, xl: 64 } as const;

const loader = tv({
  slots: {
    root: 'flex-row items-end self-start',
    tower: 'justify-end',
    body: 'w-full overflow-hidden border-t-2',
    lit: 'absolute inset-0',
    mullion: 'absolute inset-x-0 h-px bg-ink-900',
    mullionV: 'absolute inset-y-0 left-1/2 w-px bg-ink-900',
  },
});

export function RainLoader({
  color,
  size = 'md',
  duration = 1600,
  barCount,
  barWidthRatio = 0.28,
  gap = 3,
  glowIntensity = 'low',
  district = 'midtown',
  value,
  max = 100,
  indeterminate,
  accessibilityLabel = 'Loading',
  className,
}: RainLoaderProps) {
  const reduced = useReducedMotion();
  const tone = toneClasses(district, color);
  const s = loader();
  const height = resolveSize(size, SIZES, 'md');
  const count = clampInt(barCount, 2, 8, 5);
  const width = Math.max(4, Math.round(height * Math.min(0.5, Math.max(0.1, barWidthRatio))));
  const heights = useMemo(() => skylineHeights(count, district, 3).map((h) => 0.55 + h * 0.45), [count, district]);
  const busy = isIndeterminate(value, indeterminate);
  const floors = Math.max(3, Math.round(height / 6));
  const fills = busy ? null : blockFills(progressFraction(value, max), count);
  const glow = glowIntensity === 'none' ? '' : tone.glow;

  return (
    <View
      {...progressA11y({ value, max, indeterminate, label: accessibilityLabel })}
      className={s.root({ className })}
      // Gap and height come from px props.
      style={{ height, gap }}
    >
      {heights.map((h, i) => {
        const towerFloors = Math.max(2, Math.round(floors * h));
        const fill = fills ? quantize(fills[i]!, towerFloors) : 1;
        return (
          // Tower size is computed from the height and width-ratio props.
          <View key={i} aria-hidden className={s.tower()} style={{ width, height: '100%' }}>
            <View className={s.body({ className: `${tone.deep} ${tone.keyline}` })} style={{ height: `${h * 100}%` }}>
              <AnimatedView
                className={s.lit({ className: `${tone.light} ${glowIntensity === 'high' ? glow : ''}` })}
                // Animated: floor-by-floor fill (keyframes) or the value fill (transition).
                style={{
                  transformOrigin: 'bottom',
                  transform: [{ scaleY: fill }],
                  opacity: busy && reduced ? 0.5 : 1,
                  ...(busy
                    ? cssAnimation(reduced, 'windows', duration, {
                        delay: (i * duration) / (count * 2),
                        timing: steps(towerFloors, 'jump-start'),
                      })
                    : cssTransition(reduced, 280)),
                }}
              />
              {Array.from({ length: towerFloors - 1 }, (_, f) => (
                // Floor lines sit at computed fractions of the tower.
                <View key={f} className={s.mullion()} style={{ top: `${((f + 1) / towerFloors) * 100}%` }} />
              ))}
              {width >= 8 ? <View className={s.mullionV()} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
