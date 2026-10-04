'use client';
import { tv, type VariantProps } from 'tailwind-variants';
import { ActivityIndicator } from 'react-native';
import { PressScale } from './press-scale';
import { Text } from './tw';
import { haptics } from './haptics';
import { CornerCutFrame } from './neon/CornerCutFrame';
import type { CutCorner } from './neon/corner-cut';
import type { GlowIntensity } from './neon/glow';
import { resolveTone, toneInput, toneVariants, type ControlTone, type District } from './cards/tones';

// Press feedback: §8 ladder rung 1 — simple active-state opacity/scale via
// NW5 transitions; respects reduced motion (motion-reduce kills transitions).
const button = tv({
  slots: {
    root:
      'shrink-0 flex-row items-center justify-center gap-2 self-start rounded-md border-2 border-border-strong ' +
      'transition-all duration-fast active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ' +
      'motion-reduce:transition-none',
    label: 'whitespace-nowrap font-semibold',
  },
  variants: {
    variant: {
      primary: { root: 'bg-primary shadow-card hover:bg-primary-pressed', label: 'text-on-primary' },
      accent: { root: 'bg-accent shadow-card hover:bg-accent-pressed', label: 'text-on-accent' },
      outline: { root: 'bg-surface-raised shadow-card hover:bg-surface-sunken', label: 'text-text' },
      ghost: { root: 'border-transparent bg-transparent shadow-none hover:bg-surface-sunken active:shadow-none', label: 'text-text' },
      danger: { root: 'bg-danger shadow-card hover:opacity-90', label: 'text-on-danger' },
      // NeonBlade corner-cut button: the shape is drawn by CornerCutFrame
      // inside the pressable, so the root drops its own box. Pressing sinks
      // the face into its depth plate (the base active: translate).
      cornerCut: {
        root: 'rounded-none border-0 bg-transparent shadow-none hover:bg-transparent',
        label: 'font-display tracking-wide',
      },
    },
    tone: toneVariants(() => ({})),
    // Labels and padding both step up at md. Scaling the label alone would
    // leave the text crowded against a phone-sized box on a tablet, so the
    // control grows with its text.
    size: {
      sm: { root: 'px-4 py-2 md:px-5 md:py-2.5', label: 'text-sm md:text-base' },
      md: { root: 'px-5 py-2.5 md:px-6 md:py-3', label: 'text-sm md:text-base' },
      lg: { root: 'px-6 py-3.5 md:px-8 md:py-4', label: 'text-base md:text-lg' },
    },
    /*
      Unavailable has to READ as unavailable. Opacity alone was not enough: a
      50%-opacity yellow button on a white sheet still looks like a yellow
      button, so a disabled submit invited a tap that did nothing and explained
      nothing. In this design language the hard offset shadow IS the pressable
      affordance, so dropping it — plus a muted fill and label — is what says
      "not yet". The colour cue is deliberately not the only one.
    */
    disabled: {
      true: {
        root: 'border-border bg-surface-sunken shadow-none hover:bg-surface-sunken active:translate-x-0 active:translate-y-0',
        label: 'text-text-muted',
      },
    },
    fullWidth: { true: { root: 'w-full self-auto' } },
  },
  compoundVariants: [
    { variant: 'cornerCut', class: { root: 'p-0 md:p-0' } },
    ...(Object.entries(toneVariants((c) => c.onFace)) as [ControlTone, string][]).map(([tone, onFace]) => ({
      variant: 'cornerCut' as const, tone, disabled: false, class: { label: onFace },
    })),
    { variant: 'cornerCut', disabled: true, class: { root: 'bg-transparent', label: 'text-ink-700' } },
  ],
  defaultVariants: { variant: 'primary', size: 'md', disabled: false },
});

// Corner-cut face padding and cut length per size; padding steps up at md like the kit sizes.
const CUT_FACE = {
  sm: { className: 'px-5 py-2.5', cut: 10 },
  md: { className: 'px-6 py-3 md:px-8 md:py-3.5', cut: 14 },
  lg: { className: 'px-8 py-4 md:px-10 md:py-5', cut: 18 },
} as const;

export interface ButtonProps extends Omit<VariantProps<typeof button>, 'tone'> {
  title: string;
  /** cornerCut: colour family. Overrides `district`. */
  tone?: ControlTone;
  /** cornerCut: theme by neighbourhood (Downtown royal, Midtown orange, Harlem brick, Mega City carolina). */
  district?: District;
  /** cornerCut: which corner is cut. Default bottom-right. */
  corner?: CutCorner;
  /** cornerCut: accent glow around the cut shape. Off by default. */
  glow?: boolean | GlowIntensity;
  onPress?: () => void;
  loading?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Button({
  title, onPress, variant, size, disabled, fullWidth, loading, className,
  tone: toneProp, district, corner = 'bottom-right', glow = false, ...a11y
}: ButtonProps) {
  const tone = resolveTone(toneProp, district);
  const off = !!(disabled || loading);
  const { root, label } = button({ variant, size, tone, disabled: off, fullWidth });
  const content = (
    <>
      {loading ? <ActivityIndicator size="small" /> : null}
      <Text className={label()}>{title}</Text>
    </>
  );
  return (
    <PressScale
      onPress={disabled || loading ? undefined : () => { haptics.tap(); onPress?.(); }}
      aria-disabled={disabled || loading}
      className={root({ className })}
      outerClassName={fullWidth ? 'w-full' : 'self-start'}
      {...a11y}
    >
      {variant === 'cornerCut' ? (
        <CornerCutFrame
          tone={off ? 'silver' : toneInput(tone)}
          corner={corner}
          cut={CUT_FACE[size ?? 'md'].cut}
          depth={off ? 0 : 4}
          glow={off ? false : glow}
          className={`flex-row items-center justify-center gap-2 ${CUT_FACE[size ?? 'md'].className}`}
        >
          {content}
        </CornerCutFrame>
      ) : content}
    </PressScale>
  );
}
