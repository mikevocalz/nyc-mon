import { brand } from '@acme/theme';
import type { NeonColorInput } from '../neon/colors.ts';
import { skyBands, THEMES, type District } from './district-theme.ts';
import { hash, mixRgba, rgba, withAlphaRgba, type Layer } from './quad-writer.ts';
import { buildSkyline, paintBeacons, paintSky, paintSkyline, type Skyline } from './skyline-model.ts';

export type RiverTideOrigin = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface RiverTideOptions {
  district: District;
  /** NeonBlade name: crest and reflection colour. */
  colorA: NeonColorInput | null;
  /** NeonBlade name: deepest water colour. */
  colorB: NeonColorInput | null;
  bgColor: string;
  /** Where the swell comes from: waves travel away from this corner. */
  origin: RiverTideOrigin;
  speed: number;
  amplitude: number;
  frequency: number;
  /** Strength of the reflected city lights, 0 to 1. */
  glow: number;
  /** Crest highlight strength, 0 to 1. */
  gloss: number;
  /** Number of water bands. */
  bands: number;
  /** Far shore with the district skyline. */
  shore: boolean;
  /** The far shoreline as a fraction of height, 0.15 to 0.7. */
  horizon: number;
  hoverEffect: boolean;
  hoverRadius: number;
  hoverStrength: number;
  seed: number;
}

/** Top edge of band `k` at x: two travelling sines on a stepped baseline. */
export function crestY(o: Pick<RiverTideOptions, 'amplitude' | 'frequency' | 'speed' | 'origin'>, k: number, bands: number, x: number, top: number, height: number, time: number): number {
  const t = k / bands;
  // Bands crowd towards the far shore: perspective without a camera.
  const base = top + (height - top) * t ** 1.45;
  const dir = o.origin.endsWith('left') ? 1 : -1;
  const tilt = (o.origin.startsWith('top') ? -1 : 1) * 0.03 * (x - 0) * (1 - t);
  const amp = o.amplitude * (4 + 14 * t);
  const f = (o.frequency * 0.018) / (0.4 + t);
  return base + tilt + amp * (Math.sin(x * f - dir * time * o.speed * 1.6 + k * 1.7) * 0.7 + Math.sin(x * f * 2.3 + dir * time * o.speed * 1.1 + k) * 0.3);
}

/**
 * The Hudson (or the East River) at night: a far-shore skyline over solid
 * layered water bands, each band a wave-topped slab one shade off its
 * neighbour, with a lit crest and the city's lights broken up on the swell.
 * The port of NeonBlade UI's Neon Tide.
 */
export function riverTideLayers(o: RiverTideOptions): Layer[] {
  const theme = THEMES[o.district];
  const sky = skyBands({ ...theme, sky: [o.bgColor, ...theme.sky.slice(1)] }, 5);
  const water = theme.water.map((c) => rgba(c));
  const deep = o.colorB ? rgba(o.colorB) : rgba(theme.water[theme.water.length - 1]!);
  // Crest: one solid step lighter than the far water, unless the caller picks one.
  const crest = o.colorA ? rgba(o.colorA) : mixRgba(rgba(theme.water[0]!), rgba(brand.white), 0.45);
  const light = rgba(theme.light);
  let memo: { width: number; height: number; skyline: Skyline; shoreY: number } | null = null;
  const layout = (width: number, height: number) => {
    if (!memo || memo.width !== width || memo.height !== height) {
      const shoreY = height * Math.min(0.7, Math.max(0.15, o.horizon));
      memo = {
        width,
        height,
        shoreY,
        skyline: buildSkyline({ x0: 0, x1: width, ground: shoreY, maxHeight: shoreY * 0.85, district: o.district, seed: o.seed, windowScale: 0.6 }),
      };
    }
    return memo;
  };

  const shore: Layer = {
    static: true,
    paint(w, f) {
      const { shoreY, skyline } = layout(f.width, f.height);
      paintSky(w, f.width, shoreY, sky);
      if (o.shore) paintSkyline(w, skyline, { fog: 0.3, fogColor: rgba(sky[sky.length - 1]!), light, lit: 0.3, accent: rgba(theme.accent) });
      w.rect(0, shoreY - 3, f.width, 4, rgba(theme.ground));
    },
  };

  const tide: Layer = {
    paint(w, f) {
      const { shoreY, skyline } = layout(f.width, f.height);
      if (o.shore) paintBeacons(w, skyline, rgba(theme.beacon), f.time, true, 5);
      const bands = Math.max(3, o.bands);
      const slice = Math.max(6, f.width / 90);
      const night = rgba(brand.night);
      const pointer = f.pointer;
      const lift = (x: number, y: number) => {
        if (!o.hoverEffect || !pointer.inside) return 0;
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const r = o.hoverRadius * 22;
        return -o.hoverStrength * 14 * Math.exp(-(dx * dx + dy * dy) / (r * r));
      };
      for (let k = 0; k < bands; k++) {
        // Alternate shades from the district's water steps, deepening towards the viewer.
        const base = mixRgba(water[k % water.length]!, deep, (k / bands) * 0.55);
        const lip = mixRgba(base, crest, 0.35 + o.gloss * 0.4);
        const t = k / bands;
        for (let x = 0; x < f.width + slice; x += slice) {
          const x1 = x + slice;
          const y0 = crestY(o, k, bands, x, shoreY, f.height, f.time);
          const y1 = crestY(o, k, bands, x1, shoreY, f.height, f.time);
          const l0 = y0 + lift(x, y0);
          const l1 = y1 + lift(x1, y1);
          w.quad(x, l0, x1, l1, x1, f.height, x, f.height, base);
          // Solid crest lip, thicker in front.
          const lipH = (1.5 + 3 * t) * (0.4 + o.gloss);
          w.quad(x, l0, x1, l1, x1, l1 + lipH, x, l0 + lipH, lip);
        }
        // City lights broken up on the swell: short solid dashes riding each band.
        if (o.glow > 0) {
          const dashes = Math.floor(f.width / 70);
          for (let i = 0; i < dashes; i++) {
            const dx = ((hash(i, k, o.seed) * f.width + f.time * o.speed * 12 * (k % 2 ? 1 : -1)) % f.width + f.width) % f.width;
            const y = crestY(o, k, bands, dx, shoreY, f.height, f.time) + 5 + 6 * t + lift(dx, 0);
            const len = 6 + hash(i, k) * (10 + 20 * t);
            const reflect = withAlphaRgba(hash(i, k, 3) < 0.3 ? rgba(theme.beacon) : light, o.glow * (0.5 + 0.5 * t));
            w.rect(dx - len / 2, y, len, 1.5 + 1.5 * t, reflect);
          }
        }
      }
      // A slim night band at the very bottom anchors the composition.
      w.rect(0, f.height - 3, f.width, 3, night);
    },
  };

  return [shore, tide];
}
