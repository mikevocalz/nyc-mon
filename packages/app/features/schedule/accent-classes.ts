import type { ResourceAccent } from './model';

/**
 * Per-resource accent classes.
 *
 * SPELLED OUT ON PURPOSE. Tailwind scans source files as TEXT, so a class built
 * at runtime (`bg-${accent}-500`) is never emitted and the block renders
 * unstyled. Every class a resource column can use has to appear literally in a
 * scanned file, which is what this record is for.
 *
 * Shape follows the target: a thick saturated bar on the leading edge, the
 * block tinted to ~15% of that accent, and the title in the text colour. The
 * selected state is the same accent at full saturation with inverse text, so it
 * reads as one system rather than a one-off style.
 *
 * The title is the theme's text colour, not the accent hue. The surface
 * follows `color-scheme` (dark-first), but `dark:` follows the OS media
 * query, so an accent-coloured title keyed on `dark:` rendered its light
 * 700 step on the night grid for anyone whose OS is in light mode (royal 700
 * on night is under 2:1). The accent lives in the bar, tint and header dot.
 */
export interface AccentClasses {
  /** Leading edge bar. */
  bar: string;
  /** Default block background — the ~10% tint. */
  surface: string;
  /** Title colour on the tinted background. */
  title: string;
  /** Solid selected block. */
  selectedSurface: string;
  /** Title colour on the solid block. */
  selectedTitle: string;
  /** Resource header dot. */
  dot: string;
}

export const ACCENT_CLASSES: Record<ResourceAccent, AccentClasses> = {
  ember: {
    bar: 'bg-ember-500',
    surface: 'bg-ember-500/15',
    title: 'text-text',
    selectedSurface: 'bg-ember-500',
    selectedTitle: 'text-white',
    dot: 'bg-ember-500',
  },
  gold: {
    bar: 'bg-gold-500',
    surface: 'bg-gold-500/15',
    title: 'text-text',
    selectedSurface: 'bg-gold-700',
    selectedTitle: 'text-white',
    dot: 'bg-gold-500',
  },
  forest: {
    bar: 'bg-forest-500',
    surface: 'bg-forest-500/15',
    title: 'text-text',
    selectedSurface: 'bg-forest-700',
    selectedTitle: 'text-white',
    dot: 'bg-forest-500',
  },
  sky: {
    bar: 'bg-sky-500',
    surface: 'bg-sky-500/15',
    title: 'text-text',
    selectedSurface: 'bg-sky-700',
    selectedTitle: 'text-white',
    dot: 'bg-sky-500',
  },
  rose: {
    bar: 'bg-rose-500',
    surface: 'bg-rose-500/15',
    title: 'text-text',
    selectedSurface: 'bg-rose-700',
    selectedTitle: 'text-white',
    dot: 'bg-rose-500',
  },
};
