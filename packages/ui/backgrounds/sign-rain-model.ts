import { brand, palette } from '@acme/theme';
import type { NeonColorInput } from '../neon/colors.ts';
import { THEMES, type District } from '../district/index.ts';
import { glyphPool } from './pixel-font.ts';
import { hash, mixRgba, rgba, type Layer } from './quad-writer.ts';
import { buildSkyline, paintSkyline, type Skyline } from './skyline-model.ts';

export interface SignRainOptions {
  district: District;
  /** Trail glyph colour. */
  textColor: NeonColorInput;
  /** Head plate colour: NYC street-sign green by default. */
  signColor: NeonColorInput;
  bgColor: string;
  /** Glyph height in px. */
  fontSize: number;
  /** NeonBlade: ms per step. Lower is faster. */
  speed: number;
  characters: string;
  /** Share of columns that rain lit windows instead of letters, 0 to 1. */
  windowShare: number;
  skyline: boolean;
  seed: number;
}

export interface RainColumn {
  /** Rows per second. */
  rate: number;
  offset: number;
  trail: number;
  /** Lit-window column instead of letters. */
  windows: boolean;
}

/** Per-column timing, deterministic from the seed. */
export function rainColumns(count: number, o: Pick<SignRainOptions, 'speed' | 'windowShare' | 'seed'>): RainColumn[] {
  const base = 1000 / Math.max(5, o.speed);
  return Array.from({ length: count }, (_, i) => ({
    rate: base * (0.35 + hash(i, o.seed, 1) * 0.5),
    offset: hash(i, o.seed, 2) * 200,
    trail: 6 + Math.floor(hash(i, o.seed, 3) * 14),
    windows: hash(i, o.seed, 4) < o.windowShare,
  }));
}

/** Row of a column's head at `time`; it wraps after the trail and a gap have cleared the screen. */
export function headRow(col: RainColumn, rows: number, time: number): number {
  const cycle = rows + col.trail + 8;
  return Math.floor((time * col.rate + col.offset) % cycle);
}

/**
 * Street-sign glyph rain over a solid skyline. Each column falls one cell at
 * a time: the head is a green street-sign plate with a white letter, the
 * trail steps down through solid shades of the district colour. Some columns
 * rain lit windows instead, warm squares cascading down a facade.
 */
export function signRainLayers(o: SignRainOptions): Layer[] {
  const theme = THEMES[o.district];
  const pool = glyphPool(o.characters);
  const cellW = Math.max(8, o.fontSize * 1.15);
  const cellH = Math.max(10, o.fontSize * 1.3);
  const glyphW = o.fontSize * 0.62;
  let memo: { width: number; height: number; skyline: Skyline; columns: RainColumn[] } | null = null;
  const layout = (width: number, height: number) => {
    if (!memo || memo.width !== width || memo.height !== height) {
      const ground = height;
      memo = {
        width,
        height,
        skyline: buildSkyline({ x0: 0, x1: width, ground, maxHeight: height * 0.55, district: o.district, seed: o.seed, windowScale: 0.8 }),
        columns: rainColumns(Math.ceil(width / cellW), o),
      };
    }
    return memo;
  };
  const night = rgba(o.bgColor);
  const trailSteps = [0.9, 0.7, 0.5, 0.34, 0.2].map((t) => mixRgba(rgba(o.textColor), night, 1 - t));
  const windowSteps = [0.95, 0.7, 0.45, 0.25].map((t) => mixRgba(rgba(theme.light), night, 1 - t));
  const plate = rgba(o.signColor);
  const white = rgba(brand.white);
  // NYC street signs: a green plate inside a thin white border.
  const plateEdge = white;

  const scenery: Layer = {
    static: true,
    paint(w, f) {
      if (!o.skyline) return;
      const { skyline } = layout(f.width, f.height);
      paintSkyline(w, skyline, { fog: 0.5, fogColor: night, light: rgba(theme.light), lit: 0.18, accent: rgba(theme.accent) });
    },
  };

  const rain: Layer = {
    paint(w, f) {
      const { columns } = layout(f.width, f.height);
      const rows = Math.ceil(f.height / cellH);
      columns.forEach((col, c) => {
        const head = headRow(col, rows, f.time);
        const x = c * cellW + (cellW - glyphW) / 2;
        for (let k = col.trail; k >= 0; k--) {
          const row = head - k;
          if (row < 0 || row >= rows) continue;
          const y = row * cellH + (cellH - o.fontSize) / 2;
          if (col.windows) {
            const shade = windowSteps[Math.min(windowSteps.length - 1, Math.floor((k / col.trail) * windowSteps.length))]!;
            w.rect(x, y, glyphW, o.fontSize * 0.8, k === 0 ? white : shade);
            continue;
          }
          // Letters flicker as they fall: a new glyph every so often per cell.
          const flip = Math.floor(f.time * 3 + hash(c, row) * 5);
          const mask = pool[Math.floor(hash(c, row, flip) * pool.length)]!;
          if (k === 0) {
            const pad = o.fontSize * 0.18;
            w.round(x - pad, y - pad, glyphW + pad * 2, o.fontSize + pad * 2, plateEdge, pad);
            w.round(x - pad * 0.7, y - pad * 0.7, glyphW + pad * 1.4, o.fontSize + pad * 1.4, plate, pad * 0.6);
            w.glyph(x, y, glyphW, o.fontSize, white, mask);
            continue;
          }
          const shade = trailSteps[Math.min(trailSteps.length - 1, Math.floor((k / col.trail) * trailSteps.length))]!;
          w.glyph(x, y, glyphW, o.fontSize, shade, mask);
        }
      });
    },
  };

  return [scenery, rain];
}

/** Default glyphs: street-sign words and numbers. */
export const STREET_CHARACTERS = 'AVE ST BWAY 125 42 34 14 NYC LEX PARK MADISON HARLEM WALL FULTON 0123456789 -/#';

export const SIGN_GREEN = palette.leaf[700];
