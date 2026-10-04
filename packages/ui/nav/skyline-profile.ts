import type { District } from '../backgrounds/city-blocks-model.ts';

export type Crown = 'flat' | 'spire' | 'deco' | 'cornice' | 'tank' | 'bridge';

export interface SkylineBuilding {
  /** Height as a fraction of the band, 0 to 1. */
  height: number;
  /** Relative width; the band divides by the sum. */
  width: number;
  crown: Crown;
  /** 0 to 2: which shade step the face takes, so neighbours read apart. */
  shade: 0 | 1 | 2;
}

const rand = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

interface Spec {
  min: number;
  max: number;
  widths: [number, number];
  crowns: Crown[];
  /** Chance a building is one of the district's landmarks (tallest kind). */
  landmark: number;
}

const SPECS: Record<District, Spec> = {
  // FiDi: narrow, very tall, spires and tapers.
  downtown: { min: 0.45, max: 1, widths: [0.7, 1.1], crowns: ['flat', 'spire', 'flat', 'deco'], landmark: 0.18 },
  // Deco masses with stepped crowns and water tanks on the shorter roofs.
  midtown: { min: 0.35, max: 0.9, widths: [0.9, 1.5], crowns: ['deco', 'tank', 'flat', 'tank'], landmark: 0.12 },
  // Brownstone rows with cornices, a project slab now and then.
  harlem: { min: 0.18, max: 0.45, widths: [1, 1.4], crowns: ['cornice', 'cornice', 'flat', 'tank'], landmark: 0.1 },
  // Megastructures joined by sky bridges.
  megacity: { min: 0.55, max: 1, widths: [1.4, 2.4], crowns: ['bridge', 'flat', 'spire'], landmark: 0.2 },
};

const SEEDS: Record<District, number> = { downtown: 11, midtown: 23, harlem: 37, megacity: 53 };

/**
 * A deterministic row of building silhouettes for a district, for the nav's
 * skyline band and the footer's city edge. Same district and count, same
 * skyline, so server and client render the same markup.
 */
export function skylineProfile(district: District, count: number, seed = 1): SkylineBuilding[] {
  const spec = SPECS[district];
  const r = rand(SEEDS[district] * 7919 + seed * 104729);
  const out: SkylineBuilding[] = [];
  for (let i = 0; i < count; i++) {
    const landmark = r() < spec.landmark;
    const base = spec.min + r() * (spec.max - spec.min);
    // Harlem's project slabs and the landmarks break the roofline.
    const height = landmark ? Math.min(1, district === 'harlem' ? 0.75 + r() * 0.2 : spec.max * (0.92 + r() * 0.08)) : base;
    out.push({
      height: Number(height.toFixed(3)),
      width: Number((spec.widths[0] + r() * (spec.widths[1] - spec.widths[0])).toFixed(3)),
      crown: landmark && district !== 'harlem' ? (district === 'midtown' ? 'deco' : 'spire') : spec.crowns[Math.floor(r() * spec.crowns.length)]!,
      shade: (Math.floor(r() * 3) as 0 | 1 | 2),
    });
  }
  return out;
}
