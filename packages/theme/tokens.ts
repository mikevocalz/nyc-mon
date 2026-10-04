/**
 * @acme/theme — the single token source (PROMPT-2).
 * Brand: NYC Mon. Knicks orange, royal blue, carolina blue, leaf green,
 * candy apple red, black and white, all sampled from the logo. Daylit by
 * default (canon Decision #4): the light column is the city by day (concrete
 * neutrals, MTA signage black); the dark column is night and the hatch.
 *
 * `build-css.mjs` emits theme.css (web/storybook, Tailwind v4 `@theme` with
 * light-dark()) and theme-native.css (mobile, Uniwind `@variant` theme blocks)
 * from the tokens below. TS consumers (Skia, charts,
 * programmatic color math) import these exports directly.
 * No hex values exist outside this file.
 */

// ---- primitive palettes -----------------------------------------------------
// Every 500 step is a colour sampled from packages/assets/brand/nyc-mon-logo.png
// (the anchor). Lighter steps mix toward white, darker steps toward the logo's
// blue-black keyline, so each family stays on-brand at every step.

/** Brand anchors, exactly as sampled from the logo. */
export const brand = {
  /** wordmark + outer ring */
  orange: '#FC7C00',
  /** wordmark shadow tone */
  orangeDeep: '#FC6C00',
  /** wordmark outline, buildings */
  royal: '#0058F8',
  /** sky; lifted from the sampled #0080FC so it holds AA as text on night */
  carolina: '#4BA8F0',
  /** the Big Apple */
  apple: '#F80000',
  /** apple leaf + trees, brightened from #2C7824 so it holds AA on night */
  leaf: '#3FAE3A',
  /** keyline + banner: the base background, used instead of pure black */
  night: '#00041C',
  /** banner text */
  white: '#F8F8F8',
  /** Knicks secondary — sparing neutral */
  silver: '#BEC0C2',
} as const;

const orange = {
  50: '#FFF7F0', 100: '#FFEDDB', 200: '#FED8B3', 300: '#FEBE80', 400: '#FD9D40',
  500: '#FC7C00', 600: '#D96B00', 700: '#A35100', 800: '#884300', 900: '#602F00', 950: '#3C1E00',
} as const;
const royal = {
  50: '#F0F5FF', 100: '#DBE8FE', 200: '#B3CDFD', 300: '#80ACFC', 400: '#4082FA',
  500: '#0058F8', 600: '#004CD9', 700: '#003FB6', 800: '#003193', 900: '#002470', 950: '#001851',
} as const;
const carolina = {
  50: '#F4FAFE', 100: '#E6F3FD', 200: '#C9E5FB', 300: '#A5D4F8', 400: '#78BEF4',
  500: '#4BA8F0', 600: '#4191D2', 700: '#3577B0', 800: '#295D8E', 900: '#1D426D', 950: '#122B4F',
} as const;
const leaf = {
  50: '#F3FAF3', 100: '#E4F4E3', 200: '#C5E7C4', 300: '#9FD79D', 400: '#6FC26B',
  500: '#3FAE3A', 600: '#369632', 700: '#2C7A29', 800: '#225E1F', 900: '#184216', 950: '#0F2A0E',
} as const;
const apple = {
  50: '#FFF0F0', 100: '#FEDBDB', 200: '#FDB3B3', 300: '#FC8080', 400: '#FA4040',
  500: '#F80000', 600: '#D50000', 700: '#AE0000', 800: '#860000', 900: '#5E0000', 950: '#3C0000',
} as const;
const silver = {
  50: '#FBFBFB', 100: '#F6F6F6', 200: '#ECECED', 300: '#DFE0E1', 400: '#CED0D1',
  500: '#BEC0C2', 600: '#A3A6AB', 700: '#858890', 800: '#676A76', 900: '#484B5B', 950: '#2E3144',
} as const;
/** Neutrals: banner white (#F8F8F8) down to the keyline night (#00041C). */
const ink = {
  50: '#F8F8F8', 100: '#ECECED', 200: '#D8D8DB', 300: '#B5B6BD', 400: '#90929C',
  500: '#70727F', 600: '#545767', 700: '#3C3F51', 800: '#25293D', 900: '#14182E', 950: '#00041C',
} as const;

/**
 * City neutrals: a cool, slightly blue-grey scale sampled by eye from NYC
 * sidewalk slab and curb. 50 is the daylit page. docs/DESIGN_SYSTEM.md
 * "New primitive: concrete" gives each step's role.
 */
export const concrete = {
  50: '#F3F4F4', 100: '#EBECED', 200: '#D2D4D6', 300: '#B8BBBE', 400: '#9A9EA2',
  500: '#7C8085', 600: '#61656A', 700: '#484C51', 800: '#303337', 900: '#1C1E21',
} as const;

/**
 * MTA signage black and white (1970 NYCTA Graphics Standards Manual,
 * https://standardsmanual.com/products/nyctamanual). `black` is type on daylit
 * neutrals and the H-Lynk Core's black parts; pure, not a tinted near-black.
 */
export const signage = {
  black: '#000000',
  white: '#FFFFFF',
} as const;

export const palette = {
  orange,
  royal,
  carolina,
  leaf,
  apple,
  silver,
  ink,
  concrete,
  signage,
  white: '#FFFFFF',
  // Legacy scale names. Components and stories written against the starter
  // keep working; each name now points at the NYC Mon family it played.
  burgundy: orange, // was the primary scale
  ember: royal, // was the accent scale
  gold: orange, // schedule accent
  forest: leaf, // schedule accent
  sky: carolina, // schedule accent
  rose: apple, // schedule accent
  slate: silver, // neutral
} as const;

// ---- semantic colors (light / dark) ----------------------------------------
// Emitted as `light-dark(...)` so system-following is zero-code on every platform.
// Light is daylit and the default (Decision #4): concrete neutrals, signage-black
// type, orange only as a face (`cta`). Dark is night and the hatch, unchanged:
// night base, orange hero, royal structure, carolina for secondary/info.
// Every pair is measured in contrast.ts (Law 10).

/** The semantic colour roles; every value is a `{ light, dark }` pair. */
export const semantic = {
  /** page base */
  bg: { light: concrete[50], dark: brand.night },
  surface: { light: concrete[50], dark: brand.night },
  'surface-raised': { light: palette.white, dark: '#0A1230' },
  'surface-sunken': { light: concrete[100], dark: '#000212' },
  text: { light: signage.black, dark: brand.white },
  'text-muted': { light: concrete[600], dark: brand.silver },
  'text-inverse': { light: brand.white, dark: brand.night },
  /**
   * Kept for existing screens, which draw it as text (orange-700 on daylit).
   * New screens use `cta` for the primary action face, `accent` for links and
   * `text` for emphasis.
   */
  primary: { light: orange[700], dark: brand.orange },
  'primary-pressed': { light: orange[800], dark: orange[400] },
  'on-primary': { light: palette.white, dark: brand.night },
  /** Primary call to action: brand orange is a face in both schemes (Decision #7). Never text. */
  cta: { light: orange[500], dark: brand.orange },
  'cta-pressed': { light: orange[400], dark: orange[400] },
  /** Label on `cta`. Never white: white on orange is 2.62:1. */
  'on-cta': { light: signage.black, dark: brand.night },
  // Accent = the secondary voice: royal on light, carolina on night.
  accent: { light: royal[500], dark: brand.carolina },
  'accent-pressed': { light: royal[600], dark: carolina[400] },
  'on-accent': { light: palette.white, dark: brand.night },
  // Royal blue is the structure: rules, outlines, the grid's glow.
  structure: { light: royal[500], dark: royal[500] },
  border: { light: concrete[200], dark: '#1A2E6E' },
  'border-strong': { light: royal[500], dark: royal[400] },
  focus: { light: royal[500], dark: brand.carolina },
  success: { light: leaf[700], dark: brand.leaf },
  'on-success': { light: palette.white, dark: brand.night },
  danger: { light: apple[600], dark: apple[400] },
  'on-danger': { light: palette.white, dark: brand.night },
  info: { light: carolina[800], dark: brand.carolina },
  'on-info': { light: palette.white, dark: brand.night },
  // Tone text: a district tone as text straight on the page (ghost Button and
  // IconButton labels, the CardSlider counter). Dark keeps the night steps the
  // tone table always used. The bright steps fail on concrete (orange-400 is
  // 1.89:1), so light takes the darkest step that still reads as the tone and
  // holds 4.5:1 on page, raised and sunken, including under the ghost's 15%
  // hover tint (25% for brick). Measured in contrast.ts.
  'tone-orange-text': { light: orange[800], dark: orange[400] },
  'tone-royal-text': { light: royal[600], dark: royal[300] },
  'tone-carolina-text': { light: carolina[800], dark: carolina[400] },
  'tone-leaf-text': { light: leaf[800], dark: leaf[400] },
  'tone-apple-text': { light: apple[700], dark: apple[400] },
  /** Brick is Harlem's deep orange, so its light step sits one below orange's. */
  'tone-brick-text': { light: orange[900], dark: orange[300] },
  // Glow colours (8-digit hex, alpha baked in) for neon shadows. No glow in
  // daylight: the light value is fully transparent (alpha 00).
  glow: { light: '#0058F800', dark: '#0058F8A6' },
  'glow-hot': { light: '#FC7C0000', dark: '#FC7C0080' },
} as const;

/**
 * The scanner LED (Decision #7). It always sits in the H-Lynk's black scanner
 * head (Decision #16), so it needs no per-scheme well.
 * @see hlynk
 */
export const led = {
  /** lit lens and emitters; on `signage-black` only */
  on: apple[500],
  /** unlit lens; decorative */
  off: apple[900],
} as const;

/**
 * H-Lynk chrome, per tier (Decision #16). The body is plastic, so these do not
 * change between daylit and night; only the page behind the device and the
 * scene inside its screen follow the scheme. Consumed by the H-Lynk kit
 * components only. `standard` and `pro` are added, and measured, when those
 * tiers ship. docs/design/hlynk/DIRECTION.md maps each value to its part.
 */
export const hlynk = {
  /** H-Lynk Core (Entry tier): matte red body, black head and controls. */
  core: {
    /** matte red body: the darkest kit red where black controls hold 3:1 */
    body: apple[600],
    /** scanner head, antenna, bezel, key faces, trackpad face */
    black: signage.black,
    /** trackpad ring, inset 4 pt on the black face */
    ring: apple[500],
    /** key glyphs */
    glyph: silver[300],
    /** pressed key glyph */
    glyphPressed: signage.white,
    /** disabled key glyph (exempt: inactive control) */
    glyphDisabled: concrete[700],
    /** any text printed on the body; white is the only ink allowed there */
    ink: signage.white,
    /** trackpad rim during the hatch only */
    hatchRim: orange[500],
  },
} as const;

/**
 * Neon tokens for canvas renderers (Skia grid floor, glyph city) — they can't
 * read CSS variables. NeonBlade's Grid Floor look in the NYC Mon palette.
 */
export const neon = {
  bg: brand.night,
  line: brand.orange,
  glow: brand.royal,
  glowSoft: brand.carolina,
  hot: brand.apple,
  leaf: brand.leaf,
  white: brand.white,
} as const;

// ---- typography -------------------------------------------------------------

export const fontFamilies = {
  // Archivo Black for the jersey-weight headlines; Space Grotesk does the work.
  display: "'Archivo Black', 'Arial Black', sans-serif",
  sans: "'Space Grotesk', system-ui, -apple-system, sans-serif",
} as const;

/** Display scale for hero/masthead moments; body text uses the Tailwind defaults. */
export const typeScale = {
  'display-2xl': { size: '4.5rem', lineHeight: '1.05', tracking: '-0.02em' },
  'display-xl': { size: '3.75rem', lineHeight: '1.05', tracking: '-0.02em' },
  'display-lg': { size: '3rem', lineHeight: '1.1', tracking: '-0.01em' },
  'display-md': { size: '2.25rem', lineHeight: '1.15', tracking: '-0.01em' },
  'display-sm': { size: '1.875rem', lineHeight: '1.2', tracking: '0' },
} as const;

/**
 * Mobile type ramp (docs/DESIGN_SYSTEM.md "Type"). Sizes and line heights are
 * points at the default Dynamic Type size; the OS scales them up to XXL.
 * Sentence case everywhere. `station` is the one display use per screen; the
 * `display-*` steps in {@linkcode typeScale} stay for the website.
 * Emitted to CSS as `--text-type-<name>` (utility `text-type-<name>`).
 */
export const typeRamp = {
  /** one line per screen at most: the screen's name, a Mon's name at the hatch */
  'type-station': { family: 'display', sizePt: 34, lineHeightPt: 38, weight: 400 },
  /** the screen's question */
  'type-title': { family: 'sans', sizePt: 24, lineHeightPt: 30, weight: 700 },
  /** default body copy */
  'type-body': { family: 'sans', sizePt: 17, lineHeightPt: 24, weight: 400 },
  /** inline emphasis and values */
  'type-body-strong': { family: 'sans', sizePt: 17, lineHeightPt: 24, weight: 600 },
  /** buttons, field labels, keys */
  'type-label': { family: 'sans', sizePt: 15, lineHeightPt: 20, weight: 500 },
  /** legal links and hints; nothing is set smaller */
  'type-caption': { family: 'sans', sizePt: 13, lineHeightPt: 18, weight: 400 },
} as const satisfies Record<string, TypeStep>;

/** One step of {@linkcode typeRamp}. */
export interface TypeStep {
  /** key of {@linkcode fontFamilies} */
  family: keyof typeof fontFamilies;
  sizePt: number;
  lineHeightPt: number;
  /** CSS font weight; Archivo Black has only 400 */
  weight: 400 | 500 | 600 | 700;
}

// ---- layout -----------------------------------------------------------------

/**
 * Spacing on a 4 pt base (docs/DESIGN_SYSTEM.md "Space and layout"). These are
 * the only steps a screen names; Tailwind's `--spacing` (0.25rem) already
 * produces them as `p-1`, `p-2`, `p-3`, `p-4`, `p-6`, `p-8`, `p-12`.
 */
export const space = {
  1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48,
} as const;

/** Screen layout constants in points (dp on Android). */
export const layout = {
  /** screen side gutter below the `md` breakpoint */
  gutterPt: 16,
  /** screen side gutter from `md` up */
  gutterMdPt: 24,
  /** gap between the primary action and the safe bottom inset */
  actionInsetPt: 16,
  /** minimum touch target, Apple HIG */
  minTargetIosPt: 44,
  /** minimum touch target, Material */
  minTargetAndroidDp: 48,
} as const;

/** §8.2 content-width scale — width scales by adding columns, not stretching. */
export const contentWidths = {
  'content-form': '28rem',
  'content-feed': '38rem',
  'content-prose': '65ch',
  'content-detail': '48rem',
  'content-screen': '56rem',  // Tailwind 4xl — the default screen cap
  'content-wide': '72rem',
  'screen-2xl': '96rem',  // outer cap for every screen (user rule)

  // Adaptive split-view panes. Leading panes are fixed-width and the detail
  // pane flexes, so these are the only widths the split layout ever names —
  // emitted as --container-*, which Tailwind maps to w-*/min-w-*/max-w-*.
  'pane-primary': '20rem',
  'pane-primary-narrow': '16rem',
  'pane-supplementary': '21rem',
  'pane-inspector': '20rem',
} as const;

/**
 * Corners. NYC-MON is square: every step of the Tailwind radius scale is 0, so
 * `rounded-md`, `rounded-card` and friends draw square corners, and the neon
 * shapes (corner cuts, cornices) carry the silhouette. Rounding is opt-in:
 * components take a `rounded` prop that applies `rounded-soft`. `full` stays
 * a circle for the few things that are round on purpose (status dots, loader
 * pills, the donut).
 */
export const radius = {
  xs: '0px',
  sm: '0px',
  md: '0px',
  lg: '0px',
  xl: '0px',
  '2xl': '0px',
  '3xl': '0px',
  '4xl': '0px',
  card: '0px',
  sheet: '0px',
  /** The opt-in rounding behind every component's `rounded` prop. */
  soft: '0.625rem',
  full: '9999px',
} as const;

// Neon elevation (NeonBlade): a soft royal-blue glow instead of a grey drop.
// `glow-*` are the hero glows for focused or featured surfaces.
export const shadows = {
  card: '0 0 22px -8px var(--color-glow)',
  raised: '0 0 32px -8px var(--color-glow)',
  overlay: '0 0 48px -6px var(--color-glow)',
  'glow-orange': '0 0 28px -4px var(--color-glow-hot)',
  'glow-royal': '0 0 28px -4px var(--color-glow)',
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 30,
  nav: 50,
  overlay: 70,
  modal: 80,
  toast: 90,
} as const;

// ---- motion -----------------------------------------------------------------

export const motion = {
  duration: {
    fast: '120ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

/** An easing in {@linkcode motion.easing}. */
export type MotionEasing = keyof typeof motion.easing;

/**
 * One authored animation, full or reduced. A discriminated union, so a reduced
 * sibling is a design (`fade`, `color`, `steady`), not "duration 0".
 * @see motionTokens
 */
export type MotionStep =
  /** A one-shot transition. Transform fields are omitted when the step does not move. */
  | {
      kind: 'tween';
      durationMs: number;
      easing: MotionEasing;
      /** opacity is animated */
      fade: boolean;
      /** colour is animated (the reduced press feedback) */
      color: boolean;
      /** scale at the pressed or starting end, e.g. 0.97 */
      scale?: number;
      /** vertical travel in points; positive rises into place */
      risePt?: number;
      /** horizontal travel in points */
      slidePt?: number;
    }
  /** A looping opacity breath. */
  | { kind: 'breathe'; periodMs: number; minOpacity: number; maxOpacity: number }
  /** A burst of blinks, repeated every `intervalMs`. Under 3 flashes per second (WCAG 2.3.1). */
  | { kind: 'blink'; count: number; onMs: number; offMs: number; intervalMs: number }
  /** Held light with a static shape cue standing in for the rhythm. */
  | { kind: 'steady'; cue: 'progress-ticks' | 'filled-dot' | 'exclamation-dot' }
  /** The end state is applied in one frame. */
  | { kind: 'instant' }
  /** The animation is not drawn at all (decorative motion only). */
  | { kind: 'absent' };

/** A motion token: the full animation and its authored reduced-motion sibling. */
export interface MotionToken {
  full: MotionStep;
  reduced: MotionStep;
}

/**
 * Named motion (docs/DESIGN_SYSTEM.md "Motion", docs/design/hlynk/DIRECTION.md).
 * Every token carries its reduced-motion sibling (§0A.2). Durations reuse
 * {@linkcode motion.duration} except the LED ramp, breath and blinks.
 */
export const motionTokens = {
  /** press feedback */
  'motion-tap': {
    full: { kind: 'tween', durationMs: 120, easing: 'standard', fade: false, color: false, scale: 0.97 },
    reduced: { kind: 'tween', durationMs: 120, easing: 'standard', fade: false, color: true },
  },
  /** carousel and focus steps */
  'motion-step': {
    full: { kind: 'tween', durationMs: 200, easing: 'standard', fade: false, color: false, slidePt: 24 },
    reduced: { kind: 'tween', durationMs: 120, easing: 'standard', fade: true, color: false },
  },
  /** content entering */
  'motion-enter': {
    full: { kind: 'tween', durationMs: 300, easing: 'emphasized', fade: true, color: false, risePt: 8 },
    reduced: { kind: 'tween', durationMs: 200, easing: 'emphasized', fade: true, color: false },
  },
  /** daylit to night and back: a token cross-fade */
  'motion-scheme': {
    full: { kind: 'tween', durationMs: 500, easing: 'standard', fade: true, color: true },
    reduced: { kind: 'instant' },
  },
  /** M01 boot: LED ramp and screen fade-up */
  'motion-power-on': {
    full: { kind: 'tween', durationMs: 240, easing: 'standard', fade: true, color: false, scale: 0.98 },
    reduced: { kind: 'instant' },
  },
  /** LED while `incubating` */
  'motion-led-breath': {
    full: { kind: 'breathe', periodMs: 4000, minOpacity: 0.35, maxOpacity: 1 },
    reduced: { kind: 'steady', cue: 'progress-ticks' },
  },
  /** one upward scanner fan sweep at M01 boot; decorative */
  'motion-scan-fan': {
    full: { kind: 'tween', durationMs: 400, easing: 'emphasized', fade: true, color: false },
    reduced: { kind: 'absent' },
  },
  /** LED `ready`: two blinks, then steady, every 6 s */
  'motion-led-blink-ready': {
    full: { kind: 'blink', count: 2, onMs: 150, offMs: 150, intervalMs: 6000 },
    reduced: { kind: 'steady', cue: 'filled-dot' },
  },
  /** LED `needsYou`: three blinks every 10 s */
  'motion-led-blink-needs-you': {
    full: { kind: 'blink', count: 3, onMs: 150, offMs: 150, intervalMs: 10000 },
    reduced: { kind: 'steady', cue: 'exclamation-dot' },
  },
} as const satisfies Record<string, MotionToken>;

export type MotionTokenName = keyof typeof motionTokens;

export const breakpoints = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
} as const;

export type Palette = typeof palette;
export type SemanticColor = keyof typeof semantic;
export type TypeRampStep = keyof typeof typeRamp;
export type ContentWidth = keyof typeof contentWidths;
