'use client';
import { tv } from 'tailwind-variants';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import type { NeonColorInput } from '../neon/colors';
import { toneClasses, type District, type Tone } from '../district';
import { View } from '../tw';
import { AnimatedView, cssAnimation, cssTransition } from './motion';
import {
  clampInt, isIndeterminate, progressA11y, progressFraction, resolveSize, ringAngles,
} from './progress-model';

export type TurbineLoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

/**
 * A rooftop: a wooden water tower beside an exhaust fan that spins. The tank
 * fills with the value, or rocks while the end is unknown. Ported from
 * NeonBlade UI's TurbineLoader (MIT, see THIRD-PARTY-NOTICES.md): the
 * concentric neon turbine became the most New York spinner there is.
 */
export interface TurbineLoaderProps {
  /** Brand token or NeonBlade preset; overrides the district colour. */
  color?: NeonColorInput | Tone;
  /** Box size preset (40, 56, 80, 112, 144 px) or a px number. Default md. */
  size?: TurbineLoaderSize;
  /** Fan blades, 3-8. Default 5. */
  bladeCount?: number;
  /** One fan revolution in ms. Default 1400. */
  speed?: number;
  /** Fan direction. Default clockwise. */
  direction?: 'clockwise' | 'counter-clockwise';
  /** Fan hub radius as a fraction of the fan radius, 0.1-0.5. Default 0.26. */
  hubSize?: number;
  /** Blade width as a fraction of the fan radius, 0.15-0.6. Default 0.34. */
  bladeWidth?: number;
  /** Accent glow on the fan housing. Default medium. */
  glowIntensity?: 'none' | 'low' | 'medium' | 'high';
  /** Show the water tower. Off leaves just the fan. Default on above 48px. */
  tower?: boolean;
  /** Default midtown. */
  district?: District;
  /** Optional value: the tank fills to it. Unset rocks the water. */
  value?: number;
  max?: number;
  indeterminate?: boolean;
  /** What is loading, for screen readers. Default "Loading". */
  accessibilityLabel?: string;
  className?: string;
}

const SIZES = { xs: 40, sm: 56, md: 80, lg: 112, xl: 144 } as const;

const roof = tv({
  slots: {
    root: 'relative self-start',
    deck: 'absolute inset-x-0 bottom-0 border-t-2',
    abs: 'absolute',
    tank: 'absolute overflow-hidden border-2',
    hoop: 'absolute inset-x-0 h-0.5 bg-ink-950/60',
    leg: 'absolute bg-ink-600',
    housing: 'absolute items-center justify-center overflow-hidden rounded-full border-2 bg-ink-900',
    blades: 'absolute inset-0',
    arm: 'absolute inset-0 items-center',
    hub: 'absolute rounded-full border-2 border-ink-950 bg-ink-50',
  },
});

export function TurbineLoader({
  color,
  size = 'md',
  bladeCount,
  speed = 1400,
  direction = 'clockwise',
  hubSize = 0.26,
  bladeWidth = 0.34,
  glowIntensity = 'medium',
  tower,
  district = 'midtown',
  value,
  max = 100,
  indeterminate,
  accessibilityLabel = 'Loading',
  className,
}: TurbineLoaderProps) {
  const reduced = useReducedMotion();
  const tone = toneClasses(district, color);
  const s = roof();
  const px = resolveSize(size, SIZES, 'md');
  const blades = ringAngles(clampInt(bladeCount, 3, 8, 5));
  const busy = isIndeterminate(value, indeterminate);
  const fraction = progressFraction(value, max);
  const withTower = tower ?? px > 48;
  const spinning = busy || fraction < 1;

  // Geometry, in px of the square box.
  const deck = Math.round(px * 0.12);
  const ground = px - deck;
  const fan = Math.round(withTower ? px * 0.42 : px * 0.8);
  const fanLeft = withTower ? px - fan - Math.round(px * 0.02) : Math.round((px - fan) / 2);
  const fanTop = ground - fan - (withTower ? Math.round(px * 0.04) : Math.round(px * 0.04));
  const fanR = fan / 2;
  const hub = Math.round(fan * Math.min(0.5, Math.max(0.1, hubSize)));
  const blade = Math.max(3, Math.round(fanR * Math.min(0.6, Math.max(0.15, bladeWidth))));
  const tankW = Math.round(px * 0.42);
  const tankH = Math.round(px * 0.34);
  const tankLeft = Math.round(px * 0.04);
  const tankTop = Math.round(px * 0.26);
  const legTop = tankTop + tankH;
  const legW = Math.max(2, Math.round(px * 0.035));
  const roofStep = Math.max(2, Math.round(px * 0.055));
  const glow = glowIntensity === 'none' || glowIntensity === 'low' ? '' : tone.glow;

  return (
    <View
      {...progressA11y({ value, max, indeterminate, label: accessibilityLabel })}
      className={s.root({ className })}
      // Every piece below is placed by computed px geometry, so positions are inline styles.
      style={{ width: px, height: px }}
    >
      {withTower ? (
        <View aria-hidden className={s.abs()} style={{ left: 0, top: 0, width: px, height: px }}>
          {/* Stepped conical roof: three setbacks and a finial. */}
          {[0.36, 0.7, 1.08].map((w, i) => (
            <View
              key={w}
              className={s.abs({ className: i === 2 ? tone.side : tone.top })}
              style={{
                left: tankLeft + (tankW * (1 - w)) / 2,
                width: tankW * w,
                top: tankTop - roofStep * (3 - i),
                height: roofStep,
              }}
            />
          ))}
          <View
            className={s.abs({ className: 'bg-ink-950' })}
            style={{ left: tankLeft + tankW / 2 - legW / 2, width: legW, top: tankTop - roofStep * 4, height: roofStep }}
          />
          {/* Tank, with the water level inside. */}
          <View
            className={s.tank({ className: `${tone.deep} ${tone.keyline}` })}
            style={{ left: tankLeft, top: tankTop, width: tankW, height: tankH }}
          >
            <AnimatedView
              className={`absolute inset-0 ${tone.face}`}
              // Animated: water level (transition) or the rocking tank (keyframes).
              style={{
                transformOrigin: 'bottom',
                transform: [{ scaleY: busy ? (reduced ? 0.55 : 0.3) : fraction }],
                ...(busy ? cssAnimation(reduced, 'slosh', 2400, { timing: 'ease-in-out' }) : cssTransition(reduced, 420)),
              }}
            />
            <View className={s.hoop()} style={{ top: '30%' }} />
            <View className={s.hoop()} style={{ top: '68%' }} />
          </View>
          {/* Legs and a cross brace down to the deck. */}
          {[0.14, 0.5, 0.86].map((x) => (
            <View
              key={x}
              className={s.leg()}
              style={{ left: tankLeft + tankW * x - legW / 2, width: legW, top: legTop, height: ground - legTop }}
            />
          ))}
          <View
            className={s.leg()}
            style={{ left: tankLeft + tankW * 0.14, width: tankW * 0.72, top: legTop + (ground - legTop) * 0.45, height: legW }}
          />
        </View>
      ) : null}

      {/* Exhaust fan. */}
      <View
        aria-hidden
        className={s.housing({ className: `${tone.keyline} ${glow}` })}
        style={{ left: fanLeft, top: fanTop, width: fan, height: fan }}
      >
        <AnimatedView
          className={s.blades()}
          // Animated: the fan revolution.
          style={spinning
            ? cssAnimation(reduced, direction === 'clockwise' ? 'spin' : 'spinReverse', speed)
            : undefined}
        >
          {blades.map((a) => (
            <View key={a} className={s.arm()} style={{ transform: [{ rotate: `${a}deg` }] }}>
              <View
                className={`rounded-sm ${tone.face}`}
                style={{ width: blade, height: fanR - 2, marginTop: 2 }}
              />
            </View>
          ))}
        </AnimatedView>
        <View className={s.hub()} style={{ width: hub, height: hub }} />
      </View>

      <View aria-hidden className={s.deck({ className: `${tone.side} ${tone.keyline}` })} style={{ height: deck }} />
    </View>
  );
}
