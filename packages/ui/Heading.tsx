import { tv, type VariantProps } from 'tailwind-variants';
import {
  Heading as PrimitiveHeading,
  type HeadingProps as PrimitiveHeadingProps,
} from './primitives';
import type { ControlTone, District } from './district';
import { districtTextClass } from './Text';
import { TYPE_SCALE_TV } from './type-scale';

const heading = tv({
  base: 'font-display text-text',
  variants: {
    // Each size steps up one rung at md — see Text.tsx for why the scale is
    // responsive at the source rather than per screen. display-2xl is already
    // the top of the scale and has nowhere to go.
    size: {
      'display-2xl': 'text-display-2xl',
      'display-xl': 'text-display-xl md:text-display-2xl',
      'display-lg': 'text-display-lg md:text-display-xl',
      'display-md': 'text-display-md md:text-display-lg',
      'display-sm': 'text-display-sm md:text-display-md',
      title: 'text-2xl md:text-3xl',
    },
    tone: {
      default: 'text-text',
      muted: 'text-text-muted',
      primary: 'text-primary',
      accent: 'text-accent',
      inverse: 'text-text-inverse',
      // The district colour on night; see districtTextClass in Text.tsx.
      district: '',
    },
  },
  defaultVariants: { size: 'display-md', tone: 'default' },
}, TYPE_SCALE_TV);

export interface HeadingProps
  extends PrimitiveHeadingProps,
    VariantProps<typeof heading> {
  /** With `tone="district"`: whose colour. Default midtown (orange). */
  district?: District;
  /** With `tone="district"`: an explicit tone, overriding the district's. */
  districtTone?: ControlTone;
}

/**
 * Page and section headings in the display face (Archivo Black). Display
 * sizes are 24px and up, so the AA large-text threshold applies; every tone
 * here still clears 4.5:1 on its surface.
 */
export function Heading({ level = 1, size, tone, district, districtTone, className, ...props }: HeadingProps) {
  return (
    <PrimitiveHeading
      level={level}
      className={heading({
        size,
        tone,
        className: tone === 'district' ? [districtTextClass(district, districtTone), className] : className,
      })}
      {...props}
    />
  );
}
