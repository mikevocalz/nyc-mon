'use client';
import { tv } from 'tailwind-variants';
import { ActivityIndicator } from 'react-native';
import { PressScale } from './press-scale';
import { Text, View } from './tw';
import { haptics } from './haptics';
import { CornerCutFrame } from './neon/CornerCutFrame';
import { ROUND_RADIUS } from './neon/corner-cut';
import type { CutCorner } from './neon/corner-cut';
import type { GlowIntensity } from './neon/glow';
import { TONE_CLASSES, toneHex, type ControlTone, type District } from './district';
import { DISABLED_FRAME_TONE, controlLook, frameTone, outerLayout, type ButtonVariant, type ControlLook } from './control-look';

// The NYC-MON button. Solid and outline looks draw a CornerCutFrame inside
// the pressable, so the root only owns the hit area, focus ring and press
// sink (web: the face drops into its depth plate; native: PressScale's
// spring). Ghost has no frame: a tone label and a soft tint on hover.
// motion-reduce kills the transitions.
const button = tv({
  slots: {
    root:
      'group shrink-0 self-start rounded-none border-0 bg-transparent transition-transform duration-fast ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
      'motion-reduce:transition-none',
    label: 'whitespace-nowrap font-display tracking-wide',
    // Ghost hover: a tone tint layer, faded in by the root's group-hover.
    tint: 'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-fast group-hover:opacity-100 motion-reduce:transition-none',
  },
  variants: {
    look: {
      // Frames stretch to the root, so className="flex-1" / fullWidth grow the face, not just the hit area.
      solid: { root: 'flex-col items-stretch active:translate-x-[3px] active:translate-y-[3px]' },
      outline: { root: 'flex-col items-stretch active:translate-x-[3px] active:translate-y-[3px]' },
      ghost: { root: 'relative flex-row items-center justify-center gap-2' },
    },
    size: {
      sm: { label: 'text-sm md:text-base' },
      md: { label: 'text-sm md:text-base' },
      lg: { label: 'text-base md:text-lg' },
    },
    /*
      Unavailable has to READ as unavailable. A dimmed tone face still looks
      like a button you can press, so a disabled control drops its tone, its
      depth plate (the press affordance) and its glow: a night face behind an
      ink keyline with a muted label, and no press sink.
    */
    disabled: {
      true: { root: 'cursor-not-allowed active:translate-x-0 active:translate-y-0', label: 'text-ink-400' },
    },
    // A full-width label wraps rather than clip at large text sizes (WCAG 1.4.4);
    // shrink lets it break inside the frame's flex row.
    fullWidth: { true: { root: 'w-full self-auto', label: 'min-w-0 shrink whitespace-normal text-center' } },
  },
  compoundVariants: [
    // Ghost pads its own root to the framed face's height (CUT_FACE padding plus
    // the 2px border), so a ghost and a solid button share a row's centre line.
    // With no frame the root is the whole target, so no ghost is shorter than
    // 44 pt (Apple HIG) or 48 dp on Android (Material): `sm` only trims padding.
    { look: 'ghost', size: 'sm', class: { root: 'min-h-11 px-3 py-2.5 android:min-h-12' } },
    { look: 'ghost', size: 'md', class: { root: 'min-h-11 px-4 py-[14px] android:min-h-12 md:px-5 md:py-4' } },
    { look: 'ghost', size: 'lg', class: { root: 'min-h-12 px-5 py-[18px] md:px-6 md:py-[22px]' } },
  ],
  defaultVariants: { look: 'solid', size: 'md', disabled: false },
});

// Corner-cut face padding and cut length per size; padding steps up at md.
const CUT_FACE = {
  sm: { className: 'px-5 py-2.5', cut: 10 },
  md: { className: 'px-6 py-3 md:px-8 md:py-3.5', cut: 14 },
  lg: { className: 'px-8 py-4 md:px-10 md:py-5', cut: 18 },
} as const;

// Solid labels sit on the tone face, outline labels on the night face, ghost
// labels straight on the page, so ghost takes the themed page step.
function labelTone(look: ControlLook, tone: ControlTone) {
  const c = TONE_CLASSES[tone];
  return look === 'solid' ? c.onFace : look === 'ghost' ? c.pageText : c.text;
}

export interface ButtonProps {
  /** Opt-in rounded corners (rounded-soft) in place of the neon corner cut. Default false: square, cut. */
  rounded?: boolean;
  title: string;
  /**
   * Default (no variant, `cornerCut` or `neon`): the solid corner-cut face.
   * Legacy names keep working: primary = default, accent = the district's
   * second tone (royal in Midtown), danger = apple, outline = night face
   * with a tone border, ghost = no frame, tone label. `cta` = the screen's one
   * primary call to action: brand orange face, `on-cta` label, any tone ignored.
   */
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  /** Colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood (Downtown royal, Midtown orange, Harlem brick, Mega City carolina). Default Midtown. */
  district?: District;
  /** Which corner is cut. Default bottom-right. */
  corner?: CutCorner;
  /** Accent glow around the cut shape. Off by default. */
  glow?: boolean | GlowIntensity;
  onPress?: () => void;
  loading?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Button({
  title, onPress, variant, size = 'md', disabled, fullWidth, loading, className,
  tone: toneProp, district, corner = 'bottom-right', glow = false, rounded = false, ...a11y
}: ButtonProps) {
  const { look, tone } = controlLook(variant, toneProp, district);
  const off = !!(disabled || loading);
  const s = button({ look, size, disabled: off, fullWidth });
  // cta labels read the on-cta token (signage black by day, night after dark), not the tone table.
  const labelClass = s.label({ className: off ? undefined : variant === 'cta' ? 'text-on-cta' : labelTone(look, tone) });
  const content = (
    <>
      {loading ? (
        // ActivityIndicator takes a colour prop, not a class: the label colour on this face.
        <ActivityIndicator size="small" color={look === 'solid' && !off ? toneHex(tone).on : undefined} />
      ) : null}
      <Text className={labelClass}>{title}</Text>
    </>
  );
  return (
    <PressScale
      onPress={off ? undefined : () => { haptics.tap(); onPress?.(); }}
      aria-disabled={off}
      accessibilityState={{ disabled: off }}
      className={s.root({ className: `${rounded ? 'rounded-soft' : ''} ${className ?? ''}` })}
      outerClassName={fullWidth ? 'w-full' : outerLayout(className)}
      {...a11y}
    >
      {look === 'ghost' ? (
        <>
          <View aria-hidden className={s.tint({ className: TONE_CLASSES[tone].soft })} />
          {content}
        </>
      ) : (
        <CornerCutFrame
          radius={rounded ? ROUND_RADIUS : 0}
          tone={off ? DISABLED_FRAME_TONE : frameTone(look, tone)}
          variant={off || look === 'outline' ? 'outline' : 'solid'}
          corner={corner}
          cut={CUT_FACE[size].cut}
          depth={off ? 0 : 4}
          glow={off ? false : glow}
          className={`flex-row items-center justify-center gap-2 ${CUT_FACE[size].className}`}
        >
          {content}
        </CornerCutFrame>
      )}
    </PressScale>
  );
}
