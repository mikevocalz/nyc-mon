import { brand, palette } from '@acme/theme';
import type { District } from '../backgrounds/city-blocks-model.ts';
import { shadeSteps } from '../neon/shade.ts';

/**
 * Tones for the NeonBlade variants on kit controls (Button, Card, TextField,
 * Checkbox, Select, Switch) and the card slider.
 *
 * Five brand families plus `brick`, the Harlem brownstone (deep orange steps
 * with an apple accent). A `district` picks a tone when no explicit tone is
 * passed: Downtown glass is royal, Midtown deco is orange, Harlem is brick,
 * Mega City is carolina.
 */
export type ControlTone = 'orange' | 'royal' | 'carolina' | 'leaf' | 'apple' | 'brick';
export type { District };

export const DISTRICTS: readonly District[] = ['downtown', 'midtown', 'harlem', 'megacity'];
export const CONTROL_TONES: readonly ControlTone[] = ['orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'];

export const DISTRICT_TONE: Record<District, ControlTone> = {
  downtown: 'royal',
  midtown: 'orange',
  harlem: 'brick',
  megacity: 'carolina',
};

export const DISTRICT_NAME: Record<District, string> = {
  downtown: 'Downtown',
  midtown: 'Midtown',
  harlem: 'Harlem',
  megacity: 'Mega City',
};

/** An explicit tone wins, then the district's tone, then orange. */
export function resolveTone(tone?: ControlTone, district?: District): ControlTone {
  return tone ?? (district ? DISTRICT_TONE[district] : 'orange');
}

export interface ToneHex {
  /** Brightest step, for the beam and rim light. */
  highlight: string;
  /** Main solid face. */
  face: string;
  /** Depth plate behind the face. */
  plate: string;
  /** Deep recess step: unlit tracks and wells. */
  deep: string;
  /** Keyline around the face, almost night. */
  keyline: string;
  /** Accent glow colour. */
  glow: string;
  /** Text that reads on `face`. */
  on: string;
}

/**
 * Hex values for drawing code (Skia paths, the beam rotor, CornerCutFrame's
 * `tone`). Brand tones read their palette steps, the same ones the classes in
 * TONE_CLASSES use. Orange glows royal, the badge pairing; brick glows apple.
 */
export function toneHex(tone: ControlTone): ToneHex {
  if (tone === 'brick') {
    const o = palette.orange;
    return { highlight: o[500], face: o[800], plate: o[950], deep: o[950], keyline: palette.ink[950], glow: brand.apple, on: brand.white };
  }
  const s = shadeSteps(tone);
  const on = tone === 'royal' || tone === 'apple' ? brand.white : brand.night;
  return {
    highlight: s.highlight,
    face: s.face,
    plate: s.side,
    deep: s.deep,
    keyline: s.shadow,
    glow: tone === 'orange' ? brand.royal : s.face,
    on,
  };
}

/**
 * Class strings per tone, written out in full so Tailwind and Uniwind see
 * every one. Components build their tv() tone variants from these.
 */
export interface ToneClasses {
  /** Solid face fill. */
  face: string;
  /** Depth plate fill. */
  plate: string;
  /** Border in the tone on a night surface. */
  border: string;
  /** Lighter border on keyboard focus. */
  focusBorder: string;
  /** Text on the solid face. */
  onFace: string;
  /** Tone-coloured text that holds AA on night. */
  ink: string;
  /** Dark border for the face keyline. */
  keyline: string;
  /** 15% tint for hover and selected states on night. */
  soft: string;
  /** Accent glow on keyboard focus (web; native ignores focus: variants). */
  focusGlow: string;
}

export const TONE_CLASSES: Record<ControlTone, ToneClasses> = {
  orange: {
    face: 'bg-orange-500', plate: 'bg-orange-700', border: 'border-orange-500', focusBorder: 'focus:border-orange-300',
    onFace: 'text-ink-950', ink: 'text-orange-400', keyline: 'border-orange-950', soft: 'bg-orange-500/15',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-orange-500)]',
  },
  // Royal is too dark to read as text on night, so royal labels use its 300 step.
  royal: {
    face: 'bg-royal-500', plate: 'bg-royal-700', border: 'border-royal-500', focusBorder: 'focus:border-royal-300',
    onFace: 'text-white', ink: 'text-royal-300', keyline: 'border-royal-950', soft: 'bg-royal-500/15',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-royal-400)]',
  },
  carolina: {
    face: 'bg-carolina-500', plate: 'bg-carolina-700', border: 'border-carolina-500', focusBorder: 'focus:border-carolina-300',
    onFace: 'text-ink-950', ink: 'text-carolina-400', keyline: 'border-carolina-950', soft: 'bg-carolina-500/15',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-carolina-500)]',
  },
  leaf: {
    face: 'bg-leaf-500', plate: 'bg-leaf-700', border: 'border-leaf-500', focusBorder: 'focus:border-leaf-300',
    onFace: 'text-ink-950', ink: 'text-leaf-400', keyline: 'border-leaf-950', soft: 'bg-leaf-500/15',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-leaf-500)]',
  },
  apple: {
    face: 'bg-apple-500', plate: 'bg-apple-700', border: 'border-apple-500', focusBorder: 'focus:border-apple-300',
    onFace: 'text-white', ink: 'text-apple-400', keyline: 'border-apple-950', soft: 'bg-apple-500/15',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-apple-500)]',
  },
  brick: {
    face: 'bg-orange-800', plate: 'bg-orange-950', border: 'border-orange-700', focusBorder: 'focus:border-apple-400',
    onFace: 'text-white', ink: 'text-orange-300', keyline: 'border-ink-950', soft: 'bg-orange-800/25',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-apple-500)]',
  },
};

/** One tv() slot map per tone: `toneVariants((c) => ({ root: c.face }))`. */
export function toneVariants<S>(pick: (c: ToneClasses) => S): Record<ControlTone, S> {
  return Object.fromEntries(CONTROL_TONES.map((t) => [t, pick(TONE_CLASSES[t])])) as Record<ControlTone, S>;
}

/**
 * The tone as CornerCutFrame's `tone` input: brand tones by token name, so
 * the frame reads exact palette steps; brick as its 800-step hex.
 */
export function toneInput(tone: ControlTone): string {
  return tone === 'brick' ? palette.orange[800] : tone;
}
