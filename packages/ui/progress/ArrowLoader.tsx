'use client';
import { tv } from 'tailwind-variants';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import type { NeonColorInput } from '../neon/colors';
import { toneClasses, type District, type Tone } from '../district';
import { View } from '../tw';
import { AnimatedView, cssAnimation, cssTransition } from './motion';
import { clampInt, isIndeterminate, litCount, progressA11y, progressFraction } from './progress-model';

/**
 * A subway direction strip: solid chevrons on a route-coloured bar that light
 * in sequence. Ported from NeonBlade UI's ArrowLoader (MIT, see
 * THIRD-PARTY-NOTICES.md); the stroked SVG arrows became solid chevrons.
 */
export interface ArrowLoaderProps {
  /** Brand token or NeonBlade preset; overrides the district colour. */
  color?: NeonColorInput | Tone;
  /** Strip height in px. Default 24. */
  height?: number;
  /** Width of one chevron in px. Default 0.7 of the height. */
  arrowSize?: number;
  /** Chevron bar thickness in px. Default a sixth of the height. */
  thickness?: number;
  /** One lap of the lit wave in ms; lower is faster. Default 900. */
  speed?: number;
  /** Chevrons along the strip, 3-24. Default 10. */
  count?: number;
  /** Arrow direction. Default right (uptown-bound reads left to right). */
  direction?: 'right' | 'left';
  /** Route colour and line. Default midtown. */
  district?: District;
  /** Optional value: chevrons light up to the value. Unset loops. */
  value?: number;
  max?: number;
  indeterminate?: boolean;
  /** What is loading, for screen readers. Default "Loading". */
  accessibilityLabel?: string;
  className?: string;
}

const strip = tv({
  slots: {
    root: 'w-full flex-row items-center justify-around overflow-hidden rounded-full border-2 px-2',
    cell: 'items-center justify-center',
    arm: 'absolute rounded-full',
  },
});

export function ArrowLoader({
  color,
  height = 24,
  arrowSize,
  thickness,
  speed = 900,
  count,
  direction = 'right',
  district = 'midtown',
  value,
  max = 100,
  indeterminate,
  accessibilityLabel = 'Loading',
  className,
}: ArrowLoaderProps) {
  const reduced = useReducedMotion();
  const tone = toneClasses(district, color);
  const s = strip();
  const n = clampInt(count, 3, 24, 10);
  const busy = isIndeterminate(value, indeterminate);
  const lit = busy ? n : litCount(progressFraction(value, max), n);
  const size = Math.max(4, arrowSize ?? Math.round(height * 0.7));
  const bar = Math.max(2, thickness ?? Math.round(height / 6));
  // A chevron is two bars at +/-45deg, offset up and down by ~arm/(2*sqrt2)
  // so their outer ends meet at the tip.
  const arm = Math.round(size * 0.78);
  const flip = direction === 'left' ? -1 : 1;
  const order = (i: number) => (direction === 'left' ? n - 1 - i : i);

  return (
    <View
      {...progressA11y({ value, max, indeterminate, label: accessibilityLabel })}
      className={s.root({ className: `${tone.face} ${tone.keyline}` })}
      // Strip height is a px prop.
      style={{ height }}
    >
      {Array.from({ length: n }, (_, i) => {
        const on = order(i) < lit;
        return (
          <AnimatedView
            key={i}
            aria-hidden
            className={s.cell()}
            // Animated: the lit wave (keyframes) or the value fill (transition). Size is computed from props.
            style={{
              width: size,
              height: size,
              opacity: busy ? (reduced ? 1 : 0.22) : on ? 1 : 0.22,
              ...(busy
                ? cssAnimation(reduced, 'march', speed * 1.6, { delay: (order(i) * speed) / n })
                : cssTransition(reduced, 200)),
            }}
          >
            {[-1, 1].map((sign) => (
              <View
                key={sign}
                className={s.arm({ className: tone.face === 'bg-ink-50' ? 'bg-ink-950' : 'bg-ink-50' })}
                // Chevron arm geometry is computed from arrowSize and thickness.
                style={{
                  width: arm,
                  height: bar,
                  transform: [
                    { translateY: sign * arm * 0.33 },
                    { rotate: `${-sign * 45 * flip}deg` },
                  ],
                }}
              />
            ))}
          </AnimatedView>
        );
      })}
    </View>
  );
}
