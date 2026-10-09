/**
 * Type for M08 and M10 in absolute px on every platform. The mobile ramp
 * (`text-type-*`) on phones and tablets; the XR ramp (`text-xr-*`, caption
 * 14, label 16, body 18, title 26) inside a headset's 2D window, read at arm's
 * length (docs/spatial/HORIZON-LAYOUT.md lesson 6). Never `text-xs/sm/base`:
 * Uniwind's `rem: 14` polyfill (apps/mobile/metro.config.js) renders those
 * at 10.5 / 12.25 / 14 dp on native. Pure, so tests can import it.
 */

export interface TextRamp {
  readonly title: string;
  readonly body: string;
  readonly strong: string;
  readonly label: string;
}

const MOBILE: TextRamp = {
  title: 'text-type-title',
  body: 'text-type-body',
  strong: 'text-type-body-strong',
  label: 'text-type-label',
};

const XR: TextRamp = {
  title: 'text-xr-title',
  body: 'text-xr-body',
  strong: 'text-xr-body font-semibold',
  label: 'text-xr-label',
};

/** Picks the ramp for the device. */
export function textRamp(headset: boolean): TextRamp {
  return headset ? XR : MOBILE;
}
