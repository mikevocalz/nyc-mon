'use client';
import { tv, type VariantProps } from 'tailwind-variants';
import { haptics } from './haptics';
import { PressScale } from './press-scale';
import { CornerCutFrame } from './neon/CornerCutFrame';
import type { CutCorner } from './neon/corner-cut';
import { resolveControlTone, toneInput, type ControlTone, type District } from './district';

// Press feedback: §8 ladder rung 1 — active-state opacity via NW5 transitions;
// motion-reduce kills transitions.
const iconButton = tv({
  base:
    'shrink-0 items-center justify-center self-start rounded-md border-2 border-border-strong transition-all duration-fast ' +
    'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ' +
    'motion-reduce:transition-none',
  variants: {
    variant: {
      primary: 'bg-primary shadow-card hover:bg-primary-pressed',
      ghost: 'border-transparent bg-transparent hover:bg-surface-sunken',
      outline: 'bg-surface-raised shadow-card hover:bg-surface-sunken',
      // NeonBlade corner-cut: CornerCutFrame draws the face inside; the root keeps only the hit area.
      cornerCut: 'h-auto w-auto rounded-none border-0 bg-transparent shadow-none',
    },
    size: {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
    },
    disabled: { true: 'opacity-50' },
  },
  compoundVariants: [
    { variant: 'cornerCut', class: 'h-auto w-auto' },
    { variant: 'cornerCut', disabled: true, class: 'opacity-100' },
  ],
  defaultVariants: { variant: 'primary', size: 'md', disabled: false },
});

// Face size and cut per size. md and lg clear the 44px touch target.
const CUT_FACE = {
  sm: { className: 'h-9 w-9', cut: 8 },
  md: { className: 'h-11 w-11', cut: 10 },
  lg: { className: 'h-12 w-12', cut: 12 },
} as const;

export interface IconButtonProps extends VariantProps<typeof iconButton> {
  icon: React.ReactNode;
  'aria-label': string;
  onPress?: () => void;
  className?: string;
  /** cornerCut: colour family. Overrides `district`. */
  tone?: ControlTone;
  /** cornerCut: theme by neighbourhood. */
  district?: District;
  /** cornerCut: which corner is cut. Default bottom-right. */
  corner?: CutCorner;
}

export function IconButton({
  icon, onPress, variant, size, disabled, className, tone, district, corner = 'bottom-right', ...a11y
}: IconButtonProps) {
  const face = CUT_FACE[size ?? 'md'];
  return (
    <PressScale
      onPress={disabled ? undefined : () => { haptics.tap(); onPress?.(); }}
      aria-disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      className={iconButton({ variant, size, disabled, className })}
      outerClassName="self-start"
      {...a11y}
    >
      {variant === 'cornerCut' ? (
        <CornerCutFrame
          tone={disabled ? 'silver' : toneInput(resolveControlTone(tone, district))}
          corner={corner}
          cut={face.cut}
          depth={disabled ? 0 : 3}
          className={`items-center justify-center ${face.className}`}
        >
          {icon}
        </CornerCutFrame>
      ) : icon}
    </PressScale>
  );
}
