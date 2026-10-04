// Pure helpers behind the neon defaults of the surface components (Card,
// Badge, Avatar, LoadingSkeleton, EmptyState). No React, no platform code,
// so node --test can run them.
import type { Tone } from './district/tones.ts';

/**
 * Classes that place the card in its parent (outer box) as opposed to
 * styling its content (inner face). The legacy Card took one className for
 * both, and screens still pass `gap-4` for the content and `md:flex-1` for
 * the layout on the same prop, so the neon card splits them.
 */
const OUTER = /^(?:-?m[trblxyse]?-|w-|min-w-|max-w-|flex-1$|flex-auto$|flex-initial$|flex-none$|grow|shrink|basis-|self-|order-|col-|row-span|hidden$|absolute$|fixed$|sticky$|inset-|top-|left-|right-|bottom-|z-)/;

export function splitCardClasses(className?: string): { outer: string; inner: string } {
  const outer: string[] = [];
  const inner: string[] = [];
  for (const cls of (className ?? '').split(/\s+/).filter(Boolean)) {
    // Strip responsive/state prefixes (md:, hover:, dark:) before matching the utility.
    const utility = cls.slice(cls.lastIndexOf(':') + 1).replace(/^!/, '');
    (OUTER.test(utility) ? outer : inner).push(cls);
  }
  return { outer: outer.join(' '), inner: inner.join(' ') };
}

/** The legacy kit Card's elevation, read as the neon card's depth plate offset in px. */
export const CARD_DEPTH = { flat: 0, card: 6, raised: 10 } as const;

/** The legacy Badge semantic tones. */
export type LegacyBadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'info' | 'inverse' | 'danger';

/**
 * Legacy tone to neon chip. `primary` follows the district (orange by
 * default); the status tones are fixed so meaning never depends on the
 * neighbourhood; neutral is a night outline chip in white.
 */
export function badgeLegacyLook(tone: LegacyBadgeTone): { tone: Tone | 'district'; fill: 'solid' | 'outline' } {
  switch (tone) {
    case 'neutral': return { tone: 'white', fill: 'outline' };
    case 'primary': return { tone: 'district', fill: 'solid' };
    case 'accent': return { tone: 'royal', fill: 'solid' };
    case 'success': return { tone: 'leaf', fill: 'solid' };
    case 'info': return { tone: 'carolina', fill: 'solid' };
    case 'inverse': return { tone: 'white', fill: 'solid' };
    case 'danger': return { tone: 'apple', fill: 'solid' };
  }
}

/** Up to two initials, uppercased. */
export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

/**
 * A fixed skyline: building heights as a share of the block (0-100). Fixed so
 * a loading list doesn't reshuffle between renders, offset per row so stacked
 * rows don't line up into columns.
 */
const SKYLINE = [46, 72, 58, 94, 40, 66, 84, 52, 62, 36, 78, 56, 70, 44];

export function skylineHeights(row: number, count = 9): number[] {
  const start = ((row * 5) % SKYLINE.length + SKYLINE.length) % SKYLINE.length;
  return Array.from({ length: count }, (_, i) => SKYLINE[(start + i) % SKYLINE.length] as number);
}

/** Which windows are lit in a building: a fixed, sparse pattern. */
export function litWindow(row: number, building: number): boolean {
  return (row * 7 + building * 3) % 5 === 1;
}

/** Strip text colour utilities so a tile can set its own icon colour on a solid face. */
export function withoutTextColour(className?: string): string {
  return (className ?? '')
    .split(/\s+/)
    .filter((c) => c && !/^(?:[a-z0-9-]+:)*text-(?!xs$|sm$|base$|lg$|xl$|\d?xl$|left$|right$|center$|justify$|\[\d)/.test(c))
    .join(' ');
}

/**
 * Left accent bars for rows (List, Collapsible, Menu, DataTable): the tone
 * edge a row takes when selected, open or hovered. Written out in full so
 * Tailwind and Uniwind see every class. Brick uses its 700 step so the bar
 * holds on night.
 */
export const ROW_BAR = {
  orange: { bar: 'border-l-orange-500', hover: 'hover:border-l-orange-500', tint: 'bg-orange-500/15', hoverTint: 'hover:bg-orange-500/10', focus: 'focus:border-l-orange-500', focusTint: 'focus:bg-orange-500/10' },
  royal: { bar: 'border-l-royal-400', hover: 'hover:border-l-royal-400', tint: 'bg-royal-500/20', hoverTint: 'hover:bg-royal-500/15', focus: 'focus:border-l-royal-400', focusTint: 'focus:bg-royal-500/15' },
  carolina: { bar: 'border-l-carolina-500', hover: 'hover:border-l-carolina-500', tint: 'bg-carolina-500/15', hoverTint: 'hover:bg-carolina-500/10', focus: 'focus:border-l-carolina-500', focusTint: 'focus:bg-carolina-500/10' },
  leaf: { bar: 'border-l-leaf-500', hover: 'hover:border-l-leaf-500', tint: 'bg-leaf-500/15', hoverTint: 'hover:bg-leaf-500/10', focus: 'focus:border-l-leaf-500', focusTint: 'focus:bg-leaf-500/10' },
  apple: { bar: 'border-l-apple-500', hover: 'hover:border-l-apple-500', tint: 'bg-apple-500/15', hoverTint: 'hover:bg-apple-500/10', focus: 'focus:border-l-apple-500', focusTint: 'focus:bg-apple-500/10' },
  brick: { bar: 'border-l-orange-700', hover: 'hover:border-l-orange-700', tint: 'bg-orange-800/30', hoverTint: 'hover:bg-orange-800/20', focus: 'focus:border-l-orange-700', focusTint: 'focus:bg-orange-800/20' },
} as const;
