import type { District } from '../backgrounds/city-blocks-model.ts';
import { neonToken, type NeonColorInput } from '../neon/colors.ts';

export type { District };

/** Every district, in map order from the tip of the island up and out. */
export const DISTRICTS: readonly District[] = ['downtown', 'midtown', 'harlem', 'megacity'];

export const DISTRICT_NAME: Record<District, string> = {
  downtown: 'Downtown',
  midtown: 'Midtown',
  harlem: 'Harlem',
  megacity: 'Mega City',
};

/**
 * A solid colour family as Tailwind classes. `brick` is Harlem's brownstone:
 * the deep orange steps, darker than the brand orange.
 */
export type Tone = 'orange' | 'royal' | 'carolina' | 'leaf' | 'apple' | 'brick' | 'white';

export const TONES: readonly Tone[] = ['orange', 'royal', 'carolina', 'leaf', 'apple', 'brick', 'white'];

/**
 * Each district's colour pair. The tone is the main face; the accent is the
 * second voice (cornice caps, active stations, the far bracket pair).
 * Downtown is glass and steel, Midtown the orange Deco crowns, Harlem
 * brownstone with the apple red, Mega City the carolina sky glow.
 */
export const DISTRICT_TONES: Record<District, { tone: Tone; accent: Tone }> = {
  downtown: { tone: 'royal', accent: 'carolina' },
  midtown: { tone: 'orange', accent: 'royal' },
  harlem: { tone: 'brick', accent: 'apple' },
  megacity: { tone: 'carolina', accent: 'royal' },
};

/**
 * Which tone to draw with. An explicit `color` wins when it names a brand
 * token or a NeonBlade preset (cyan, pink, green...). Anything else, and no
 * colour at all, falls back to the district's tone. Raw CSS colours are not
 * supported here: these components style with classes, and a class table
 * can only name the palette.
 */
export function resolveTone(district: District = 'midtown', color?: NeonColorInput | Tone): Tone {
  if (color === 'brick') return 'brick';
  if (color !== undefined) {
    const token = neonToken(color);
    if (token && token !== 'silver' && token !== 'ink') return token;
  }
  return DISTRICT_TONES[district].tone;
}

/** The accent for a district, or for a tone when the caller picked one. */
export function resolveAccent(district: District = 'midtown', tone?: Tone): Tone {
  const pair = DISTRICT_TONES[district];
  if (!tone || tone === pair.tone) return pair.accent;
  return tone === 'royal' ? 'carolina' : tone === 'white' ? 'orange' : 'royal';
}

/** Class strings for one tone. Written out in full so Tailwind and Uniwind can find them. */
export interface ToneClasses {
  /** Main face fill (the 500 step). */
  face: string;
  /** Lit top edge, roofs (300-400). */
  top: string;
  /** Side wall, depth plate (700-800). */
  side: string;
  /** Deep recess (900). */
  deep: string;
  /** Keyline and cast shadow (950). */
  shadow: string;
  /** Lit window colour. */
  light: string;
  /** Text in the tone that reads on night. */
  text: string;
  /** Text that reads on the face fill. */
  on: string;
  /** Border in the face colour. */
  border: string;
  /** Border in the keyline colour. */
  keyline: string;
  /** Accent glow (boxShadow token). */
  glow: string;
}

export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  orange: {
    face: 'bg-orange-500', top: 'bg-orange-300', side: 'bg-orange-700', deep: 'bg-orange-900', shadow: 'bg-orange-950',
    light: 'bg-orange-200', text: 'text-orange-400', on: 'text-ink-950', border: 'border-orange-500',
    keyline: 'border-orange-950', glow: 'shadow-glow-orange',
  },
  royal: {
    face: 'bg-royal-500', top: 'bg-royal-300', side: 'bg-royal-700', deep: 'bg-royal-900', shadow: 'bg-royal-950',
    light: 'bg-carolina-200', text: 'text-royal-300', on: 'text-ink-50', border: 'border-royal-500',
    keyline: 'border-royal-950', glow: 'shadow-glow-royal',
  },
  carolina: {
    face: 'bg-carolina-500', top: 'bg-carolina-300', side: 'bg-carolina-700', deep: 'bg-carolina-900', shadow: 'bg-carolina-950',
    light: 'bg-carolina-100', text: 'text-carolina-400', on: 'text-ink-950', border: 'border-carolina-500',
    keyline: 'border-carolina-950', glow: 'shadow-glow-royal',
  },
  leaf: {
    face: 'bg-leaf-500', top: 'bg-leaf-300', side: 'bg-leaf-700', deep: 'bg-leaf-900', shadow: 'bg-leaf-950',
    light: 'bg-leaf-200', text: 'text-leaf-400', on: 'text-ink-950', border: 'border-leaf-500',
    keyline: 'border-leaf-950', glow: 'shadow-glow-royal',
  },
  apple: {
    face: 'bg-apple-500', top: 'bg-apple-300', side: 'bg-apple-700', deep: 'bg-apple-900', shadow: 'bg-apple-950',
    light: 'bg-orange-200', text: 'text-apple-400', on: 'text-ink-50', border: 'border-apple-500',
    keyline: 'border-apple-950', glow: 'shadow-glow-orange',
  },
  brick: {
    face: 'bg-orange-800', top: 'bg-orange-600', side: 'bg-orange-900', deep: 'bg-orange-950', shadow: 'bg-ink-950',
    light: 'bg-orange-300', text: 'text-orange-300', on: 'text-ink-50', border: 'border-orange-800',
    keyline: 'border-orange-950', glow: 'shadow-glow-orange',
  },
  white: {
    face: 'bg-ink-50', top: 'bg-white', side: 'bg-ink-300', deep: 'bg-ink-600', shadow: 'bg-ink-900',
    light: 'bg-orange-200', text: 'text-ink-50', on: 'text-ink-950', border: 'border-ink-50',
    keyline: 'border-ink-900', glow: 'shadow-glow-royal',
  },
};

export function toneClasses(district?: District, color?: NeonColorInput | Tone): ToneClasses {
  return TONE_CLASSES[resolveTone(district, color)];
}
