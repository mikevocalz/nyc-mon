import { palette } from '@acme/theme';
import { neonColor, type NeonColorInput } from './neon/colors.ts';

/**
 * Avatar looks, shared by the web and native forks.
 *
 * cornerCut (default; `neon` is an alias): NeonBlade's data-table user tile.
 * A square filled with a top-left to bottom-right gradient, the bottom-right
 * corner cut at 45 degrees, initials in the display face in night ink.
 * bracket: the earlier night tile with the DataTable's cornice brackets.
 */
export type AvatarVariant = 'cornerCut' | 'neon' | 'bracket';

export type AvatarLook = 'cornerCut' | 'bracket';

export function avatarLook(variant: AvatarVariant | undefined): AvatarLook {
  return variant === 'bracket' ? 'bracket' : 'cornerCut';
}

/**
 * Gradient presets. NeonBlade's tile runs cyan to magenta; NEON_PRESET_TOKENS
 * maps cyan to carolina, purple to royal and pink to apple, so `skyline` runs
 * that same path in the NYC-MON palette, on the 400 steps so night initials
 * hold 4.5:1 from end to end (avatar-look.test.ts checks every preset).
 */
export const AVATAR_GRADIENTS = {
  /** Default. Carolina sky through royal into a light Big Apple red; royal and apple mix to violet between them. */
  skyline: [palette.carolina[400], palette.royal[400], palette.apple[300]],
  /** Carolina into royal: the cool, all-blue version. */
  harbor: [palette.carolina[300], palette.royal[400]],
  /** Carolina into the wordmark orange. */
  sunset: [palette.carolina[400], palette.orange[400]],
  /** NeonBlade's original cyan to magenta, outside the brand palette. */
  neonblade: ['#00F3FF', '#FF00FF'],
} as const satisfies Record<string, readonly string[]>;

export type AvatarGradientPreset = keyof typeof AVATAR_GRADIENTS;
/** A preset name, or two or more stops (brand tokens, NeonBlade presets or CSS colours), top-left first. */
export type AvatarGradient = AvatarGradientPreset | readonly [NeonColorInput, NeonColorInput, ...NeonColorInput[]];

export const DEFAULT_AVATAR_GRADIENT: AvatarGradientPreset = 'skyline';

/** Resolve a gradient prop to CSS colour stops, top-left first, evenly spaced. */
export function avatarGradientStops(gradient: AvatarGradient = DEFAULT_AVATAR_GRADIENT): string[] {
  if (typeof gradient === 'string') return [...(AVATAR_GRADIENTS[gradient] ?? AVATAR_GRADIENTS[DEFAULT_AVATAR_GRADIENT])];
  return gradient.map((stop) => neonColor(stop).base);
}

/** The cut takes this share of the side off the bottom-right corner. */
export const AVATAR_CUT_RATIO = 0.22;

/**
 * Web clip-path for the cut. Percentages, so a caller's size override
 * (`md:h-11 md:w-11`) keeps the same proportion without a re-measure.
 */
export const AVATAR_CLIP_PATH = (() => {
  const far = `${Math.round((1 - AVATAR_CUT_RATIO) * 100)}%`;
  return `polygon(0 0, 100% 0, 100% ${far}, ${far} 100%, 0 100%)`;
})();

/** Cut length in px for a measured tile (native Skia path). */
export function avatarCut(width: number, height: number): number {
  return Math.round(Math.min(width, height) * AVATAR_CUT_RATIO);
}

/** px per size step, matching the h-/w- classes on the tile. */
export const AVATAR_PX = { sm: 32, md: 44, lg: 64, xl: 96 } as const;
export type AvatarSize = keyof typeof AVATAR_PX;
