import { brand, palette } from '@acme/theme';

/**
 * Care ring colours as hex for Skia and SVG. The ring sits on `scrim-scene`
 * (M13 token diffs). Fill is `accent` (royal-500 by day, carolina after dark,
 * where royal on the night scrim is 2.15:1); the
 * track is `concrete-200` by day and `#1A2E6E` (`border`, night) after dark;
 * the low notch is `text`.
 */
export const CARE_COLORS = {
  fill: { daylit: palette.royal[500], night: brand.carolina },
  track: { daylit: palette.concrete[200], night: '#1A2E6E' },
  notch: { daylit: palette.signage.black, night: brand.white },
} as const;
