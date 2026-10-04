import type { NeonColorInput } from '../neon/colors';
import type { SolidBackgroundBaseProps } from './QuadBackground.shared';
import type { SkylineDistrict } from './skyline-model';

/** NeonBlade's Glyph City variants, mapped onto districts. */
export type GlyphCityVariant = 'downtown' | 'megacity' | 'district' | 'ruins';

/**
 * The NYC-MON hero skyline: solid filled buildings per district with lit
 * windows, stepped sky, blinking beacons and street and sky traffic.
 *
 * The port of NeonBlade UI's Glyph City (MIT, see THIRD-PARTY-NOTICES.md),
 * redrawn from glyph wireframes into solid districts. It keeps Glyph City's
 * prop names: `variant`, `colorPrimary`, `colorSecondary`, `colorTertiary`,
 * `bgColor`, `speed`, `showVehicles`, `blinkingLights` and `opacity`.
 */
export interface CitySkylineProps extends SolidBackgroundBaseProps {
  /**
   * downtown: FiDi supertalls, setbacks, a One-WTC taper and spires.
   * midtown: Empire-State and Chrysler crowns, Deco setbacks, water towers.
   * harlem: brownstone rows with stoops, project slabs in a park, towers behind.
   * megacity: stacked megastructures with sky bridges and flying traffic.
   * all: a panorama, Harlem to Downtown, with Mega City looming behind. Default.
   */
  district?: SkylineDistrict;
  /** NeonBlade name. downtown and megacity map to those districts, district to midtown, ruins to harlem. `district` wins. */
  variant?: GlyphCityVariant;
  /** Layout seed: same seed, same skyline. Default 1. */
  seed?: number;
  /** Skyline depth layers, 1 to 3. Default 3 on wide screens. */
  depth?: number;
  /** NeonBlade name: window light colour. Default per district. */
  colorPrimary?: NeonColorInput;
  /** NeonBlade name: vehicle light colour. Default carolina. */
  colorSecondary?: NeonColorInput;
  /** NeonBlade name: beacon colour on spires and masts. Default per district. */
  colorTertiary?: NeonColorInput;
  /** NeonBlade name: sky colour at the top. Default per district. */
  bgColor?: string;
  /** Starter alias for bgColor; bgColor wins. */
  backgroundColor?: string;
  /** Vehicle speed multiplier. Default 1. */
  speed?: number;
  /** NeonBlade name: traffic on the street and, in Mega City, in the sky. Default true. */
  showVehicles?: boolean;
  /** NeonBlade name: beacons blink. Default true. */
  blinkingLights?: boolean;
  /** Lit windows. Default true. */
  windowLights?: boolean;
  /** 0 to 1, or NeonBlade's 0 to 100. Default 1. */
  opacity?: number;
}

/** NeonBlade's prop type name. */
export type GlyphCityProps = CitySkylineProps;
