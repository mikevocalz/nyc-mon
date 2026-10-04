import { brand, palette } from '@acme/theme';
import { neonToken, type NeonColorInput } from '../neon/colors.ts';
import { shadeSteps } from '../neon/shade.ts';
import type { District } from './districts.ts';

/**
 * Solid colour families. `brick` is Harlem's brownstone: the deep orange
 * steps, darker than the brand orange, with the apple as its accent.
 */
export type Tone = 'orange' | 'royal' | 'carolina' | 'leaf' | 'apple' | 'brick' | 'white';
/** The tones a control (Button, fields, Card frames) can take: every tone but white. */
export type ControlTone = Exclude<Tone, 'white'>;

export const TONES: readonly Tone[] = ['orange', 'royal', 'carolina', 'leaf', 'apple', 'brick', 'white'];
export const CONTROL_TONES: readonly ControlTone[] = ['orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'];

/**
 * Each district's colour pair. The tone is the main face; the accent is the
 * second voice (cornice caps, active stations, the far bracket pair, the
 * dialog sign). Downtown is glass and steel, Midtown the orange Deco crowns,
 * Harlem brownstone with the apple red, Mega City the carolina sky glow.
 */
export const DISTRICT_TONES: Record<District, { tone: ControlTone; accent: Tone }> = {
  downtown: { tone: 'royal', accent: 'carolina' },
  midtown: { tone: 'orange', accent: 'royal' },
  harlem: { tone: 'brick', accent: 'apple' },
  megacity: { tone: 'carolina', accent: 'royal' },
};

/** The district's main tone. */
export const DISTRICT_TONE: Record<District, ControlTone> = {
  downtown: DISTRICT_TONES.downtown.tone,
  midtown: DISTRICT_TONES.midtown.tone,
  harlem: DISTRICT_TONES.harlem.tone,
  megacity: DISTRICT_TONES.megacity.tone,
};

/** Controls: an explicit tone wins, then the district's tone, then orange. */
export function resolveControlTone(tone?: ControlTone, district?: District): ControlTone {
  return tone ?? (district ? DISTRICT_TONE[district] : 'orange');
}

/**
 * Surfaces (Badge, Dialog, ToastCard, progress, elements): an explicit
 * `color` wins when it names a brand token or a NeonBlade preset (cyan,
 * pink, green...). Anything else, and no colour at all, falls back to the
 * district's tone. Raw CSS colours are not supported here: these components
 * style with classes, and a class table can only name the palette.
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

/**
 * Class strings for one tone, written out in full so Tailwind and Uniwind see
 * every one. Surfaces read the shade ladder (face/top/side/deep/shadow);
 * controls read face/plate and the control edge (`controlBorder`,
 * `controlKeyline`), which for brick sits one step lighter so a field edge
 * holds on night.
 */
export interface ToneClasses {
  /** Main solid face (the 500 step; brick 800). */
  face: string;
  /** Lit top edge, roofs (300-400). */
  top: string;
  /** Side wall (700-800). */
  side: string;
  /** Control depth plate behind the face. */
  plate: string;
  /** Deep recess (900). */
  deep: string;
  /** Cast shadow (950). */
  shadow: string;
  /** Lit window colour. */
  light: string;
  /** Tone-coloured text that holds AA on night. */
  text: string;
  /** Text on a surface face. */
  on: string;
  /** Text on a control face. */
  onFace: string;
  /** Surface border in the face colour. */
  border: string;
  /** Surface keyline. */
  keyline: string;
  /** Control border on a night surface. */
  controlBorder: string;
  /** Control face keyline. */
  controlKeyline: string;
  /** Lighter border on keyboard focus. */
  focusBorder: string;
  /** 15% tint for hover and selected states on night. */
  soft: string;
  /** Accent glow (boxShadow token). */
  glow: string;
  /** Accent glow on keyboard focus (web; native ignores focus: variants). */
  focusGlow: string;
}

export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  orange: {
    face: 'bg-orange-500', top: 'bg-orange-300', side: 'bg-orange-700', plate: 'bg-orange-700', deep: 'bg-orange-900',
    shadow: 'bg-orange-950', light: 'bg-orange-200', text: 'text-orange-400', on: 'text-ink-950', onFace: 'text-ink-950',
    border: 'border-orange-500', keyline: 'border-orange-950', controlBorder: 'border-orange-500', controlKeyline: 'border-orange-950',
    focusBorder: 'focus:border-orange-300', soft: 'bg-orange-500/15', glow: 'shadow-glow-orange',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-orange-500)]',
  },
  // Royal is too dark to read as text on night, so royal labels use its 300 step.
  royal: {
    face: 'bg-royal-500', top: 'bg-royal-300', side: 'bg-royal-700', plate: 'bg-royal-700', deep: 'bg-royal-900',
    shadow: 'bg-royal-950', light: 'bg-carolina-200', text: 'text-royal-300', on: 'text-ink-50', onFace: 'text-white',
    border: 'border-royal-500', keyline: 'border-royal-950', controlBorder: 'border-royal-500', controlKeyline: 'border-royal-950',
    focusBorder: 'focus:border-royal-300', soft: 'bg-royal-500/15', glow: 'shadow-glow-royal',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-royal-400)]',
  },
  carolina: {
    face: 'bg-carolina-500', top: 'bg-carolina-300', side: 'bg-carolina-700', plate: 'bg-carolina-700', deep: 'bg-carolina-900',
    shadow: 'bg-carolina-950', light: 'bg-carolina-100', text: 'text-carolina-400', on: 'text-ink-950', onFace: 'text-ink-950',
    border: 'border-carolina-500', keyline: 'border-carolina-950', controlBorder: 'border-carolina-500', controlKeyline: 'border-carolina-950',
    focusBorder: 'focus:border-carolina-300', soft: 'bg-carolina-500/15', glow: 'shadow-glow-royal',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-carolina-500)]',
  },
  leaf: {
    face: 'bg-leaf-500', top: 'bg-leaf-300', side: 'bg-leaf-700', plate: 'bg-leaf-700', deep: 'bg-leaf-900',
    shadow: 'bg-leaf-950', light: 'bg-leaf-200', text: 'text-leaf-400', on: 'text-ink-950', onFace: 'text-ink-950',
    border: 'border-leaf-500', keyline: 'border-leaf-950', controlBorder: 'border-leaf-500', controlKeyline: 'border-leaf-950',
    focusBorder: 'focus:border-leaf-300', soft: 'bg-leaf-500/15', glow: 'shadow-glow-royal',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-leaf-500)]',
  },
  apple: {
    face: 'bg-apple-500', top: 'bg-apple-300', side: 'bg-apple-700', plate: 'bg-apple-700', deep: 'bg-apple-900',
    shadow: 'bg-apple-950', light: 'bg-orange-200', text: 'text-apple-400', on: 'text-ink-50', onFace: 'text-white',
    border: 'border-apple-500', keyline: 'border-apple-950', controlBorder: 'border-apple-500', controlKeyline: 'border-apple-950',
    focusBorder: 'focus:border-apple-300', soft: 'bg-apple-500/15', glow: 'shadow-glow-orange',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-apple-500)]',
  },
  brick: {
    face: 'bg-orange-800', top: 'bg-orange-600', side: 'bg-orange-900', plate: 'bg-orange-950', deep: 'bg-orange-950',
    shadow: 'bg-ink-950', light: 'bg-orange-300', text: 'text-orange-300', on: 'text-ink-50', onFace: 'text-white',
    border: 'border-orange-800', keyline: 'border-orange-950', controlBorder: 'border-orange-700', controlKeyline: 'border-ink-950',
    focusBorder: 'focus:border-apple-400', soft: 'bg-orange-800/25', glow: 'shadow-glow-orange',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-apple-500)]',
  },
  white: {
    face: 'bg-ink-50', top: 'bg-white', side: 'bg-ink-300', plate: 'bg-ink-300', deep: 'bg-ink-600',
    shadow: 'bg-ink-900', light: 'bg-orange-200', text: 'text-ink-50', on: 'text-ink-950', onFace: 'text-ink-950',
    border: 'border-ink-50', keyline: 'border-ink-900', controlBorder: 'border-ink-50', controlKeyline: 'border-ink-900',
    focusBorder: 'focus:border-white', soft: 'bg-ink-50/15', glow: 'shadow-glow-royal',
    focusGlow: 'focus:shadow-[0_0_18px_-4px_var(--color-ink-50)]',
  },
};

/** The class table for a district, or for an explicit colour. */
export function toneClasses(district?: District, color?: NeonColorInput | Tone): ToneClasses {
  return TONE_CLASSES[resolveTone(district, color)];
}

/** One tv() slot map per control tone: `toneVariants((c) => ({ root: c.face }))`. */
export function toneVariants<S>(pick: (c: ToneClasses) => S): Record<ControlTone, S> {
  return Object.fromEntries(CONTROL_TONES.map((t) => [t, pick(TONE_CLASSES[t])])) as Record<ControlTone, S>;
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
 * `tone`). Brand tones read their palette steps, the same ones TONE_CLASSES
 * uses. Orange glows royal, the badge pairing; brick glows apple.
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
 * The tone as CornerCutFrame's `tone` input: brand tones by token name, so
 * the frame reads exact palette steps; brick as its 800-step hex.
 */
export function toneInput(tone: ControlTone): string {
  return tone === 'brick' ? palette.orange[800] : tone;
}
