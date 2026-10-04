import { brand, palette } from '@acme/theme';
import type { NeonColorInput } from '../neon/colors.ts';
import { THEMES, type District } from './district-theme.ts';
import { hash, mixRgba, rgba, rng, type Layer } from './quad-writer.ts';

export interface StreetPulseOptions {
  district: District;
  lineColor: NeonColorInput;
  /** NeonBlade name: the head glow. */
  shadowColor: NeonColorInput;
  /** NeonBlade name: block fill. */
  bgGridColor: NeonColorInput;
  /** Block pitch in px (block plus street). */
  cellSize: number;
  maxLines: number;
  /** NeonBlade px per frame at 60 fps. */
  baseSpeed: number;
  /** Trail length in px. */
  lineLength: number;
  /** NeonBlade spawn chance per frame; here it sets how busy the streets are. */
  spawnProbability: number;
  overlay: boolean;
  seed: number;
}

/** A pulse's route through the grid: intersections from entry to exit. */
export function pulsePath(width: number, height: number, cell: number, seed: number): { points: [number, number][]; length: number } {
  const next = rng(seed);
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);
  // Enter from the top or the left edge, on a street.
  const fromTop = next() < 0.6;
  let x = fromTop ? Math.floor(next() * (cols + 1)) : 0;
  let y = fromTop ? 0 : Math.floor(next() * (rows + 1));
  let dx = fromTop ? 0 : 1;
  let dy = fromTop ? 1 : 0;
  const points: [number, number][] = [[x * cell, (y - (fromTop ? 1 : 0)) * cell]];
  if (!fromTop) points[0] = [-cell, y * cell];
  for (let step = 0; step < 400; step++) {
    x += dx;
    y += dy;
    if (x < -1 || y < -1 || x > cols + 1 || y > rows + 1) break;
    // Turn at some intersections, never back the way it came, never back up the grid.
    if (next() < 0.28) {
      const turns: [number, number][] = dy !== 0 ? [[1, 0], [-1, 0]] : [[0, 1]];
      const [tx, ty] = turns[Math.floor(next() * turns.length)]!;
      if (x + tx >= 0 && x + tx <= cols) {
        points.push([x * cell, y * cell]);
        dx = tx;
        dy = ty;
      }
    }
  }
  points.push([x * cell, y * cell]);
  let length = 0;
  for (let k = 1; k < points.length; k++) length += Math.hypot(points[k]![0] - points[k - 1]![0], points[k]![1] - points[k - 1]![1]);
  return { points, length };
}

/** Sub-path between distances a and b, as segments. */
export function slicePath(points: [number, number][], a: number, b: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let walked = 0;
  for (let k = 1; k < points.length; k++) {
    const [x0, y0] = points[k - 1]!;
    const [x1, y1] = points[k]!;
    const seg = Math.hypot(x1 - x0, y1 - y0);
    const s0 = Math.max(a, walked);
    const s1 = Math.min(b, walked + seg);
    if (s1 > s0 && seg > 0) {
      const t0 = (s0 - walked) / seg;
      const t1 = (s1 - walked) / seg;
      out.push([x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1]);
    }
    walked += seg;
    if (walked >= b) break;
  }
  return out;
}

/**
 * Traffic pulses through a solid street grid. The blocks are solid plates
 * (a few of them parks); each pulse is a solid bar running the streets,
 * turning at intersections, its trail stepping down through shades, with a
 * bright head. The port of NeonBlade UI's Datalines with Grid.
 */
export function streetPulseLayers(o: StreetPulseOptions): Layer[] {
  const theme = THEMES[o.district];
  const cell = Math.max(24, o.cellSize);
  const street = Math.max(4, cell * 0.16);
  const pxPerSecond = o.baseSpeed * 60;
  // Idle time between a pulse leaving and the next one entering on its slot.
  const idle = Math.max(0, 1 - Math.min(1, o.spawnProbability * 5));
  const paths = new Map<string, { points: [number, number][]; length: number }>();

  const grid: Layer = {
    static: true,
    paint(w, f) {
      const block = rgba(o.bgGridColor);
      const top = mixRgba(block, rgba(brand.white), 0.08);
      const park = rgba(palette.leaf[900]);
      const parkShare = o.district === 'harlem' ? 0.12 : o.district === 'megacity' ? 0.02 : 0.06;
      for (let gx = 0; gx * cell < f.width + cell; gx++) {
        for (let gy = 0; gy * cell < f.height + cell; gy++) {
          const x = gx * cell + street / 2;
          const y = gy * cell + street / 2;
          const size = cell - street;
          const isPark = hash(gx, gy, o.seed) < parkShare;
          w.rect(x, y, size, size, isPark ? park : block);
          // A lighter lip on the north edge reads as the block's solid kerb.
          w.rect(x, y, size, Math.max(1.5, size * 0.08), isPark ? park : top);
        }
      }
    },
  };

  const pulses: Layer = {
    paint(w, f) {
      const head = rgba(brand.white);
      const glow = rgba(o.shadowColor, 0.85);
      const steps = [1, 0.7, 0.45, 0.25].map((t) => mixRgba(rgba(o.lineColor), rgba(theme.ground), 1 - t));
      const width = Math.max(3, street * 0.6);
      for (let i = 0; i < o.maxLines; i++) {
        const offset = hash(i, o.seed, 9) * 1000;
        // Estimate a cycle from the grid size so pulses stagger.
        const cycleLen = (f.width + f.height) * 0.6 + o.lineLength;
        const cycleTime = (cycleLen / pxPerSecond) * (1 + idle * 0.3);
        const local = f.time + offset;
        const cycle = Math.floor(local / cycleTime);
        const key = `${i}|${cycle}|${f.width}|${f.height}`;
        let path = paths.get(key);
        if (!path) {
          if (paths.size > o.maxLines * 4) paths.clear();
          path = pulsePath(f.width, f.height, cell, Math.floor(hash(i, cycle, o.seed) * 2147483647) + 1);
          paths.set(key, path);
        }
        const s = (local - cycle * cycleTime) * pxPerSecond;
        if (s - o.lineLength > path.length) continue;
        // Trail in solid steps, newest brightest: one slice of the path per step.
        steps.forEach((shade, k) => {
          const to = s - (o.lineLength * k) / steps.length;
          const from = s - (o.lineLength * (k + 1)) / steps.length;
          for (const [x0, y0, x1, y1] of slicePath(path!.points, from, to)) w.pill(x0, y0, x1, y1, width, shade);
        });
        const segs = slicePath(path.points, s - 1, s);
        const last = segs[segs.length - 1];
        if (last && s <= path.length) {
          w.glow(last[2], last[3], width * 4, glow);
          w.disc(last[2], last[3], width * 0.9, head);
        }
      }
      if (o.overlay) w.vignette(f.width, f.height);
    },
  };

  return [grid, pulses];
}
