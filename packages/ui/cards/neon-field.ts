import { CONTROL_TONES, TONE_CLASSES } from '../district/index.ts';

/**
 * The neon look for the kit's text inputs (TextField, Textarea, Select):
 * a solid tone nameplate for the label, a night well with a heavy tone
 * border, and a lighter border plus an accent glow on focus. Errors switch
 * the border to apple and keep the label in its tone, so the field still
 * reads as part of its district.
 */
export const NEON_FIELD = {
  label: 'self-start px-2 py-0.5 font-display text-xs tracking-wide',
  input:
    'rounded-none border-2 bg-ink-950 font-semibold text-ink-50 placeholder:text-silver-500 ' +
    'focus:shadow-none',
  message: 'font-semibold text-apple-400',
} as const;

/** tv() compound variants that colour the neon slots by tone. `field` is the input slot's name. */
export function neonFieldCompounds<F extends string>(field: F) {
  return CONTROL_TONES.map((tone) => {
    const c = TONE_CLASSES[tone];
    return {
      variant: 'neon' as const,
      tone,
      class: { label: `${c.face} ${c.onFace}`, [field]: `${c.controlBorder} ${c.focusBorder} ${c.focusGlow}` } as Record<'label' | F, string>,
    };
  });
}

/** Neon error state: the border goes apple whatever the tone. */
export function neonErrorCompound<F extends string>(field: F) {
  return {
    variant: 'neon' as const,
    error: true,
    class: { [field]: 'border-apple-500 focus:border-apple-400', message: NEON_FIELD.message } as Record<F | 'message', string>,
  };
}
