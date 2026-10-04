import { CONTROL_TONES, TONE_CLASSES } from '../district/index.ts';

/**
 * The NYC-MON look for the kit's fields (TextField, Textarea, Select,
 * SearchBar, FormField): a solid tone nameplate for the label, a night well
 * with a heavy tone border, and a lighter border plus an accent glow on
 * focus. Errors switch the border to apple and keep the label in its tone,
 * so the field still reads as part of its district. The well sets its own
 * text colours, so a field stays legible on a light page too.
 */
export const NEON_FIELD = {
  root: 'gap-1.5',
  label: 'self-start px-2 py-0.5 font-display text-xs tracking-wide md:text-sm',
  input:
    'w-full min-h-11 rounded-none border-2 bg-ink-950 px-4 py-2.5 text-base font-semibold text-ink-50 ' +
    'placeholder:text-silver-500 transition-all duration-fast focus:outline-none motion-reduce:transition-none',
  /** Validation message: apple 400 in the display face. */
  message: 'font-display text-sm tracking-wide text-apple-400',
  /** Hint under a field: silver on night, the theme's muted text elsewhere. */
  hint: 'text-sm text-text-muted',
  /** The ⌘V paste chip inside a well. */
  chip: 'rounded-none border-2 border-ink-700 bg-ink-900 px-1.5 py-0.5',
  chipText: 'font-display text-[10px] tracking-wide text-silver-300',
  disabled: 'opacity-50',
} as const;

/** tv() compound variants that colour the field slots by tone. `field` is the input slot's name. */
export function neonFieldCompounds<F extends string>(field: F) {
  return CONTROL_TONES.map((tone) => {
    const c = TONE_CLASSES[tone];
    return {
      tone,
      error: false,
      class: { label: `${c.face} ${c.onFace}`, [field]: `${c.controlBorder} ${c.focusBorder} ${c.focusGlow}` } as Record<'label' | F, string>,
    };
  });
}

/** Label nameplates stay in the tone when the field errors. */
export function neonLabelCompounds() {
  return CONTROL_TONES.map((tone) => {
    const c = TONE_CLASSES[tone];
    return { tone, error: true, class: { label: `${c.face} ${c.onFace}` } };
  });
}

/** Error state: the border goes apple whatever the tone. */
export function neonErrorVariant<F extends string>(field: F) {
  return { [field]: 'border-apple-500 focus:border-apple-400', message: NEON_FIELD.message } as Record<F | 'message', string>;
}
