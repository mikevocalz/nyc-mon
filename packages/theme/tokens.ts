/**
 * @acme/theme — the single token source (PROMPT-2).
 * Brand: NYC Mon. Knicks orange, royal blue, carolina blue, leaf green,
 * candy apple red, black and white, all sampled from the logo. Dark-first.
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

export const palette = {
  orange,
  royal,
  carolina,
  leaf,
  apple,
  silver,
  ink,
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
// Dark is the brand's home: night base, orange hero, royal structure, carolina
// for secondary/info. Light mode keeps the same roles with deeper tones so every
// text pair still clears WCAG AA (ratios: `node contrast.mjs`).

export const semantic = {
  /** page base */
  bg: { light: ink[50], dark: brand.night },
  surface: { light: ink[50], dark: brand.night },
  'surface-raised': { light: palette.white, dark: '#0A1230' },
  'surface-sunken': { light: ink[100], dark: '#000212' },
  text: { light: brand.night, dark: brand.white },
  'text-muted': { light: ink[600], dark: brand.silver },
  'text-inverse': { light: brand.white, dark: brand.night },
  // Orange is the hero. Light mode needs the deep step to read as text on white.
  primary: { light: orange[700], dark: brand.orange },
  'primary-pressed': { light: orange[800], dark: orange[400] },
  'on-primary': { light: palette.white, dark: brand.night },
  // Accent = the secondary voice: royal on light, carolina on night.
  accent: { light: royal[500], dark: brand.carolina },
  'accent-pressed': { light: royal[600], dark: carolina[400] },
  'on-accent': { light: palette.white, dark: brand.night },
  // Royal blue is the structure: rules, outlines, the grid's glow.
  structure: { light: royal[500], dark: royal[500] },
  border: { light: ink[200], dark: '#1A2E6E' },
  'border-strong': { light: royal[500], dark: royal[400] },
  focus: { light: royal[500], dark: brand.carolina },
  success: { light: leaf[700], dark: brand.leaf },
  'on-success': { light: palette.white, dark: brand.night },
  danger: { light: apple[600], dark: apple[400] },
  'on-danger': { light: palette.white, dark: brand.night },
  info: { light: carolina[800], dark: brand.carolina },
  'on-info': { light: palette.white, dark: brand.night },
  // Glow colours (8-digit hex, alpha baked in) for neon shadows.
  glow: { light: '#0058F833', dark: '#0058F8A6' },
  'glow-hot': { light: '#FC7C0033', dark: '#FC7C0080' },
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

// ---- layout -----------------------------------------------------------------

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

export const breakpoints = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
} as const;

export type Palette = typeof palette;
export type SemanticColor = keyof typeof semantic;
export type ContentWidth = keyof typeof contentWidths;
