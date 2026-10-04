'use client';

import { tv } from 'tailwind-variants';
import { CitySkyline } from './CitySkyline';
import { THEMES, type District } from './district-theme';
import { LazyScene } from './LazyScene';
import { View } from '../tw';

/** Props for {@linkcode SkylineDivider}. */
export interface SkylineDividerProps {
  /** Whose skyline stands between the sections. Default midtown. */
  district?: District;
  /** Band height. sm 64/80px, md 96/128px, lg 144/192px (phone/desktop). Default md. */
  size?: 'sm' | 'md' | 'lg';
  /** Layout seed: same seed, same buildings. Vary it so two dividers on a page differ. Default 1. */
  seed?: number;
  /** Classes for the band (margins, bleed). */
  className?: string;
}

const divider = tv({
  slots: {
    root: 'w-full',
    scene: 'flex-1',
    keyline: 'h-1 w-full',
  },
  variants: {
    size: {
      sm: { root: 'h-16 md:h-20' },
      md: { root: 'h-24 md:h-32' },
      lg: { root: 'h-36 md:h-48' },
    },
    district: {
      // The district theme's accent (district/themes.ts).
      downtown: { keyline: 'bg-orange-500' },
      midtown: { keyline: 'bg-orange-500' },
      harlem: { keyline: 'bg-apple-500' },
      megacity: { keyline: 'bg-carolina-500' },
    },
  },
});

/**
 * A full-width band of district skyline that breaks a long page into its
 * major sections. The street keyline along its foot is the district accent.
 *
 * Decorative and hidden from assistive tech: the sections on either side
 * carry their own headings. It holds its height before the canvas mounts,
 * mounts only near the viewport and pauses when scrolled away (see
 * LazyScene); traffic is off so a divider never competes with content, and
 * the beacons stop blinking under reduced motion.
 */
export function SkylineDivider({ district = 'midtown', size = 'md', seed = 1, className }: SkylineDividerProps) {
  const s = divider({ size, district });
  return (
    <View aria-hidden className={s.root({ className })}>
      <LazyScene className={s.scene()} placeholderColor={THEMES[district].sky[0]}>
        {({ paused }) => (
          <CitySkyline district={district} seed={seed} depth={2} showVehicles={false} paused={paused} className="flex-1" />
        )}
      </LazyScene>
      <View className={s.keyline()} />
    </View>
  );
}
