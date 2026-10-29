/**
 * The Memory LCD's 2D layer as data (M32 Mon Space, contract section 5).
 *
 * Lane (c) builds an `LcdLayerSpec` from the store; `MemoryLcd` rasterises it
 * into one RGBA texel per LCD cell (lcd-raster.ts) and the TSL material draws
 * the cells. The screen passes data, never views, so the same spec renders on
 * web and native and node tests can check the pixels.
 *
 * Pure TypeScript: no React, no three.js.
 */

/** The nine icons on the bar, in the fixed order of 03-direction.md (H4: same place every visit). */
export const LCD_ICON_IDS = [
  'feed',
  'snack',
  'play',
  'lights',
  'clean',
  'medicine',
  'discipline',
  'status',
  'pause',
] as const;
export type LcdIconId = (typeof LCD_ICON_IDS)[number];

/** A 0..4 count: hearts in a row, poop piles, discipline quarters. */
export type LcdQuarter = 0 | 1 | 2 | 3 | 4;

/** The icon bar along the bottom of the LCD. */
export interface LcdIconBarSpec {
  /**
   * Index into {@linkcode LCD_ICON_IDS} of the focused icon, drawn inverted.
   * `null` draws no focus (the status page is open, or the screen is paused
   * and nothing can be chosen).
   */
  readonly focus: number | null;
  /** Icons drawn in dim ink: disabled, with the reason given by the screen's status line. */
  readonly disabled?: readonly LcdIconId[];
}

/** The three canon meters as 0..4 hearts (`heartsFor()`, D20a). Lit = filled glyph, unlit = outline. */
export interface LcdHeartsSpec {
  readonly fullness: LcdQuarter;
  readonly social: LcdQuarter;
  readonly energy: LcdQuarter;
}

/** Row labels for the hearts, from the screen's copy (05-copy.md). */
export interface LcdHeartLabels {
  readonly fullness: string;
  readonly social: string;
  readonly energy: string;
}

/**
 * A seven-segment number. Two passes: every segment at the dim ink, then the
 * lit segments at full ink (vpet directions 3.3). The same value is always in
 * the screen's accessible text.
 */
export interface LcdNumeralSpec {
  /** Non-negative integer; clamped to what `digits` can show. */
  readonly value: number;
  /** Digit cells drawn, 1..4. Leading cells show only their dim segments. */
  readonly digits: 1 | 2 | 3 | 4;
}

/** The status page (icon 8): hearts, boundaries, weight, age, stage. */
export interface LcdStatusPageSpec {
  /** Label then four segments, e.g. "Boundaries". */
  readonly disciplineLabel: string;
  readonly discipline: LcdQuarter;
  /** Label printed before the weight numerals, e.g. "Weight". */
  readonly weightLabel: string;
  readonly weight: LcdNumeralSpec;
  /** Label printed before the age numerals, e.g. "Age". */
  readonly ageLabel: string;
  /** Unpaused days in this life. */
  readonly age: LcdNumeralSpec;
  /** The stage word, e.g. "Baby". */
  readonly stage: string;
}

/**
 * One text run. Drawn in a 5 x 7 bitmap face at 2 cells per font pixel, so
 * every stroke is at least 2 LCD cells wide. Text never ghosts and never
 * blooms. Lines longer than the LCD wrap at word boundaries, up to
 * `maxLines`; the rest is cut. Characters outside printable ASCII draw as "?".
 */
export interface LcdTextLine {
  readonly text: string;
  /** Default 2. */
  readonly maxLines?: 1 | 2 | 3;
}

/** Everything the LCD draws besides the Mon sprite and the lamp. */
export interface LcdLayerSpec {
  /** `main`: hearts, the Mon, piles, call, status line, icon bar. `status`: the status page over the same bar. */
  readonly page: 'main' | 'status';
  readonly hearts: LcdHeartsSpec;
  readonly heartLabels: LcdHeartLabels;
  /** Poop piles, bottom-right of the Mon's area. */
  readonly poop: LcdQuarter;
  /** The call "!" beside the Mon while a call (real or false) is open. */
  readonly call: boolean;
  /** The cold glyph, top-left of the Mon's area, while a cold is unresolved. */
  readonly cold: boolean;
  readonly iconBar: LcdIconBarSpec;
  /** The one-sentence status line above the bar (the polite live region's text). */
  readonly statusLine: LcdTextLine | null;
  /** The focused icon's full label, under the bar. */
  readonly caption: LcdTextLine | null;
  /** Required when `page` is `status`; ignored on `main`. */
  readonly statusPage: LcdStatusPageSpec | null;
}

/** Hearts, piles and quarters are 0..4; anything else is clamped and rounded. */
export function toQuarter(n: number): LcdQuarter {
  const v = Math.max(0, Math.min(4, Math.round(Number.isFinite(n) ? n : 0)));
  return v as LcdQuarter;
}

/** A blank main page: no hearts lit, nothing open. Stories and tests start here. */
export function emptyLcdLayer(labels: LcdHeartLabels): LcdLayerSpec {
  return {
    page: 'main',
    hearts: { fullness: 0, social: 0, energy: 0 },
    heartLabels: labels,
    poop: 0,
    call: false,
    cold: false,
    iconBar: { focus: 0 },
    statusLine: null,
    caption: null,
    statusPage: null,
  };
}
