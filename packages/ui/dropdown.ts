import { tv } from 'tailwind-variants';

/**
 * The kit's dropdown list, lifted from the NavBar so the nav menu and the
 * Select's open list are one piece: a night panel under a heavy ink keyline,
 * rows at touch height, ink-800 on hover or keyboard highlight, and the
 * current row as a solid tone patch (the same patch the active nav link
 * wears). Square by default; `rounded` opts in.
 */
export const dropdown = tv({
  slots: {
    panel: 'absolute top-full z-50 mt-1 min-w-48 border-2 border-ink-700 bg-ink-950 py-1',
    item:
      'flex min-h-11 flex-col justify-center px-4 py-2 text-left hover:bg-ink-800 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
    itemText: 'text-sm font-semibold text-silver-200',
    itemHighlight: 'bg-ink-800',
    itemActive: '',
    itemActiveText: 'text-ink-950',
    itemDisabled: 'opacity-40',
  },
  variants: {
    tone: {
      orange: { itemActive: 'bg-orange-500 hover:bg-orange-500' },
      royal: { itemActive: 'bg-royal-500 hover:bg-royal-500', itemActiveText: 'text-white' },
      carolina: { itemActive: 'bg-carolina-500 hover:bg-carolina-500' },
      leaf: { itemActive: 'bg-leaf-500 hover:bg-leaf-500' },
      apple: { itemActive: 'bg-apple-500 hover:bg-apple-500', itemActiveText: 'text-white' },
      brick: { itemActive: 'bg-orange-800 hover:bg-orange-800', itemActiveText: 'text-white' },
    },
    rounded: {
      true: { panel: 'rounded-soft overflow-hidden' },
      false: {},
    },
  },
  defaultVariants: { tone: 'orange', rounded: false },
});

export type DropdownTone = 'orange' | 'royal' | 'carolina' | 'leaf' | 'apple' | 'brick';
