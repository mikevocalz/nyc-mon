import { tv } from 'tailwind-variants';
import { NIGHT_SCHEME } from './NightScope';
import { toneVariants, type ControlTone, type ToneClasses } from './district';

/**
 * The NYC-MON drop well, shared by the web and native DropZone forks: a
 * night well behind a dashed tone border. Hover (web) firms the border up
 * to solid; a drag over the zone (`active`) makes it solid, lifts the
 * well's floor to ink-900 and adds the tone's accent glow. The glyph tile is
 * a solid tone face with its keyline. The well scopes the dark theme, so
 * children a screen passes in stay legible on a light page.
 */
export const dropZone = tv({
  slots: {
    root:
      `${NIGHT_SCHEME} items-center justify-center gap-3 border-2 border-dashed bg-ink-950 p-8 md:p-10 ` +
      'transition-all duration-base hover:border-solid motion-reduce:transition-none',
    tile:
      'h-16 w-16 items-center justify-center border-2 transition-transform duration-base motion-reduce:transition-none',
    title: 'text-center font-display text-base tracking-wide text-ink-50 md:text-lg',
    description: 'max-w-content-form text-center text-sm text-silver-300 md:text-base',
    glyph: '',
  },
  variants: {
    tone: toneVariants((c) => ({ root: c.controlBorder, tile: `${c.face} ${c.controlKeyline}`, glyph: c.onFace })),
    active: {
      true: { root: 'border-solid bg-ink-900', tile: '-translate-y-1 motion-reduce:translate-y-0' },
    },
  },
  // The accent glow appears only while a drag is over the zone.
  compoundVariants: (Object.entries(toneVariants((c) => c)) as [ControlTone, ToneClasses][]).map(([tone, c]) => ({
    tone, active: true, class: { root: c.glow },
  })),
});
