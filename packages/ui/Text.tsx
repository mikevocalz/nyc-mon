import { tv, type VariantProps } from 'tailwind-variants';
import { Text as TWText } from './tw';
import { BlurText } from './text-effects/BlurText';
import { GlitchText } from './text-effects/GlitchText';
import { NeonGlowText } from './text-effects/NeonGlowText';
import { OutlineText } from './text-effects/OutlineText';
import type { TextEffectOptions } from './text-effects/types';
import { DISTRICT_TONE, TONE_CLASSES, type ControlTone, type District } from './district';
import { TYPE_SCALE_TV } from './type-scale';

/**
 * The type scale steps up with the window, not with the device.
 *
 * A phone-tuned scale on a 1280dp tablet reads as fine print: the same 16px
 * body sits in three times the measure, so the type looks undersized against
 * everything around it. Every step is defined here rather than as `md:` classes
 * sprinkled through screens, so a change lands everywhere at once and screens
 * cannot drift apart.
 *
 * `md` is 768dp — the kit's REGULAR_MIN_WIDTH, where a layout stops being
 * phone-shaped.
 *
 * NYC-MON type: display, title and heading set in the Archivo Black display
 * face (one weight, so no font-semibold on it); body, caption and label stay
 * in Space Grotesk, because running text in a poster face is hard to read.
 */
const text = tv({
  base: 'font-sans text-text',
  variants: {
    variant: {
      display: 'font-display text-display-md md:text-display-lg',
      title: 'font-display text-2xl md:text-3xl',
      heading: 'font-display text-lg md:text-xl lg:text-2xl',
      body: 'text-base md:text-lg',
      caption: 'text-sm md:text-base',
      label: 'text-sm font-semibold md:text-base',
    },
    tone: {
      default: 'text-text',
      muted: 'text-text-muted',
      accent: 'text-accent',
      primary: 'text-primary',
      inverse: 'text-text-inverse',
      danger: 'text-danger',
      // The district colour, from the `.text` step that holds 4.5:1 on night.
      district: '',
    },
  },
  defaultVariants: { variant: 'body', tone: 'default' },
}, TYPE_SCALE_TV);

/**
 * Tone text for `tone="district"`: the tone's `.text` class (orange-400,
 * royal-300, carolina-400, orange-300 for brick...), every one of them 4.5:1
 * or better on night and ink-900. It is a night-surface colour: on a light
 * page use the semantic tones, which flip with the scheme.
 */
export function districtTextClass(district: District = 'midtown', color?: ControlTone): string {
  return TONE_CLASSES[color ?? DISTRICT_TONE[district]].text;
}

/**
 * Typography for the NeonBlade effect variants. No colour classes here: the
 * effects colour their layers at runtime, and on web a colour utility is
 * !important and would beat them.
 */
const effectText = tv({
  base: 'font-display',
  variants: {
    variant: {
      glitch: 'text-display-md md:text-display-lg',
      neonGlow: 'text-display-md md:text-display-lg',
      outline: 'text-display-md md:text-display-lg',
      blur: 'font-sans text-2xl font-semibold md:text-3xl',
    },
  },
}, TYPE_SCALE_TV);

const EFFECTS = {
  glitch: GlitchText,
  neonGlow: NeonGlowText,
  outline: OutlineText,
  blur: BlurText,
} as const;

type EffectVariant = keyof typeof EFFECTS;
type BaseVariant = NonNullable<VariantProps<typeof text>['variant']>;

export interface TextProps
  extends Omit<React.ComponentProps<typeof TWText>, 'children'>,
    Omit<VariantProps<typeof text>, 'variant'>,
    TextEffectOptions {
  /**
   * Type scale step, or a NeonBlade effect:
   *   glitch: solid misprint layers that jump in bursts.
   *   neonGlow: solid letters on a drop stack with an accent glow.
   *   outline: badge lettering, orange fill on a royal outline.
   *   blur: soft until hovered (web); a one-time focus-in on native.
   * Effects respect reduced motion. Their options are listed on TextEffectOptions.
   */
  variant?: BaseVariant | EffectVariant;
  /** With `tone="district"`: whose colour. Default midtown (orange). */
  district?: District;
  /** With `tone="district"`: an explicit tone, overriding the district's. */
  districtTone?: ControlTone;
  children?: React.ReactNode;
}

const isEffect = (v: TextProps['variant']): v is EffectVariant => v !== undefined && v in EFFECTS;

export function Text({
  variant, tone, className, children, district, districtTone,
  mode, colorA, colorB, intensity, speed, colors, glowColor, glowIntensity, animate,
  strokeColor, fillColor, strokeWidth, hoverStrokeColor, hoverFillColor,
  ...props
}: TextProps) {
  if (isEffect(variant)) {
    const Effect = EFFECTS[variant];
    const label = typeof children === 'string' ? children : (props['aria-label'] as string | undefined);
    return (
      <Effect
        className={effectText({ variant, className })}
        accessibilityLabel={label}
        {...{ mode, colorA, colorB, intensity, speed, colors, glowColor, glowIntensity, animate, strokeColor, fillColor, strokeWidth, hoverStrokeColor, hoverFillColor }}
      >
        {children}
      </Effect>
    );
  }
  return (
    <TWText
      className={text({ variant, tone, className: tone === 'district' ? [districtTextClass(district, districtTone), className] : className })}
      {...props}
    >
      {children}
    </TWText>
  );
}
