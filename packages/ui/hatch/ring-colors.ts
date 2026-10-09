import { brand, palette } from '@acme/theme';

/**
 * Ring colours as hex for Skia and SVG, which cannot read CSS variables. Each
 * maps to the token the handoffs name (M10 "Tokens", M11 `IncubationRing`).
 */
export const RING_COLORS = {
  /** M11 countdown track: `concrete-700` (decorative; 07-a11y.md) */
  track: palette.concrete[700],
  /** M11 countdown fill: `signage-white` */
  fill: palette.signage.white,
  /** M11 full ring, M10 elapsed arc: `orange-500` (hatch accent) */
  full: palette.orange[500],
  /** M10 unselected arc: `concrete-500` (3.61:1 daylit, 5.11:1 night) */
  unselected: palette.concrete[500],
  /** M10 selected arc: `signage-black` daylit, banner white (#F8F8F8) night */
  selected: { daylit: palette.signage.black, night: brand.white },
} as const;
