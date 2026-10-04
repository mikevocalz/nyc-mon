import { brand, palette } from '@acme/theme';
import type { NeonColorInput, Rgba } from '../neon/colors.ts';
import { skyBands, THEMES, type District } from './district-theme.ts';
import { mixRgba, rgba, type Layer, type PaintFrame, type QuadWriter } from './quad-writer.ts';
import { buildSkyline, paintSky, paintSkyline, type Skyline } from './skyline-model.ts';

export interface PlaneOptions {
  district: District;
  columns: number;
  rows: number;
  /** Avenue light colour (NeonBlade lineColor). */
  lineColor: NeonColorInput;
  /** Lamp glow (NeonBlade glowColor). */
  glowColor: NeonColorInput;
  speed: number;
  /** Street width multiplier (NeonBlade lineWidth). */
  lineWidth: number;
}

export interface StreetFloorOptions extends PlaneOptions {
  horizon: number;
  horizonGlowColor: string;
  bgColor: string;
  skyline: boolean;
  seed: number;
}

export interface GridSceneOptions extends PlaneOptions {
  horizon: number;
  gap: number;
  bgColor: string;
  showFloor: boolean;
  showCeiling: boolean;
}

/** Every `AVENUE_EVERY`th column line is a lit avenue. */
export const AVENUE_EVERY = 4;

/** Depth curve: rows crowd towards the horizon (NeonBlade's quadratic). */
export const depthY = (edgeY: number, farY: number, t: number) => edgeY + (farY - edgeY) * t * t;

/**
 * One street-grid plane in perspective from `edgeY` (the horizon side) to
 * `farY` (the viewer's side; above the edge for a ceiling). Solid block
 * plates with a kerb face, streets as the gaps, lamps along the avenues.
 * Rows scroll towards the viewer with `phase`.
 */
export function paintPlane(
  w: QuadWriter, f: PaintFrame, o: PlaneOptions, edgeY: number, farY: number,
  colors: { block: Rgba; kerb: Rgba; fog: Rgba; lamp: Rgba; strip: Rgba },
) {
  const phase = ((f.time * o.speed * 1.5) % 1 + 1) % 1;
  const cx = f.width / 2;
  const cols = Math.max(2, Math.round(o.columns));
  const rows = Math.max(2, Math.round(o.rows));
  const colW = f.width / cols;
  const xAt = (u: number, t: number) => cx + u * colW * (1 + t * t);
  const gu = Math.min(0.35, 0.11 * o.lineWidth);
  const gt = Math.min(0.3, 0.09 * o.lineWidth);
  const ceiling = farY < edgeY;
  for (let j = rows; j >= -1; j--) {
    const ta = Math.max(0, (j + phase) / rows);
    const tb = Math.min(1.08, (j + 1 + phase) / rows);
    if (tb <= 0 || ta >= 1.08) continue;
    const span = tb - ta;
    const t0 = ta + span * gt;
    const t1 = tb - span * gt;
    if (t1 <= t0) continue;
    const y0 = depthY(edgeY, farY, t0);
    const y1 = depthY(edgeY, farY, t1);
    const fog = Math.max(0, 1 - t1 * t1 * 1.6);
    const block = mixRgba(colors.block, colors.fog, fog);
    const kerb = mixRgba(colors.kerb, colors.fog, fog);
    const kerbH = (y1 - y0) * 0.22;
    for (let u = -cols / 2 - 1; u < cols / 2 + 1; u++) {
      const u0 = u + gu / 2;
      const u1 = u + 1 - gu / 2;
      w.quad(xAt(u0, t0), y0, xAt(u1, t0), y0, xAt(u1, t1), y1, xAt(u0, t1), y1, block);
      // Kerb: the plate's near face, so the blocks read as solid slabs.
      w.quad(xAt(u0, t1), y1, xAt(u1, t1), y1, xAt(u1, t1), y1 + kerbH, xAt(u0, t1), y1 + kerbH, kerb);
      if (ceiling && (u + 100) % 2 === 0) {
        // Mega City deck panels carry a strip light.
        const tm = (t0 + t1) / 2;
        const ym = depthY(edgeY, farY, tm);
        const sh = Math.max(1, (y1 - y0) * 0.08);
        w.quad(xAt(u0 + 0.15, tm), ym, xAt(u1 - 0.15, tm), ym, xAt(u1 - 0.15, tm), ym + sh, xAt(u0 + 0.15, tm), ym + sh, mixRgba(colors.strip, colors.fog, fog));
      }
    }
  }
  // Avenue lamps at every intersection along the lit avenues.
  for (let u = -Math.floor(cols / 2 / AVENUE_EVERY) * AVENUE_EVERY; u <= cols / 2; u += AVENUE_EVERY) {
    for (let j = 0; j <= rows; j++) {
      const t = (j + phase) / rows;
      if (t > 1.05) continue;
      const x = xAt(u, t);
      const y = depthY(edgeY, farY, t);
      const size = 3 + 16 * t * t;
      const fade = Math.min(1, t * t * 4 + 0.15);
      // Lamp: a solid head in the avenue colour, the glow behind it the accent.
      w.glow(x, y, size * 1.8, [colors.lamp[0], colors.lamp[1], colors.lamp[2], colors.lamp[3] * fade]);
      w.disc(x, y, Math.max(1, size * 0.28), [colors.strip[0], colors.strip[1], colors.strip[2], fade]);
    }
  }
}

function planeColors(o: PlaneOptions, fog: Rgba, ceiling: boolean) {
  const theme = THEMES[o.district];
  const block = rgba(ceiling ? (o.district === 'megacity' ? palette.royal[900] : palette.ink[900]) : theme.block);
  return {
    block,
    kerb: mixRgba(block, rgba(brand.night), 0.45),
    fog,
    lamp: rgba(o.glowColor),
    strip: rgba(o.lineColor),
  };
}

/**
 * A solid street-grid ground plane with avenue lighting, receding to a
 * stepped sky. The re-skin of the starter's NeonBlade Grid Floor port.
 */
export function streetFloorLayers(o: StreetFloorOptions): Layer[] {
  const theme = THEMES[o.district];
  const bands = skyBands({ ...theme, sky: [o.bgColor, ...theme.sky.slice(1)] }, 5);
  const horizonColor = rgba(bands[bands.length - 1]!);
  let memo: { width: number; height: number; skyline: Skyline } | null = null;

  const sky: Layer = {
    static: true,
    paint(w, f) {
      const horizonY = f.height * o.horizon;
      paintSky(w, f.width, horizonY, bands);
      if (o.skyline) {
        if (!memo || memo.width !== f.width || memo.height !== f.height) {
          memo = { width: f.width, height: f.height, skyline: buildSkyline({ x0: 0, x1: f.width, ground: horizonY, maxHeight: horizonY * 0.7, district: o.district, seed: o.seed, windowScale: 0.7 }) };
        }
        paintSkyline(w, memo.skyline, { fog: 0.45, fogColor: horizonColor, light: rgba(theme.light), lit: 0.22, accent: rgba(theme.accent) });
      }
      w.rect(0, horizonY, f.width, f.height - horizonY, rgba(theme.ground));
      if (o.horizonGlowColor !== 'transparent') {
        w.rect(0, horizonY - 2, f.width, 4, rgba(o.horizonGlowColor));
        w.rect(0, horizonY + 2, f.width, 6, rgba(o.horizonGlowColor, 0.3));
      }
    },
  };

  const floor: Layer = {
    paint(w, f) {
      const horizonY = f.height * o.horizon;
      paintPlane(w, f, o, horizonY + 2, f.height, planeColors(o, mixRgba(rgba(theme.ground), horizonColor, 0.4), false));
    },
  };

  return [sky, floor];
}

/**
 * Floor and ceiling meeting at a lit horizon gap: the street grid below and
 * the underside of a Mega City deck above, panels lit by strip lights.
 * The re-skin of the starter's NeonBlade Grid Scene port.
 */
export function gridSceneLayers(o: GridSceneOptions): Layer[] {
  const theme = THEMES[o.district];
  const fogColor = mixRgba(rgba(o.bgColor), rgba(theme.sky[theme.sky.length - 1]!), 0.5);
  return [
    {
      static: true,
      paint(w, f) {
        const horizonY = f.height * o.horizon;
        const half = (f.height * o.gap) / 2;
        // The gap: a solid band of distant light between the two planes.
        w.rect(0, horizonY - half, f.width, half * 2, fogColor);
        w.rect(0, horizonY - 1.5, f.width, 3, rgba(o.glowColor));
      },
    },
    {
      paint(w, f) {
        const horizonY = f.height * o.horizon;
        const half = (f.height * o.gap) / 2;
        if (o.showCeiling) paintPlane(w, f, o, horizonY - half, 0, planeColors(o, fogColor, true));
        if (o.showFloor) paintPlane(w, f, o, horizonY + half, f.height, planeColors(o, fogColor, false));
      },
    },
  ];
}
