import { brand, palette } from '@acme/theme';
import type { NeonColorInput } from '../neon/colors.ts';
import { skyBands, THEMES, type District } from './district-theme.ts';
import { hash, mixRgba, rgba, withAlphaRgba, type Layer } from './quad-writer.ts';
import { buildSkyline, paintBeacons, paintSky, paintSkyline, type Skyline } from './skyline-model.ts';

export interface RainWindowOptions {
  district: District;
  dropColor: NeonColorInput;
  dropCount: number;
  /** NeonBlade px per frame at 60 fps. */
  speed: number;
  /** Degrees from vertical, clamped to +-60. */
  angle: number;
  dropMinLength: number;
  dropMaxLength: number;
  dropWidth: number;
  /** Rain opacity, 0 to 1. */
  opacity: number;
  backgroundColor: string;
  /** Draw the window frame. */
  frame: boolean;
  seed: number;
}

/** Pane layout for a width: a double-hung pair on phones, three bays on wide screens. */
export function paneColumns(width: number): number {
  return width >= 900 ? 3 : 2;
}

/** Where streak `i` is at `time`: head and tail, wrapping top to bottom. */
export function streakAt(o: Pick<RainWindowOptions, 'speed' | 'angle' | 'dropMinLength' | 'dropMaxLength' | 'seed'>, i: number, width: number, height: number, time: number) {
  const a = (Math.max(-60, Math.min(60, o.angle)) * Math.PI) / 180;
  const len = o.dropMinLength + hash(i, o.seed, 1) * (o.dropMaxLength - o.dropMinLength);
  const v = o.speed * 60 * (0.7 + hash(i, o.seed, 2) * 0.6);
  const span = height + len * 2;
  const travel = (hash(i, o.seed, 3) * span + time * v) % span;
  const drift = Math.tan(a) * height;
  const x0 = hash(i, o.seed, 4) * (width + Math.abs(drift)) - Math.max(0, drift);
  const hy = travel - len;
  const hx = x0 + Math.tan(a) * hy;
  return { hx, hy, tx: hx - Math.sin(a) * len, ty: hy - Math.cos(a) * len };
}

/**
 * Rain on a city window at night. Through the glass: the district's skyline,
 * dimmed. Outside: rain streaks at an angle. On the glass: beads and slow
 * rivulets. In front: a solid window frame, its sash and mullions in the
 * district's material (brownstone wood in Harlem, steel elsewhere).
 * The port of NeonBlade UI's Pluviophile.
 */
export function rainWindowLayers(o: RainWindowOptions): Layer[] {
  const theme = THEMES[o.district];
  const sky = skyBands({ ...theme, sky: [o.backgroundColor, ...theme.sky.slice(1)] }, 6);
  const tint = rgba(sky[1]!);
  const light = rgba(theme.light);
  let memo: { width: number; height: number; skyline: Skyline; ground: number } | null = null;
  const layout = (width: number, height: number) => {
    if (!memo || memo.width !== width || memo.height !== height) {
      const ground = height * 0.94;
      memo = { width, height, ground, skyline: buildSkyline({ x0: 0, x1: width, ground, maxHeight: height * 0.62, district: o.district, seed: o.seed, windowScale: 1 }) };
    }
    return memo;
  };

  const view: Layer = {
    static: true,
    paint(w, f) {
      const { ground, skyline } = layout(f.width, f.height);
      paintSky(w, f.width, ground, sky);
      // Seen through wet glass: the city sits back in a blue-black haze.
      paintSkyline(w, skyline, { fog: 0.38, fogColor: tint, light, lit: 0.32, accent: rgba(theme.accent) });
      w.rect(0, ground, f.width, f.height - ground, rgba(theme.ground));
    },
  };

  const rain: Layer = {
    paint(w, f) {
      const { skyline } = layout(f.width, f.height);
      paintBeacons(w, skyline, withAlphaRgba(rgba(theme.beacon), 0.7), f.time, true, 6);
      const color = withAlphaRgba(rgba(o.dropColor), o.opacity);
      for (let i = 0; i < o.dropCount; i++) {
        const s = streakAt(o, i, f.width, f.height, f.time);
        w.streak(s.tx, s.ty, s.hx, s.hy, Math.max(1, o.dropWidth * 1.4), color, 0.05);
      }
    },
  };

  const glass: Layer = {
    paint(w, f) {
      const bead = withAlphaRgba(mixRgba(rgba(o.dropColor), rgba(brand.white), 0.2), 0.42 * o.opacity + 0.2);
      const shadow = withAlphaRgba(rgba(brand.night), 0.35);
      const shine = rgba(brand.white, 0.85);
      const beads = Math.round(o.dropCount * 0.45);
      for (let i = 0; i < beads; i++) {
        const r = 1.5 + hash(i, o.seed, 11) ** 2 * 5;
        const sliding = r > 4.5;
        let x = hash(i, o.seed, 12) * f.width;
        let y = hash(i, o.seed, 13) * f.height;
        if (sliding) {
          // Heavy beads give way and run down the glass, wobbling.
          const v = 14 + hash(i, 14) * 22;
          y = (y + f.time * v) % (f.height + 40) - 20;
          x += Math.sin(f.time * 1.3 + i) * 1.5;
          w.bar(x, y - r * 7, x, y, r * 0.7, withAlphaRgba(bead, 0.5));
        }
        w.disc(x + r * 0.15, y + r * 0.2, r, shadow);
        w.disc(x, y, r, bead);
        w.disc(x - r * 0.35, y - r * 0.35, Math.max(0.6, r * 0.28), shine);
      }
    },
  };

  const frame: Layer = {
    static: true,
    paint(w, f) {
      if (!o.frame) return;
      const material = o.district === 'harlem' ? palette.orange[950] : theme.frame;
      const face = rgba(material);
      const side = mixRgba(face, rgba(brand.night), 0.4);
      const edge = mixRgba(face, rgba(brand.white), 0.16);
      const t = Math.max(12, Math.min(26, f.width * 0.02));
      // Outer frame with a lit inner bevel and a shaded outer one.
      w.rect(0, 0, f.width, t, face);
      w.rect(0, f.height - t * 1.6, f.width, t * 1.6, face);
      w.rect(0, 0, t, f.height, face);
      w.rect(f.width - t, 0, t, f.height, face);
      w.rect(t, t, f.width - t * 2, 3, side);
      w.rect(t, t, 3, f.height - t * 2.6, side);
      w.rect(t, f.height - t * 1.6 - 2, f.width - t * 2, 2, edge);
      // Sill: one solid step lighter, catching the street light.
      w.rect(-4, f.height - t * 0.9, f.width + 8, t * 0.9, edge);
      w.rect(-4, f.height - t * 0.9, f.width + 8, 2.5, rgba(theme.accent, 0.6));
      // Mullions and the meeting rail of a double-hung sash.
      const cols = paneColumns(f.width);
      const m = t * 0.6;
      for (let c = 1; c < cols; c++) {
        const x = (f.width * c) / cols - m / 2;
        w.rect(x, t, m, f.height - t * 2.6, face);
        w.rect(x + m * 0.7, t, m * 0.3, f.height - t * 2.6, side);
      }
      const rail = f.height * 0.48;
      w.rect(t, rail - m / 2, f.width - t * 2, m, face);
      w.rect(t, rail + m * 0.2, f.width - t * 2, m * 0.3, side);
    },
  };

  return [view, rain, glass, frame];
}
