// Typed registry over the committed sky-bank JSONs. Each JSON was generated
// by scripts/decode-hdr.mjs and carries the measured lighting data the L1
// "one light" rig consumes: unit sun direction, sun irradiance, a 9-term
// cosine-lobe-integrated SH of the sky irradiance, the measured horizon
// radiance, and the source HDR URL. See README.md in this directory for how
// the assets were verified and why float-texture upload on react-native-webgpu
// is still pending a device check.
//
// The `with { type: 'json' }` attributes keep `node --test` happy (plain JSON
// imports are rejected under type stripping). Metro/babel parses attributes
// fine; hermesc compatibility is part of the device check.

import qwantani_morning_puresky from './qwantani_morning_puresky.json' with { type: 'json' };
import qwantani_moonrise_puresky from './qwantani_moonrise_puresky.json' with { type: 'json' };
import qwantani_sunset_puresky from './qwantani_sunset_puresky.json' with { type: 'json' };

/** The slice of a sky JSON the renderer actually reads. */
export interface SkyLighting {
  id: string;
  kind: string;
  /** Unit-length y-up direction toward the sun/moon disc. */
  sunDirection: readonly number[];
  sunElevationDeg: number;
  /** Angular radius of the measured bright-cluster disc, degrees. */
  sunClusterSpreadDeg: number;
  /** Linear RGB irradiance arriving from the sun direction. */
  sunIrradiance: readonly number[];
  /** Linear RGB peak radiance measured inside the disc. */
  sunPeakRadiance: readonly number[];
  /**
   * 9 RGB SH coefficients of sky irradiance with the cosine lobe already
   * folded in (shConvention.cosineLobe.foldedIn). Reconstruct per the JSON's
   * own formula: E(n) = Σ coeff[i] · shConstant_i · basis_i(n).
   */
  skyIrradianceSH: readonly (readonly number[])[];
  /** Measured linear RGB horizon radiance. Feeds fog + dome haze. */
  horizonColor: readonly number[];
  shConvention: {
    basisOrder: readonly string[];
    shConstants: {
      c0: number;
      c1: number;
      c2: number;
      c3: number;
      c4: number;
    };
    cosineLobe: { foldedIn: boolean };
    reconstruct: string;
  };
  source: {
    fileUrl: string;
  };
}

/** Time-of-day picks — the README's verified recommendation trio. */
export type SkyName = 'morning' | 'dusk' | 'night';

/**
 * README-recommended trio. `dusk` deliberately maps to the sunset pick and
 * `night` to the moonrise pick: those are the verified assets with compact
 * real light discs (sunClusterSpreadDeg < 0.3°), unlike the plainer
 * dusk/night alternates in the bank.
 */
export const SKY_PRESETS: Record<SkyName, SkyLighting> = {
  morning: qwantani_morning_puresky,
  dusk: qwantani_sunset_puresky,
  night: qwantani_moonrise_puresky,
};
