'use client';
import { tv } from 'tailwind-variants';
import { haptics } from './haptics';
import { PressScale } from './press-scale';
import { View } from './tw';
import { CornerCutFrame } from './neon/CornerCutFrame';
import { ROUND_RADIUS } from './neon/corner-cut';
import type { CutCorner } from './neon/corner-cut';
import { TONE_CLASSES, type ControlTone, type District } from './district';
import { DISABLED_FRAME_TONE, controlLook, frameTone, type IconButtonVariant } from './control-look';

// The NYC-MON icon button. Solid and outline looks draw a square
// CornerCutFrame; ghost stays a compact, frameless hit area for nav bars,
// with a soft tone tint on hover. The caller's icon keeps its own colour.
// motion-reduce kills the transitions.
const iconButton = tv({
  slots: {
    root:
      'group shrink-0 self-start rounded-none border-0 bg-transparent transition-transform duration-fast ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 ' +
      'motion-reduce:transition-none',
    tint: 'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-fast group-hover:opacity-100 motion-reduce:transition-none',
  },
  variants: {
    look: {
      solid: { root: 'active:translate-x-[2px] active:translate-y-[2px]' },
      outline: { root: 'active:translate-x-[2px] active:translate-y-[2px]' },
      ghost: { root: 'relative items-center justify-center' },
    },
    size: { sm: {}, md: {}, lg: {} },
    disabled: { true: { root: 'cursor-not-allowed active:translate-x-0 active:translate-y-0' } },
  },
  compoundVariants: [
    { look: 'ghost', size: 'sm', class: { root: 'h-8 w-8' } },
    { look: 'ghost', size: 'md', class: { root: 'h-10 w-10' } },
    { look: 'ghost', size: 'lg', class: { root: 'h-12 w-12' } },
  ],
  defaultVariants: { look: 'solid', size: 'md', disabled: false },
});

// Face size and cut per size. md and lg clear the 44px touch target.
const CUT_FACE = {
  sm: { className: 'h-9 w-9', cut: 8 },
  md: { className: 'h-11 w-11', cut: 10 },
  lg: { className: 'h-12 w-12', cut: 12 },
} as const;

export interface IconButtonProps {
  /** Opt-in rounded corners (rounded-soft) in place of the neon corner cut. Default false: square, cut. */
  rounded?: boolean;
  icon: React.ReactNode;
  'aria-label': string;
  onPress?: () => void;
  className?: string;
  /**
   * Default (no variant, `cornerCut` or `neon`): the solid corner-cut tile.
   * primary = default, outline = night tile with a tone border, ghost = no
   * frame (nav bars), tone tint on hover.
   */
  variant?: IconButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown. */
  district?: District;
  /** Which corner is cut. Default bottom-right. */
  corner?: CutCorner;
}

export function IconButton({
  icon, onPress, variant, size = 'md', disabled, className, tone: toneProp, district, corner = 'bottom-right', rounded = false, ...a11y
}: IconButtonProps) {
  const { look, tone } = controlLook(variant, toneProp, district);
  const s = iconButton({ look, size, disabled });
  const face = CUT_FACE[size];
  const iconColor = disabled ? 'text-ink-400' : look === 'solid' ? TONE_CLASSES[tone].onFace : TONE_CLASSES[tone].text;
  return (
    <PressScale
      onPress={disabled ? undefined : () => { haptics.tap(); onPress?.(); }}
      aria-disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      // The root carries the icon colour (currentColor) for icons that set none;
      // a caller's own icon class (text-text-muted in nav bars) still wins.
      className={s.root({ className: `${iconColor} ${rounded ? 'rounded-soft' : ''} ${className ?? ''}` })}
      outerClassName="self-start"
      {...a11y}
    >
      {look === 'ghost' ? (
        <>
          <View aria-hidden className={s.tint({ className: TONE_CLASSES[tone].soft })} />
          {icon}
        </>
      ) : (
        <CornerCutFrame
          radius={rounded ? ROUND_RADIUS : 0}
          tone={disabled ? DISABLED_FRAME_TONE : frameTone(look, tone)}
          variant={disabled || look === 'outline' ? 'outline' : 'solid'}
          corner={corner}
          cut={face.cut}
          depth={disabled ? 0 : 3}
          className={`items-center justify-center ${face.className} ${iconColor}`}
        >
          {icon}
        </CornerCutFrame>
      )}
    </PressScale>
  );
}
