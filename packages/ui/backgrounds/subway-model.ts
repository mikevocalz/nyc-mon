import { brand, palette } from '@acme/theme';
import type { NeonColorInput, Rgba } from '../neon/colors.ts';
import { THEMES, type District } from './district-theme.ts';
import { glyphMask } from './pixel-font.ts';
import { hash, mixRgba, rgba, rng, type Layer, type QuadWriter } from './quad-writer.ts';

export type GlowIntensity = 'none' | 'soft' | 'medium' | 'strong';

export interface SubwayOptions {
  district: District;
  /** First route's colour; the rest come from the route palette. */
  color: NeonColorInput | null;
  /** Route bar width in NeonBlade units; px = lineThickness * 5. */
  lineThickness: number;
  /** Station dot size in NeonBlade units; radius px = dotSize * 1.8. */
  dotSize: number;
  dotType: 'filled' | 'outline';
  glowColor: NeonColorInput;
  glowIntensity: GlowIntensity;
  trains: boolean;
  speed: number;
  seed: number;
}

export interface Route {
  points: [number, number][];
  stations: [number, number][];
  color: string;
  label: string;
  /** Cumulative length at each point. */
  lengths: number[];
  vertical: boolean;
}

/** Route colours, MTA-style, from the brand palette. */
const ROUTE_COLORS = [
  brand.orange, brand.royal, brand.leaf, brand.apple, brand.carolina, palette.silver[400],
  palette.orange[300], palette.leaf[400], palette.royal[300], palette.apple[300],
];
const LABELS = ['A', '4', 'N', '1', 'L', '7', 'B', 'Q', 'G', 'J', '6', '2'];

const SPECS: Record<District, { routes: number; crosstown: number; jog: number; funnel: number }> = {
  // Lines pile into the narrow tip of the island.
  downtown: { routes: 8, crosstown: 1, jog: 0.35, funnel: 0.6 },
  // Long trunk lines down the avenues, crosstown shuttles.
  midtown: { routes: 7, crosstown: 2, jog: 0.2, funnel: 0 },
  // A few express trunks heading uptown.
  harlem: { routes: 5, crosstown: 1, jog: 0.15, funnel: 0.1 },
  // The future network: dense, everywhere.
  megacity: { routes: 10, crosstown: 3, jog: 0.4, funnel: 0 },
};

/** Lay out routes on a grid of `cell` px: 0, 45 and 90 degree segments only, like the subway map. */
export function buildRoutes(width: number, height: number, cell: number, o: Pick<SubwayOptions, 'district' | 'color' | 'seed'>): Route[] {
  const spec = SPECS[o.district];
  const next = rng(o.seed * 131 + o.district.length);
  const cols = Math.max(2, Math.round(width / cell));
  const rows = Math.max(2, Math.round(height / cell));
  const palette0 = ROUTE_COLORS.slice(o.district.length % ROUTE_COLORS.length).concat(ROUTE_COLORS);
  const routes: Route[] = [];
  // Narrow screens keep fewer trunks so the bars still have room.
  const trunks = Math.max(3, Math.min(spec.routes, Math.floor(cols * 0.55)));
  const total = trunks + spec.crosstown;
  for (let i = 0; i < total; i++) {
    const vertical = i < trunks;
    const along = vertical ? rows : cols;
    const across = vertical ? cols : rows;
    let c = vertical ? Math.round(((i + 0.5) / trunks) * cols) : Math.round(((i - trunks + 0.5) / spec.crosstown) * rows);
    const grid: [number, number][] = [];
    for (let a = -1; a <= along + 1; a++) {
      grid.push(vertical ? [c, a] : [a, c]);
      const target = vertical ? cols / 2 : c;
      const funnel = a / along > 0.4 ? spec.funnel : 0;
      if (next() < spec.jog || (funnel && next() < funnel && Math.abs(c - target) > 1)) {
        const dir = funnel && Math.abs(c - target) > 1 ? Math.sign(target - c) : next() < 0.5 ? -1 : 1;
        c = Math.max(0, Math.min(across, c + dir));
      }
    }
    // Merge collinear steps into long runs.
    const points: [number, number][] = [grid[0]!];
    for (let k = 1; k < grid.length - 1; k++) {
      const [px, py] = points[points.length - 1]!;
      const [x, y] = grid[k]!;
      const [nx, ny] = grid[k + 1]!;
      if (Math.sign(x - px) !== Math.sign(nx - x) || Math.sign(y - py) !== Math.sign(ny - y)) points.push([x, y]);
    }
    points.push(grid[grid.length - 1]!);
    // Offset routes that share a column so trunks run side by side.
    const shift = ((i % 3) - 1) * 0.22;
    const px = points.map(([x, y]) => [(x + (vertical ? shift : 0)) * cell, (y + (vertical ? 0 : shift)) * cell] as [number, number]);
    const stations = grid
      .filter(([x, y], k) => k > 0 && x >= 0 && x <= cols && y >= 0 && y <= rows && hash(i, k, o.seed) < 0.32)
      .map(([x, y]) => [(x + (vertical ? shift : 0)) * cell, (y + (vertical ? 0 : shift)) * cell] as [number, number]);
    const lengths = [0];
    for (let k = 1; k < px.length; k++) lengths.push(lengths[k - 1]! + Math.hypot(px[k]![0] - px[k - 1]![0], px[k]![1] - px[k - 1]![1]));
    const color = i === 0 && o.color ? String(o.color) : palette0[i % palette0.length]!;
    routes.push({ points: px, stations, color, label: LABELS[i % LABELS.length]!, lengths, vertical });
  }
  return routes;
}

/** Position and heading at distance `s` along a route. */
export function pointAlong(route: Route, s: number): { x: number; y: number; dx: number; dy: number } {
  const { points, lengths } = route;
  const total = lengths[lengths.length - 1]!;
  const d = ((s % total) + total) % total;
  let k = 1;
  while (k < lengths.length - 1 && lengths[k]! < d) k++;
  const [ax, ay] = points[k - 1]!;
  const [bx, by] = points[k]!;
  const seg = lengths[k]! - lengths[k - 1]! || 1;
  const t = (d - lengths[k - 1]!) / seg;
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / seg, dy: (by - ay) / seg };
}

const GLOW: Record<GlowIntensity, number> = { none: 0, soft: 0.35, medium: 0.6, strong: 0.95 };

/**
 * A solid subway map: chunky route bars with night keylines, white station
 * dots, MTA-style route bullets and trains running the lines.
 * The port of NeonBlade UI's Cyber Circuit, traced as the NYC subway.
 */
export function subwayLayers(o: SubwayOptions): Layer[] {
  const theme = THEMES[o.district];
  const thick = Math.max(3, o.lineThickness * 5);
  const dot = Math.max(2, o.dotSize * 1.8);
  let memo: { width: number; height: number; cell: number; routes: Route[] } | null = null;
  const layout = (width: number, height: number) => {
    if (!memo || memo.width !== width || memo.height !== height) {
      const cell = Math.max(36, Math.min(64, width / 14));
      memo = { width, height, cell, routes: buildRoutes(width, height, cell, o) };
    }
    return memo;
  };
  const night = rgba(brand.night);
  const white = rgba(brand.white);

  const map: Layer = {
    static: true,
    paint(w, f) {
      const { cell, routes } = layout(f.width, f.height);
      // The street grid underneath, barely there.
      const block = rgba(theme.block, 0.28);
      for (let x = 0; x < f.width; x += cell) {
        for (let y = 0; y < f.height; y += cell) w.rect(x + 3, y + 3, cell - 6, cell - 6, block);
      }
      for (const route of routes) {
        const color = rgba(route.color);
        // Night keyline first, so a crossing route cuts cleanly over the one below.
        polyline(w, route.points, thick + 5, night);
        polyline(w, route.points, thick, color);
      }
      for (const route of routes) {
        for (const [x, y] of route.stations) {
          if (o.dotType === 'outline') {
            w.disc(x, y, dot + 1.5, night);
            w.disc(x, y, dot, white, Math.max(1.5, dot * 0.38));
          } else {
            w.disc(x, y, dot + 2, night);
            w.disc(x, y, dot, white);
          }
        }
      }
      // Route bullets where each line enters the map.
      for (const route of routes) {
        const r = Math.max(9, thick * 1.5);
        const at = pointAlong(route, cell * 2.2);
        w.disc(at.x, at.y, r + 2.5, night);
        w.disc(at.x, at.y, r, rgba(route.color));
        const gh = r * 1.1;
        w.glyph(at.x - gh * 0.3, at.y - gh / 2, gh * 0.6, gh, route.color === brand.white || route.color === palette.silver[400] ? night : white, glyphMask(route.label), 0.04);
      }
    },
  };

  const trains: Layer = {
    paint(w, f) {
      if (!o.trains) return;
      const { cell, routes } = layout(f.width, f.height);
      const glow = rgba(o.glowColor, GLOW[o.glowIntensity]);
      routes.forEach((route, i) => {
        // Cars in a pale tint of their line, so each train reads as that route.
        const car = mixRgba(rgba(route.color), rgba(brand.white), 0.6);
        const total = route.lengths[route.lengths.length - 1]!;
        for (let n = 0; n < 2; n++) {
          const dir = n === 0 ? 1 : -1;
          const s = hash(i, n, o.seed) * total + dir * f.time * o.speed * cell * (1.2 + hash(i, n) * 0.8);
          const len = thick * 3.4;
          // Straight along the head's segment, so a train never cuts a corner
          // or spans the whole route when its position wraps.
          const head = pointAlong(route, s + (dir * len) / 2);
          const tail = { x: head.x - head.dx * dir * len, y: head.y - head.dy * dir * len };
          w.pill(tail.x, tail.y, head.x, head.y, thick * 1.25, night);
          w.pill(tail.x, tail.y, head.x, head.y, thick * 0.7, car);
          if (glow[3] > 0) w.glow(head.x, head.y, thick * 1.6, glow);
        }
      });
    },
  };

  return [map, trains];
}

/** A thick polyline with round joins. */
function polyline(w: QuadWriter, points: [number, number][], width: number, color: Rgba) {
  for (let k = 1; k < points.length; k++) {
    w.bar(points[k - 1]![0], points[k - 1]![1], points[k]![0], points[k]![1], width, color);
  }
  for (let k = 1; k < points.length - 1; k++) w.disc(points[k]![0], points[k]![1], width / 2, color);
}
