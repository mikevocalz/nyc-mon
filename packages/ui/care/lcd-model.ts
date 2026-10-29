import { brand, palette } from '@acme/theme';

const { carolina, concrete, ink } = palette;

/**
 * Seven-segment numerals for the Mon Space status page (weight, age). Segment
 * order a b c d e f g: top, upper right, lower right, bottom, lower left,
 * upper left, middle.
 */
export type SegmentMask = readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

const MASKS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
  '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', ' ': '',
};

export function segmentMask(char: string): SegmentMask {
  const on = MASKS[char] ?? '';
  const lit = (s: string) => on.includes(s);
  return [lit('a'), lit('b'), lit('c'), lit('d'), lit('e'), lit('f'), lit('g')];
}

/**
 * The digits for a non-negative integer, right-aligned in `width` cells
 * (blank cells keep their unlit segments, as on a real panel). A value too
 * wide for the cells shows all 9s rather than wrapping.
 */
export function segmentDigits(value: number, width: number): readonly string[] {
  const n = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const max = 10 ** width - 1;
  const text = String(Math.min(n, max)).padStart(width, ' ');
  return [...text];
}

/** The four colours an LCD needs: ground, lit ink, the faint unlit cells, and the cell grid. */
export interface LcdColors {
  readonly ground: string;
  readonly ink: string;
  readonly unlit: string;
  readonly grid: string;
}

/**
 * Colours for the 2D LCD (`LcdPanel`), from existing primitives only.
 * Daylit is the reflective paper panel: concrete-200 ground, ink-900 cells
 * (the dark cells of a memory LCD never reach pure black). Night is the
 * backlit panel: night ground, carolina-300 lit cells. Lights out inverts the
 * daylit panel (ink ground, paper cells) and dims the night one (night
 * ground, concrete-500 cells), so the screen always reads as "lights off".
 * Contrast: ink-900 on concrete-200 13.0:1; carolina-300 on night 12.6:1;
 * concrete-200 on ink-900 13.0:1; concrete-500 on night 4.6:1.
 */
export function lcdColors(scheme: 'daylit' | 'night', inverted: boolean): LcdColors {
  if (scheme === 'daylit') {
    return inverted
      ? { ground: ink[900], ink: concrete[200], unlit: ink[700], grid: ink[950] }
      : { ground: concrete[200], ink: ink[900], unlit: concrete[300], grid: concrete[300] };
  }
  return inverted
    ? { ground: brand.night, ink: concrete[500], unlit: ink[800], grid: brand.night }
    : { ground: brand.night, ink: carolina[300], unlit: ink[800], grid: ink[900] };
}
