// The Park Avenue Viaduct (New York Central, 1893-97; Metro-North) where it crosses the tile's east edge, from
// Valdrada v0.4.0 client/src/city/w125e.js and vk/park.js (MIT) over its OpenStreetMap tracks (w125eData.js, ODbL):
// four tracks on a ballast deck 7.0 m over the avenue, plate girders along both edges to 4.45 m clear, and every 50 ft
// (15.24 m) a bent of three built-up columns in the avenue's median carrying a cross girder. The steel is painted
// Valdrada's sandstone tan. Boxes on the lit masonry buffer: no draw call, shader or texture of its own.
//
// Valdrada's world y has the asphalt at 3.38; the heights below are its numbers less that.
import type { VertexBuffer } from './geometry.ts';
import { box, frame } from './parts.ts';

type Point = readonly [number, number];

export const VIADUCT = {
  /** Top of rail over the street. */
  rail: 7.0,
  /** The deck plate's top and bottom. */
  deckTop: 6.38,
  deckBottom: 6.05,
  /** The longitudinal plate girders' bottom flange. */
  girderBottom: 4.45,
  /** The bents' cross girders' bottom. */
  crossBottom: 3.4,
  /** Deck edge outside the outer track centres. */
  edge: 2.1,
  /** Bent pitch: 50 ft. */
  bentPitch: 15.24,
  /** Column half-width and the outer columns' offset from the deck's middle. */
  column: 0.32,
  columnOffset: 6.5,
  /** Tan paint (vk/park.js steelMat 'park' paint), the ballast and the rails. */
  paint: [0.737, 0.596, 0.467],
  ballast: [0.36, 0.34, 0.31],
  railSteel: [0.5, 0.48, 0.46],
} as const;

/** Points of one track polyline ([x, z, x, z, ...]). */
function points(flat: readonly number[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i]!, flat[i + 1]!]);
  return out;
}

/** The track's position `s` metres along it, extended straight past either end. */
function along(track: readonly Point[], s: number): Point {
  let acc = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!; const b = track[i]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= acc + len || i === track.length - 1) {
      const t = (s - acc) / (len || 1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    acc += len;
  }
  return track[0]!;
}

function length(track: readonly Point[]): number {
  let acc = 0;
  for (let i = 1; i < track.length; i++) acc += Math.hypot(track[i]![0] - track[i - 1]![0], track[i]![1] - track[i - 1]![1]);
  return acc;
}

export interface ViaductStats { spans: number; bents: number }

/**
 * Draws the viaduct over the four track polylines, inside a square of half-size `limit` around the tile centre. The
 * OSM tracks start between 122nd and 123rd Street; south of that Valdrada runs them straight on at the same spacing,
 * so the deck extends `southRun` metres back along the first segment.
 */
export function emitViaduct(buffer: VertexBuffer, tracks: readonly (readonly number[])[], limit: number, southRun = 220): ViaductStats {
  if (tracks.length < 2) return { spans: 0, bents: 0 };
  const lines = tracks.map(points);
  const west = lines[0]!; const east = lines[lines.length - 1]!;
  // The middle line between the outer tracks, measured on the west track's arc length.
  const total = length(west);
  const V = VIADUCT;
  const step = 6;
  let spans = 0; let bents = 0;
  const inside = (p: Point) => Math.abs(p[0]) <= limit && Math.abs(p[1]) <= limit;
  const sample = (s: number) => {
    const w = along(west, s); const e = along(east, s * (length(east) / total));
    return { w, e };
  };
  let nextBent = -southRun;
  for (let s = -southRun; s < total; s += step) {
    const a = sample(s); const b = sample(Math.min(total, s + step));
    const mid: Point = [(a.w[0] + a.e[0] + b.w[0] + b.e[0]) / 4, (a.w[1] + a.e[1] + b.w[1] + b.e[1]) / 4];
    if (!inside(mid)) continue;
    // Frame: origin at the span's middle, local +z along the tracks (northward), local x across.
    const dx = (b.w[0] + b.e[0] - a.w[0] - a.e[0]) / 2; const dz = (b.w[1] + b.e[1] - a.w[1] - a.e[1]) / 2;
    const run = Math.hypot(dx, dz) || 1;
    const f = frame(mid[0], mid[1], [dx / run, dz / run]);
    const half = Math.hypot(a.e[0] - a.w[0], a.e[1] - a.w[1]) / 2 + V.edge;
    const r = run / 2;
    box(buffer, f, [-half, V.deckBottom, -r], [half, V.deckTop, r], V.paint);
    // Fascia plate girders along both edges, a parapet over them.
    for (const x of [-half, half - 0.35]) {
      box(buffer, f, [x, V.girderBottom, -r], [x + 0.35, V.deckTop + 0.9, r], V.paint);
    }
    // Ballast and rails on each track (four tracks across the deck, evenly spaced as OSM has them).
    for (let k = 0; k < lines.length; k++) {
      const c = -half + V.edge + ((half - V.edge) * 2 * k) / (lines.length - 1);
      box(buffer, f, [c - 1.55, V.deckTop, -r], [c + 1.55, V.rail - 0.3, r], V.ballast, { skip: ['bottom'] });
      for (const off of [-0.75, 0.75]) box(buffer, f, [c + off - 0.04, V.rail - 0.3, -r], [c + off + 0.04, V.rail, r], V.railSteel, { skip: ['bottom'] });
    }
    spans++;
    // Bents every 15.24 m: three columns in the median and the cross girder they carry.
    while (nextBent < s + step) {
      if (nextBent >= s) {
        const z = nextBent - s - step / 2;
        for (const x of [-V.columnOffset, 0, V.columnOffset]) {
          box(buffer, f, [x - V.column, 0, z - V.column], [x + V.column, V.crossBottom, z + V.column], V.paint, { skip: ['bottom'] });
        }
        box(buffer, f, [-half, V.crossBottom, z - 0.4], [half, V.girderBottom, z + 0.4], V.paint);
        bents++;
      }
      nextBent += V.bentPitch;
    }
  }
  return { spans, bents };
}
