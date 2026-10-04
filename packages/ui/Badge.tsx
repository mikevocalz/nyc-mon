'use client';
import { tv, type VariantProps } from 'tailwind-variants';
import { useReducedMotion } from './backgrounds/use-reduced-motion';
import { TONE_CLASSES, resolveTone, type District, type Tone } from './district';
import type { NeonColorInput } from './neon/colors';
import { AnimatedView, cssAnimation } from './progress/motion';
import { View, Text } from './tw';

const badge = tv({
  slots: {
    root: 'flex-row items-center gap-1 self-start rounded-sm border-2 border-border px-2.5 py-0.5',
    label: 'text-xs font-bold',
  },
  variants: {
    tone: {
      neutral: { root: 'bg-surface-sunken', label: 'text-text-muted' },
      primary: { root: 'bg-burgundy-100 dark:bg-burgundy-900/60', label: 'text-burgundy-800 dark:text-burgundy-100' },
      accent: { root: 'bg-ember-100 dark:bg-ember-900/40', label: 'text-ember-800 dark:text-ember-100' },
      success: { root: 'bg-leaf-100 dark:bg-leaf-900/40', label: 'text-leaf-800 dark:text-leaf-100' },
      info: { root: 'bg-carolina-100 dark:bg-carolina-900/40', label: 'text-carolina-900 dark:text-carolina-100' },
      inverse: { root: 'bg-ink-50/15', label: 'text-ink-50' },
      danger: { root: 'bg-danger', label: 'text-on-danger' },
    },
  },
  defaultVariants: { tone: 'neutral' },
});

/**
 * The neon variant: a chunky sports-badge chip. Solid face, night keyline,
 * a depth plate stepped down and right, display type. Ported from NeonBlade
 * UI's Badge (MIT, see THIRD-PARTY-NOTICES.md); NeonBlade's own `variant`
 * (solid/outline/ghost) is `fill` here because `variant` picks the kit look.
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
      xs: { root: 'mb-0.5 mr-0.5', face: 'gap-1 px-1.5 py-0.5', label: 'text-[10px]', dot: 'h-1.5 w-1.5' },
      sm: { root: 'mb-0.5 mr-0.5', face: 'gap-1.5 px-2 py-1', label: 'text-xs', dot: 'h-2 w-2' },
      md: { root: 'mb-1 mr-1', plate: 'translate-x-1 translate-y-1', face: 'gap-2 px-3 py-1.5', label: 'text-sm', dot: 'h-2.5 w-2.5' },
    },
    shape: {
      pill: { plate: 'rounded-full', face: 'rounded-full' },
      rectangle: { plate: 'rounded-xs', face: 'rounded-xs' },
    },
  },
});

export type BadgeNeonFill = 'solid' | 'outline' | 'ghost';
export type BadgeDot = 'none' | 'solid' | 'pulse' | 'flicker';

export interface BadgeProps extends VariantProps<typeof badge> {
  label: string;
  className?: string;
  /** default: the kit's semantic chip (uses `tone`). neon: the NYC-MON sports chip (uses `district`/`color`). */
  variant?: 'default' | 'neon';
  /** neon: colour by neighbourhood. Default midtown (orange). */
  district?: District;
  /** neon: a brand token or NeonBlade preset; overrides the district. */
  color?: NeonColorInput | Tone;
  /** neon: solid face, outline (night face, tone border and text), or ghost (tinted). Default solid. */
  fill?: BadgeNeonFill;
  /** neon: Default sm. */
  size?: 'xs' | 'sm' | 'md';
  /** neon: Default pill. */
  shape?: 'pill' | 'rectangle';
  /** neon: a status light before the label. Default none. */
  dot?: BadgeDot;
  /** neon: accent glow. Default false. */
  glow?: boolean;
}

export function Badge(props: BadgeProps) {
  if (props.variant === 'neon') return <NeonBadge {...props} />;
  const { label, tone, className } = props;
  const { root, label: labelCls } = badge({ tone });
  return (
    <View className={root({ className })}>
      <Text className={labelCls()}>{label}</Text>
    </View>
  );
}

function NeonBadge({
  label,
  className,
  district = 'midtown',
  color,
  fill = 'solid',
  size = 'sm',
  shape = 'pill',
  dot = 'none',
  glow = false,
}: BadgeProps) {
  const reduced = useReducedMotion();
  const t = TONE_CLASSES[resolveTone(district, color)];
  const s = neon({ size, shape });
  const face =
    fill === 'solid'
      ? `${t.face} border-ink-950`
      : fill === 'outline'
        ? `bg-ink-950 ${t.border}`
        : `${t.shadow} ${t.keyline}`;
  const text = fill === 'solid' ? t.on : t.text;
  const dotFill = fill === 'solid' ? (t.on === 'text-ink-50' ? 'bg-ink-50' : 'bg-ink-950') : t.face;

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
