'use client';
import { useSizeClass, type SizeClass } from '../use-size-class';

export type NeonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface NeonSizeMetrics {
  /** Padding and type classes for the control's root. */
  className: string;
  /** Corner-cut length in px (CornerCutFrame `cut`). */
  cut: number;
  /** Glow radius in px for this size (neonGlow intensity). */
  glow: number;
  /** Icon size in px. */
  icon: number;
  /** Solid depth-plate offset in px (SolidPanel, stacked layers). */
  depth: number;
}

// Regular (window >= 768px) follows NeonBlade's corner-cut button scale
// (px-4 py-2 text-xs up to px-12 py-6 text-lg). Compact (phones, split
// views) drops the padding one step so a row of controls fits a 390px
// screen, keeps the type size, and never goes below a 44px touch target.
// Class strings are written out in full so Tailwind and Uniwind can see them.
const REGULAR: Record<NeonSize, NeonSizeMetrics> = {
  xs: { className: 'px-4 py-2 text-xs', cut: 8, glow: 8, icon: 12, depth: 2 },
  sm: { className: 'px-6 py-3 text-xs', cut: 12, glow: 10, icon: 14, depth: 3 },
  md: { className: 'px-8 py-4 text-sm', cut: 16, glow: 15, icon: 16, depth: 4 },
  lg: { className: 'px-10 py-5 text-base', cut: 20, glow: 20, icon: 20, depth: 5 },
  xl: { className: 'px-12 py-6 text-lg', cut: 24, glow: 28, icon: 24, depth: 6 },
};

const COMPACT: Record<NeonSize, NeonSizeMetrics> = {
  xs: { className: 'min-h-11 px-3 py-2 text-xs', cut: 6, glow: 6, icon: 12, depth: 2 },
  sm: { className: 'min-h-11 px-4 py-2 text-xs', cut: 9, glow: 8, icon: 14, depth: 2 },
  md: { className: 'min-h-11 px-6 py-3 text-sm', cut: 12, glow: 12, icon: 16, depth: 3 },
  lg: { className: 'min-h-11 px-8 py-4 text-base', cut: 15, glow: 16, icon: 18, depth: 4 },
  xl: { className: 'min-h-11 px-10 py-5 text-lg', cut: 18, glow: 22, icon: 22, depth: 5 },
};

/** Size metrics for a given size class, for code that already knows it. */
export function neonSize(size: NeonSize, sizeClass: SizeClass): NeonSizeMetrics {
  return (sizeClass === 'regular' ? REGULAR : COMPACT)[size];
}

/** Size metrics that follow the window's size class (compact below 768px). */
export function useNeonSize(size: NeonSize = 'md'): NeonSizeMetrics {
  return neonSize(size, useSizeClass());
}
