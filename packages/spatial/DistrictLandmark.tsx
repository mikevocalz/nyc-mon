'use client';

import type { District } from '@acme/ui';
import { Blocks, type BlockSpec } from './districtBlock';

/**
 * The landmark that closes the avenue: one per district, standing on the
 * vanishing point so the street has somewhere to lead the eye. Solid boxes in
 * the palette, built once at module load.
 *
 * Sizes are tuned for the flat preview's camera (eye height, about 27 degrees
 * either side of the horizon): at LANDMARK_Z the top of the frame is roughly
 * 35 m above the street, so each spire tip stays in view.
 */
export const LANDMARK_Z = -66;

/** Downtown: a One-WTC-style taper. Square podium, a chamfered shaft that narrows, a spire. */
function downtown(): BlockSpec[] {
  const out: BlockSpec[] = [{ p: [0, 0, 0], s: [9, 5, 9], m: 'landmarkGlassDeep' }];
  // Each tier is a square plus a 45-degree square, which reads as the octagonal
  // chamfer of the real tower, and both narrow on the way up.
  let y = 5;
  const steps = 7;
  for (let i = 0; i < steps; i += 1) {
    const w = 7.2 - i * 0.6;
    const h = 3;
    out.push({ p: [0, y, 0], s: [w, h, w], m: 'landmarkGlass' });
    out.push({ p: [0, y, 0], s: [w * 0.82, h, w * 0.82], m: 'landmarkGlassDeep', ry: 45 });
    y += h;
  }
  // Lit parapet, then the mast.
  out.push({ p: [0, y, 0], s: [3.4, 0.5, 3.4], m: 'landmarkSpire' });
  out.push({ p: [0, y + 0.5, 0], s: [0.9, 1.2, 0.9], m: 'landmarkGlassDeep' });
  out.push({ p: [0, y + 1.7, 0], s: [0.25, 5.5, 0.25], m: 'landmarkSpire' });
  out.push({ p: [0, y + 7.2, 0], s: [0.45, 0.45, 0.45], m: 'landmarkSign' });
  return out;
}

/** Midtown: a Deco tower with Empire-style setbacks and a stepped, lit Chrysler-style crown. */
function midtown(): BlockSpec[] {
  const out: BlockSpec[] = [
    { p: [0, 0, 0], s: [12, 5, 12], m: 'landmarkStoneDeep' },
    { p: [0, 5, 0], s: [8.5, 11, 8.5], m: 'landmarkStone' },
  ];
  let y = 16;
  // Setbacks, each topped by a lit band.
  for (const [w, h] of [
    [7, 4],
    [5.4, 3],
    [4, 2.4],
  ] as const) {
    out.push({ p: [0, y, 0], s: [w, h, w], m: 'landmarkStone' });
    out.push({ p: [0, y + h - 0.35, 0], s: [w + 0.1, 0.35, w + 0.1], m: 'landmarkBand' });
    y += h;
  }
  // The crown: diamond-set steps that alternate stone and light.
  for (const [w, h, m] of [
    [3, 1, 'landmarkBand'],
    [2.4, 0.9, 'landmarkStoneDeep'],
    [1.9, 0.9, 'landmarkBand'],
    [1.4, 0.8, 'landmarkStoneDeep'],
    [0.9, 0.8, 'landmarkBand'],
  ] as const) {
    out.push({ p: [0, y, 0], s: [w, h, w], m, ry: 45 });
    y += h;
  }
  out.push({ p: [0, y, 0], s: [0.18, 4.5, 0.18], m: 'landmarkSpire' });
  return out;
}

/** Harlem: a theatre between brownstones, with a lit marquee band and a tall vertical sign. */
function harlem(): BlockSpec[] {
  const out: BlockSpec[] = [];
  // Brownstones either side, with stoops and cornices.
  for (const side of [-1, 1]) {
    for (const [i, h] of [
      [0, 9],
      [1, 10],
      [2, 8.5],
    ] as const) {
      const x = side * (8.6 + i * 4.4);
      out.push({ p: [x, 0, 0], s: [4.2, h, 6], m: i % 2 ? 'landmarkBrick' : 'landmarkBrownstone' });
      out.push({ p: [x, h, 0.2], s: [4.4, 0.5, 6.4], m: 'landmarkStoneDeep' });
      out.push({ p: [x, 0, 3.4], s: [1.6, 1.4, 1.2], m: 'landmarkStoneDeep' });
      for (const fy of [3.6, 6.4]) {
        out.push({ p: [x - 1, fy, 3.02], s: [0.8, 1.3, 0.05], m: 'landmarkMarquee' });
        out.push({ p: [x + 1, fy, 3.02], s: [0.8, 1.3, 0.05], m: 'landmarkMarquee' });
      }
    }
  }
  // The theatre façade.
  out.push({ p: [0, 0, 0], s: [13, 14, 6], m: 'landmarkBrick' });
  out.push({ p: [0, 14, 0.2], s: [13.4, 0.7, 6.4], m: 'landmarkStoneDeep' });
  // Upper-floor windows.
  for (const fx of [-4.5, -1.5, 1.5, 4.5]) {
    out.push({ p: [fx, 9.6, 3.02], s: [1.4, 2, 0.05], m: 'landmarkMarquee' });
  }
  // Dark entry and the marquee band over it, lit on every face.
  out.push({ p: [0, 0, 3.02], s: [8, 3.4, 0.05], m: 'landmarkStoneDeep' });
  out.push({ p: [0, 3.6, 4.2], s: [11, 1.8, 2.4], m: 'landmarkMarquee' });
  out.push({ p: [0, 3.6, 5.42], s: [10.4, 0.25, 0.05], m: 'landmarkSign' });
  out.push({ p: [0, 5.15, 5.42], s: [10.4, 0.25, 0.05], m: 'landmarkSign' });
  // Vertical blade sign: red, lined with bulbs, rising above the roof.
  out.push({ p: [0, 5.4, 4.6], s: [1.6, 13.6, 1], m: 'landmarkSign' });
  for (let i = 0; i < 9; i += 1) {
    out.push({ p: [0, 6.6 + i * 1.35, 5.12], s: [0.7, 0.7, 0.05], m: 'landmarkBulb' });
  }
  out.push({ p: [0, 19, 4.6], s: [2.2, 0.5, 1.2], m: 'landmarkBand' });
  return out;
}

/**
 * Mega City: a gate over the avenue. Two pylons stand in the avenue's own
 * width so the street rows can't hide them, stacked sky-bridges join them, and
 * a wider crown deck carries the whole thing past the frame.
 */
function megacity(): BlockSpec[] {
  const out: BlockSpec[] = [];
  for (const side of [-1, 1]) {
    const x = side * 6;
    out.push({ p: [x, 0, 0], s: [4, 28, 6], m: 'landmarkMega' });
    out.push({ p: [x, 0, 0], s: [5, 3, 7], m: 'landmarkMegaDeep' });
    // Lit seams on the inner face and the street face.
    out.push({ p: [x - side * 2.02, 3, 0], s: [0.05, 24, 1.4], m: 'landmarkSkyLight' });
    out.push({ p: [x, 3, 3.02], s: [1, 24, 0.05], m: 'landmarkSkyLight' });
  }
  // Sky-bridges between the pylons, each lit underneath and along its face.
  for (const [y, h, d] of [
    [8, 1.6, 4],
    [14.5, 2.2, 5],
  ] as const) {
    out.push({ p: [0, y, 0], s: [8, h, d], m: 'landmarkMegaDeep' });
    out.push({ p: [0, y - 0.25, 0], s: [8, 0.25, d * 0.6], m: 'landmarkSkyLight' });
    out.push({ p: [0, y + h * 0.4, d / 2 + 0.02], s: [7.6, 0.3, 0.05], m: 'landmarkBand' });
  }
  // Crown deck, wider than the avenue, then a mast on the centre line.
  out.push({ p: [0, 21, 0], s: [22, 3.4, 7], m: 'landmarkMegaDeep' });
  out.push({ p: [0, 20.75, 0], s: [22, 0.25, 4], m: 'landmarkSkyLight' });
  out.push({ p: [0, 22.3, 3.52], s: [21, 0.4, 0.05], m: 'landmarkBand' });
  out.push({ p: [0, 24.4, 0], s: [9, 2.4, 5], m: 'landmarkMega' });
  out.push({ p: [0, 26.8, 0], s: [3, 1.6, 3], m: 'landmarkMegaDeep' });
  out.push({ p: [0, 28.4, 0], s: [0.3, 4.5, 0.3], m: 'landmarkSkyLight' });
  out.push({ p: [0, 32.9, 0], s: [0.5, 0.5, 0.5], m: 'landmarkBand' });
  return out;
}

/** Uniform scale about the landmark's base centre. */
const scaled = (list: BlockSpec[], k: number): BlockSpec[] =>
  list.map((b) => ({ ...b, p: [b.p[0] * k, b.p[1] * k, b.p[2] * k], s: [b.s[0] * k, b.s[1] * k, b.s[2] * k] }));

const atAvenueEnd = (list: BlockSpec[]): BlockSpec[] =>
  list.map((b) => ({ ...b, p: [b.p[0], b.p[1], b.p[2] + LANDMARK_Z] }));

const LANDMARKS: Record<District, BlockSpec[]> = {
  downtown: atAvenueEnd(downtown()),
  midtown: atAvenueEnd(midtown()),
  // Harlem's row houses are low, so the theatre is drawn larger to hold the
  // end of the street the way the towers do.
  harlem: atAvenueEnd(scaled(harlem(), 1.3)),
  megacity: atAvenueEnd(megacity()),
};

export function DistrictLandmark({ district }: { district: District }) {
  return <Blocks list={LANDMARKS[district]} prefix={`landmark-${district}`} />;
}
