'use client';
import { tv } from 'tailwind-variants';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import type { NeonColorInput } from '../neon/colors';
import { toneClasses, type District, type Tone } from '../district';
import { Text, View } from '../tw';
import { AnimatedView, cssAnimation } from './motion';
import {
  clampInt, isIndeterminate, litCount, percentLabel, progressA11y, progressFraction, resolveSize, ringAngles,
} from './progress-model';

export type CircularProgressSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * A round token: a solid badge face ringed by solid segments that light
 * clockwise. Ported from NeonBlade UI's CircularProgress (MIT, see
 * THIRD-PARTY-NOTICES.md), keeping its props; the stroked arc became a ring
 * of solid blocks around a sports-badge centre.
 */
export interface CircularProgressProps {
  /** Current value, 0..max. Unset (or `indeterminate`) spins a lit arc. */
  value?: number;
  /** Default 100. */
  max?: number;
  indeterminate?: boolean;
  /** Brand token or NeonBlade preset; overrides the district colour. */
  color?: NeonColorInput | Tone;
  /** 64, 96, 128 or 160 px. Default md. */
  size?: CircularProgressSize;
  /** Segment thickness (radial length) in px. Default size / 9. */
  strokeWidth?: number;
  /** Segments around the ring, 8-48. Default 24. */
  segments?: number;
  /** Show the percentage in the centre. Default true. */
  showValue?: boolean;
  /** Replaces the percentage. */
  centerLabel?: string;
  /** Small line under the value. */
  subLabel?: string;
  /** Accent glow around the token. Default medium. */
  glowIntensity?: 'none' | 'low' | 'medium' | 'high';
  /** Default midtown. */
  district?: District;
  /** What this measures, for screen readers. Default "Progress". */
  accessibilityLabel?: string;
  className?: string;
}

const SIZES = { sm: 64, md: 96, lg: 128, xl: 160 } as const;

const ring = tv({
  slots: {
    root: 'items-center justify-center self-start',
    layer: 'absolute inset-0',
    arm: 'absolute inset-0 items-center',
    segment: 'rounded-xs',
    plate: 'absolute rounded-full',
    face: 'absolute items-center justify-center rounded-full border-2 border-ink-950',
    value: 'font-display',
    sub: 'font-semibold',
  },
  variants: {
    size: {
      sm: { value: 'text-sm', sub: 'hidden' },
      md: { value: 'text-xl', sub: 'text-[10px]' },
      lg: { value: 'text-2xl', sub: 'text-xs' },
      xl: { value: 'text-3xl', sub: 'text-sm' },
    },
  },
});

export function CircularProgress({
  value,
  max = 100,
  indeterminate,
  color,
  size = 'md',
  strokeWidth,
  segments,
  showValue = true,
  centerLabel,
  subLabel,
  glowIntensity = 'medium',
  district = 'midtown',
  accessibilityLabel = 'Progress',
  className,
}: CircularProgressProps) {
  const reduced = useReducedMotion();
  const tone = toneClasses(district, color);
  const s = ring({ size });
  const px = resolveSize(size, SIZES, 'md');
  const n = clampInt(segments, 8, 48, 24);
  const angles = ringAngles(n);
  const busy = isIndeterminate(value, indeterminate);
  const fraction = progressFraction(value, max);
  const lit = busy ? 0 : litCount(fraction, n);
  const radial = Math.max(3, strokeWidth ?? Math.round(px / 9));
  // Segment width: the ring's circumference shared out, minus a street between blocks.
  const segWidth = Math.max(2, ((Math.PI * (px - radial)) / n) * 0.62);
  const inset = radial + Math.max(3, Math.round(px / 24));
  const faceSize = px - inset * 2;
  const depth = Math.max(2, Math.round(px / 32));
  const arc = Math.max(3, Math.round(n / 4));
  const text = centerLabel ?? (busy ? '' : percentLabel(fraction));
  const glow = glowIntensity === 'none' ? '' : tone.glow;

  const segment = (angle: number, cls: string, key: string | number) => (
    // Each arm is the full square turned by its angle, so the block at its top travels the ring.
    <View key={key} className={s.arm()} style={{ transform: [{ rotate: `${angle}deg` }] }}>
      <View className={s.segment({ className: cls })} style={{ width: segWidth, height: radial }} />
    </View>
  );

  return (
    <View
      {...progressA11y({ value, max, indeterminate, label: accessibilityLabel })}
      className={s.root({ className })}
      // Token size is a px preset.
      style={{ width: px, height: px }}
    >
      <View aria-hidden className={s.layer()}>
        {angles.map((a, i) => segment(a, i < lit ? tone.face : 'bg-ink-800', i))}
      </View>

      {busy ? (
        <AnimatedView
          aria-hidden
          className={s.layer()}
          // Animated: the lit arc laps the ring.
          style={cssAnimation(reduced, 'spin', 1400)}
        >
          {angles.slice(0, arc).map((a, i) => segment(a, i === arc - 1 ? tone.top : tone.face, `arc-${i}`))}
        </AnimatedView>
      ) : null}

      {/* Badge face over a depth plate stepped down and right; sizes are computed from the token size. */}
      <View
        aria-hidden
        className={s.plate({ className: tone.side })}
        style={{ width: faceSize, height: faceSize, left: inset + depth, top: inset + depth }}
      />
      <View
        className={s.face({ className: `${tone.face} ${glowIntensity === 'high' ? glow : ''}` })}
        style={{ width: faceSize, height: faceSize, left: inset, top: inset }}
      >
        {showValue && text ? <Text aria-hidden className={s.value({ className: tone.on })}>{text}</Text> : null}
        {subLabel ? <Text className={s.sub({ className: tone.on })}>{subLabel}</Text> : null}
      </View>
    </View>
  );
}
