'use client';
import { tv } from 'tailwind-variants';
import { useReducedMotion } from './backgrounds/use-reduced-motion';
import { TONE_CLASSES, resolveTone, type District, type Tone } from './district';
import type { NeonColorInput } from './neon/colors';
import { AnimatedView, cssAnimation } from './progress/motion';
import { View, Text } from './tw';
import { badgeLegacyLook, type LegacyBadgeTone } from './surface-look';
import { TYPE_SCALE_TV } from './type-scale';

/**
 * The NYC-MON chip, and the only Badge look: a chunky sports-badge chip.
 * Solid face, night keyline, a depth plate stepped down and right, display
 * type. Ported from NeonBlade UI's Badge (MIT, see THIRD-PARTY-NOTICES.md);
 * NeonBlade's own `variant` (solid/outline/ghost) is `fill` here.
 */
const neon = tv({
  slots: {
    root: 'relative self-start',
    plate: 'absolute inset-0 translate-x-0.5 translate-y-0.5',
    face: 'relative flex-row items-center border-2',
    label: 'font-display leading-none',
    dot: 'rounded-full',
  },
  variants: {
    size: {
      // Chip text never drops under the 13 pt type-caption floor (docs/DESIGN_SYSTEM.md
      // "Type"); xs and sm differ in padding, not in type size.
      xs: { root: 'mb-0.5 mr-0.5', face: 'gap-1 px-1.5 py-0.5', label: 'text-type-caption leading-none', dot: 'h-1.5 w-1.5' },
      sm: { root: 'mb-0.5 mr-0.5', face: 'gap-1.5 px-2 py-1', label: 'text-type-caption leading-none', dot: 'h-2 w-2' },
      md: { root: 'mb-1 mr-1', plate: 'translate-x-1 translate-y-1', face: 'gap-2 px-3 py-1.5', label: 'text-sm leading-none', dot: 'h-2.5 w-2.5' },
    },
    shape: {
      pill: { plate: 'rounded-full', face: 'rounded-full' },
      rectangle: { plate: 'rounded-xs', face: 'rounded-xs' },
    },
  },
}, TYPE_SCALE_TV);

export type BadgeNeonFill = 'solid' | 'outline' | 'ghost';
export type BadgeDot = 'none' | 'solid' | 'pulse' | 'flicker';

export interface BadgeProps {
  label: string;
  className?: string;
  /** Kept for callers: both names render the NYC-MON chip. */
  variant?: 'default' | 'neon';
  /**
   * Legacy semantic tone, mapped onto the brand: primary follows the
   * district, accent royal, success leaf, info carolina, danger apple,
   * inverse a white chip. neutral is the quiet status chip: secondary text on
   * the sunken surface, following the scheme. `color` wins over it.
   */
  tone?: LegacyBadgeTone;
  /** Colour by neighbourhood. Default midtown (orange). */
  district?: District;
  /** A brand token or NeonBlade preset; overrides `tone` and the district. */
  color?: NeonColorInput | Tone;
  /** Solid face, outline (night face, tone border and text), or ghost (tinted). Default solid, or the legacy tone's fill. */
  fill?: BadgeNeonFill;
  /** Default sm. */
  size?: 'xs' | 'sm' | 'md';
  /** Default rectangle (square chip). `pill`, or `rounded`, rounds it. */
  shape?: 'pill' | 'rectangle';
  /** Opt-in rounding: the same as shape="pill". */
  rounded?: boolean;
  /** A status light before the label. Default none. */
  dot?: BadgeDot;
  /** Accent glow. Default false. */
  glow?: boolean;
}

export function Badge({
  label,
  className,
  tone,
  district = 'midtown',
  color,
  fill: fillProp,
  size = 'sm',
  shape: shapeProp,
  rounded = false,
  dot = 'none',
  glow = false,
}: BadgeProps) {
  const reduced = useReducedMotion();
  const legacy = tone ? badgeLegacyLook(tone) : undefined;
  const fill = fillProp ?? legacy?.fill ?? 'solid';
  const pick = color ?? (legacy && legacy.tone !== 'district' ? legacy.tone : undefined);
  const toneName = resolveTone(district, pick);
  const t = TONE_CLASSES[toneName];
  const shape = rounded ? 'pill' : (shapeProp ?? 'rectangle');
  const s = neon({ size, shape });
  // Neutral is a status chip, not a brand chip: theme tokens, no depth plate, no glow.
  if (tone === 'neutral' && color === undefined) {
    return (
      <View className={s.root({ className })}>
        <View className={s.face({ className: 'border-border bg-surface-sunken' })}>
          {dot !== 'none' ? <View aria-hidden className={s.dot({ className: 'bg-text-secondary' })} /> : null}
          <Text className={s.label({ className: 'text-text-secondary' })}>{label}</Text>
        </View>
      </View>
    );
  }
  const face =
    fill === 'solid'
      ? `${t.face} border-ink-950`
      : fill === 'outline'
        ? `bg-ink-950 ${t.border}`
        : `${t.shadow} ${t.keyline}`;
  // Chip labels are 10-14px, so they need 4.5:1: white on apple-500 is 3.96:1,
  // night on apple-500 is 4.83:1, so the apple chip takes night text.
  const on = toneName === 'apple' ? 'text-ink-950' : t.on;
  const text = fill === 'solid' ? on : t.text;
  const dotFill = fill === 'solid' ? (on === 'text-ink-50' ? 'bg-ink-50' : 'bg-ink-950') : t.face;

  return (
    <View className={s.root({ className })}>
      {fill === 'solid' ? <View aria-hidden className={s.plate({ className: t.side })} /> : null}
      <View className={s.face({ className: `${face} ${glow ? t.glow : ''}` })}>
        {dot !== 'none' ? (
          <AnimatedView
            aria-hidden
            className={s.dot({ className: dotFill })}
            // Animated: the status light's pulse or flicker loop.
            style={dot === 'solid' ? undefined : cssAnimation(reduced, dot, dot === 'pulse' ? 1100 : 2200, { timing: 'ease-in-out' })}
          />
        ) : null}
        <Text className={s.label({ className: text })}>{label}</Text>
      </View>
    </View>
  );
}
