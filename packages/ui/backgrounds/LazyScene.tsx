'use client';

import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { View } from '../tw';
import { useInView } from './use-in-view';

/** What {@linkcode LazyScene} hands its scene. */
export interface LazySceneState {
  /** True while the box is off screen: pass it to the background's `paused`. */
  paused: boolean;
}

/** Props for {@linkcode LazyScene}. */
export interface LazySceneProps {
  /**
   * Renders the scene once the box comes near the viewport. Forward `paused`
   * to the background so its frame loop stops while it is scrolled away.
   */
  children: (state: LazySceneState) => ReactNode;
  /**
   * Classes for the box. Give it a height (`h-32 md:h-44`, `min-h-[60dvh]`):
   * the box holds that space before the scene mounts, so nothing shifts.
   */
  className?: string;
  /**
   * Fill shown until the scene draws, as a CSS colour. Match the scene's sky
   * so the swap is invisible. Default transparent.
   */
  placeholderColor?: string;
  /** How close to the viewport, in CSS pixels, the scene mounts. Default 600. */
  nearMarginPx?: number;
}

/**
 * A fixed-size box that mounts a canvas scene only when it scrolls near the
 * viewport and pauses it while it is off screen. Use it for every background
 * below the fold (section dividers, the footer's river), so a long page
 * starts one frame loop instead of five. Reduced motion is the background's
 * own job: each one already holds a still frame under it.
 *
 * On native the scene mounts with the screen.
 *
 * @example
 * <LazyScene className="h-32 md:h-44" placeholderColor={brand.night}>
 *   {({ paused }) => <RiverTide district="harlem" paused={paused} className="flex-1" />}
 * </LazyScene>
 */
export function LazyScene({ children, className, placeholderColor, nearMarginPx = 600 }: LazySceneProps) {
  const { ref, hasBeenNear, isVisible } = useInView({ nearMarginPx });
  return (
    <View
      ref={ref}
      className={twMerge('relative w-full overflow-hidden', className)}
      // Computed: the placeholder is a caller colour, not a theme token.
      style={placeholderColor ? { backgroundColor: placeholderColor } : undefined}
    >
      {hasBeenNear ? children({ paused: !isVisible }) : null}
    </View>
  );
}
