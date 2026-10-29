// Hero facades for the four 125th Street landmarks, from Valdrada v0.4.0's measured builders (MIT): the Apollo
// (client/src/city/w125cKit.js AP33 and fk/specs/bid2.js w125-253), Hotel Theresa (fk/custom/bid2.js TH), the Adam
// Clayton Powell Jr. State Office Building (fk/specs/bid3.js w125-163, fk/custom/bid3.js SOB) and the Studio Museum in
// Harlem (fk/specs/bid3.js w125-144, fk/custom/bid3.js). Valdrada draws these with its own canvas-textured kit; here
// each is the measured layout in boxes and pixel-font lettering on the city's existing buffers, so a hero costs
// triangles and no draw call, shader or texture.
//
// Every span is in the spec's face frame: u metres from the face's left end as seen from the street (bake-facades.mjs
// gives the frontage with that end first), y metres over the pavement, w metres out of the wall. A frontage on our
// footprint shorter or longer than Valdrada's scales u by the ratio.
//
// Targets: `walls` is the lit masonry buffer (piers, cornices, the blade's body), `glow` the unlit accent buffer
// (marquee bulbs, the blade's neon faces), `letters` the pixel-font buffer.
import type { VertexBuffer } from './geometry.ts';
import { emitStackedText, emitText, textWidth } from './lettering.ts';
import { box, frame, type Frame } from './parts.ts';

type Rgb = readonly [number, number, number];
type Point = readonly [number, number];

export type HeroKey = 'apollo' | 'theresa' | 'studio' | 'sob';

/** Colours from Valdrada's builders, display-space RGB (the hex is in each comment's source line). */
export const HERO_COLORS = {
  /** w125cKit.js MATS terracotta_cream: the Apollo's glazed terracotta front. */
  apolloTerracotta: [0.863, 0.855, 0.827],
  /** w125cKit.js bronze: the marquee's soffit and frame. */
  bronze: [0.239, 0.192, 0.145],
  /** w125cKit.js steel: the marquee's blue enamel body. */
  marqueeSteel: [0.153, 0.188, 0.353],
  /** w125cKit.js chanNeon APOLLO: amber neon, the bulb strip's warm white, the blade's red. */
  apolloNeon: [1, 0.604, 0.125],
  bulbs: [1, 0.957, 0.69],
  bladeRed: [0.769, 0.118, 0.145],
  /** landmarks.js TRIM: the Theresa's white terracotta bands. */
  theresaTrim: [0.91, 0.886, 0.816],
  /** fk/custom/bid2.js ghostSign: HOTEL THERESA painted on the west wall. */
  theresaGhost: [0.741, 0.306, 0.176],
  /** fk/specs/bid3.js STONE: the State Office Building's limestone piers and attic. */
  sobStone: [0.788, 0.741, 0.655],
  /** fk/custom/bid3.js: the base band's incised letters. */
  sobLetters: [0.357, 0.29, 0.2],
  /** fk/custom/bid3.js: STUDIO MUSEUM IN HARLEM on the bronze fascia, and the blade's letters. */
  studioFascia: [0.91, 0.839, 0.682],
  studioBlade: [0.949, 0.949, 0.941],
  /** fk/specs/bid3.js w125-144 charcoal precast, a shade darker for the deep box frames. */
  studioFrame: [0.17, 0.172, 0.18],
} as const satisfies Record<string, Rgb>;

/** Valdrada's measured frontage length per hero, metres: our footprint's front scales u by ours / theirs. */
const MEASURED_FRONT: Record<HeroKey, number> = { apollo: 15.15, theresa: 18.61, studio: 22.9, sob: 61.72 };

/** A hero's frontage: u = 0 end, unit direction along u, outward normal, length. */
export interface HeroFront {
  readonly a: Point;
  readonly along: Point;
  readonly out: Point;
  readonly length: number;
}

/**
 * The frontage from the bake's [ax, az, bx, bz] (u = 0 end first), facing away from the footprint's centroid.
 */
export function heroFront(f: readonly number[], centroid: Point): HeroFront {
  const [ax, az, bx, bz] = f as [number, number, number, number];
  const length = Math.hypot(bx - ax, bz - az) || 1;
  const along: Point = [(bx - ax) / length, (bz - az) / length];
  let out: Point = [along[1], -along[0]];
  const mx = (ax + bx) / 2; const mz = (az + bz) / 2;
  if ((centroid[0] - mx) * out[0] + (centroid[1] - mz) * out[1] > 0) out = [-out[0], -out[1]];
  return { a: [ax, az], along, out, length };
}

/** What a hero drew, for the tests and the mesh stats. */
export interface HeroResult {
  /** Every lettered line, as drawn. */
  readonly signs: readonly string[];
}

interface Targets { walls: VertexBuffer; glow: VertexBuffer; letters: VertexBuffer }

/**
 * The face frame: a box's local x is u (scaled), y up, z out. parts.ts frames run local +x along (oz, -ox); the
 * spec's u runs along `front.along`, so `dir` flips local x when the two disagree.
 */
class Face {
  readonly f: Frame;
  readonly k: number;
  readonly front: HeroFront;
  private readonly dir: number;
  constructor(front: HeroFront, measured: number) {
    this.front = front;
    const mid: Point = [front.a[0] + front.along[0] * front.length / 2, front.a[1] + front.along[1] * front.length / 2];
    this.f = frame(mid[0], mid[1], front.out);
    this.dir = front.along[0] * front.out[1] - front.along[1] * front.out[0] >= 0 ? 1 : -1;
    this.k = front.length / measured;
  }
  /** Local x for a spec u. */
  x(u: number): number { return this.dir * (u * this.k - this.front.length / 2); }
  /** A box over spec span [u0, u1] x [y0, y1] x [w0, w1]. */
  box(buffer: VertexBuffer, u0: number, u1: number, y0: number, y1: number, w0: number, w1: number, color: Rgb): void {
    const x0 = this.x(u0); const x1 = this.x(u1);
    box(buffer, this.f, [Math.min(x0, x1), y0, w0], [Math.max(x0, x1), y1, w1], color, { skip: ['back'] });
  }
  /** Scene point at spec (u, w). */
  at(u: number, w: number): [number, number] {
    const lx = this.x(u);
    return [this.f.x + this.f.oz * lx + this.f.ox * w, this.f.z - this.f.ox * lx + this.f.oz * w];
  }
  /** Reading direction for lettering on the face (left to right for a viewer facing it). */
  get right(): Point { return [this.f.oz, -this.f.ox]; }
}

/** A line of lettering on the face over [u0, u1], condensed or shrunk to fit; returns the text when it fits. */
function letter(t: Targets, face: Face, text: string, u0: number, u1: number, y: number, w: number, height: number, color: Rgb): string | null {
  const width = Math.abs(face.x(u1) - face.x(u0));
  let h = height;
  const condense = Math.max(0.45, Math.min(1, (width - 0.1) / textWidth(text, h)));
  while (textWidth(text, h, condense) > width && h > 0.12) h *= 0.92;
  if (textWidth(text, h, condense) > width) return null;
  const [x, z] = face.at((u0 + u1) / 2, w);
  emitText(t.letters, text, { x, y, z, right: face.right, height: h, condense, color });
  return text;
}

/**
 * The Apollo (w125cKit.js AP33): the pale terracotta lobby front with three pilasters, the cornice and balustrade,
 * the marquee across the west half of the ground floor, and the red blade on the first pilaster.
 */
function apollo(t: Targets, front: HeroFront): HeroResult {
  const face = new Face(front, MEASURED_FRONT.apollo);
  const C = HERO_COLORS;
  const signs: string[] = [];
  // Pilasters at u 3.47 / 6.95 / 10.42, 0.62 m wide, up to the cornice; the cornice 12.55-13.25 and the balustrade to 13.9.
  for (const u of [3.47, 6.95, 10.42]) face.box(t.walls, u - 0.31, u + 0.31, 0, 12.55, 0, 0.14, C.apolloTerracotta);
  face.box(t.walls, -0.4, 15.55, 12.55, 13.25, 0, 0.45, C.apolloTerracotta);
  face.box(t.walls, -0.2, 15.35, 13.25, 13.9, 0, 0.2, C.apolloTerracotta);
  // The marquee: u -0.4..7.25, soffit 3.05, top 5.05, 5.9 m deep; a bronze soffit, the blue body, bulbs on the edges.
  face.box(t.walls, -0.4, 7.25, 3.05, 3.25, 0, 5.9, C.bronze);
  face.box(t.walls, -0.4, 7.25, 3.25, 5.05, 0.2, 5.9, C.marqueeSteel);
  for (const y of [3.27, 4.9]) face.box(t.glow, -0.45, 7.3, y, y + 0.12, 5.9, 5.98, C.bulbs);
  const word = letter(t, face, 'APOLLO', -0.2, 7.05, 4.15, 6.0, 1.05, C.apolloNeon);
  if (word) signs.push(word);
  // The blade at u 3.47: y 10.2-20.5, 1.7 m out, 0.38 thick, its letters 1.4 m high every 1.65 m on both faces.
  const u = 3.47;
  face.box(t.walls, u - 0.19, u + 0.19, 10.2, 20.5, 0.14, 1.84, C.bladeRed);
  const [bx, bz] = face.at(u, 0.99);
  const side: Point = face.right;
  for (const s of [1, -1]) {
    const n: Point = [side[0] * s, side[1] * s];
    emitStackedText(t.letters, 'APOLLO', {
      x: bx + n[0] * 0.2, y: 15.35, z: bz + n[1] * 0.2, right: [n[1], -n[0]], height: 1.4, color: C.apolloNeon,
    }, 1.65 / 1.4 - 1);
    // The bulb borders down both edges of each blade face.
    for (const w of [0.2, 1.78]) {
      const [ex, ez] = face.at(u, w);
      box(t.glow, frame(ex + n[0] * 0.2, ez + n[1] * 0.2, n), [-0.05, 10.3, 0], [0.05, 20.4, 0.04], C.bulbs, { skip: ['back'] });
    }
  }
  signs.push('APOLLO');
  return { signs };
}

/**
 * Hotel Theresa (fk/custom/bid2.js TH): white terracotta bands at the balustraded band 9.3-10.3, under the arcaded
 * top storey at 40.45 and the parapet at 49.5 on every face; HOTEL THERESA painted in red-brown on the west wall at
 * 46.6 m; the three shops on 125th Street.
 */
function theresa(t: Targets, front: HeroFront, ring: readonly Point[]): HeroResult {
  const C = HERO_COLORS;
  const signs: string[] = [];
  // Bands on every outer edge, standing 0.25 m proud.
  for (let i = 0; i < ring.length; i++) {
    const f = heroFrontFromEdge(ring[i]!, ring[(i + 1) % ring.length]!, ring);
    if (f.length < 1) continue;
    const face = new Face(f, f.length);
    for (const [y0, y1] of [[9.3, 10.3], [40.2, 40.45], [49.2, 49.5]] as const) face.box(t.walls, -0.25, f.length + 0.25, y0, y1, 0, 0.25, C.theresaTrim);
  }
  // TH.front.shops, u from the boulevard corner: name boards over the shop windows (Valdrada gives no sign colours
  // for these three; bronze boards with the trim's cream letters are this port's estimate).
  const face = new Face(front, MEASURED_FRONT.theresa);
  for (const [u0, u1, name] of [[0.4, 5.2, 'FABULOUS OPTICAL'], [5.6, 12.6, 'MAC'], [13.0, 18.2, 'GOLD CITY']] as const) {
    face.box(t.walls, u0, u1, 3.9, 4.6, 0, 0.12, C.bronze);
    const drawn = letter(t, face, name, u0 + 0.15, u1 - 0.15, 4.25, 0.14, 0.45, C.theresaTrim);
    if (drawn) signs.push(drawn);
  }
  // The west wall: the edge whose outward normal points furthest west (scene -x).
  let west: HeroFront | null = null;
  for (let i = 0; i < ring.length; i++) {
    const f = heroFrontFromEdge(ring[i]!, ring[(i + 1) % ring.length]!, ring);
    if (f.length > 8 && (west === null || f.out[0] < west.out[0])) west = f;
  }
  if (west) {
    const face = new Face(west, west.length);
    // Valdrada centres the 8.4 x 4.0 m sign on the gable over the wall's first 15.8 m (u from the 124th Street end).
    const m = Math.min(7.9, west.length / 2);
    for (const [line, y] of [['HOTEL', 47.6], ['THERESA', 45.6]] as const) {
      const drawn = letter(t, face, line, m - 4.2, m + 4.2, y, 0.03, 1.6, C.theresaGhost);
      if (drawn) signs.push(drawn);
    }
  }
  return { signs };
}

/** The State Office Building (bid3.js w125-163): four limestone piers, the stone attic and the lettered base band. */
function sob(t: Targets, front: HeroFront, height: number): HeroResult {
  const face = new Face(front, MEASURED_FRONT.sob);
  const C = HERO_COLORS;
  const signs: string[] = [];
  const top = Math.max(height, 20);
  const attic = Math.min(77.9, top - 12);
  // Piers A-D rise the full height; the attic 77.9-89.8 and the base band 7.8-12.5 run between the outer piers.
  for (const [u0, u1] of [[4.9, 8.1], [14.8, 18.0], [42.8, 46.0], [53.1, 56.4]] as const) face.box(t.walls, u0, u1, 0, top, 0, 0.6, C.sobStone);
  face.box(t.walls, 4.9, 56.4, attic, top - 0.3, 0, 0.35, C.sobStone);
  face.box(t.walls, 4.9, 56.4, 7.8, 12.5, 0, 0.35, C.sobStone);
  const line = letter(t, face, 'ADAM CLAYTON POWELL JR. STATE OFFICE BUILDING', 19.3, 42.0, 9.6, 0.37, 0.6, C.sobLetters);
  if (line) signs.push(line);
  return { signs };
}

/** The Studio Museum (bid3.js w125-144): the bronze fascia lettered over the doors, the deep box frames, the blade. */
function studio(t: Targets, front: HeroFront, height: number): HeroResult {
  const face = new Face(front, MEASURED_FRONT.studio);
  const C = HERO_COLORS;
  const signs: string[] = [];
  // The bronze fascia across the entrance (Valdrada letters it at u 11.3-15.1, y 2.33, 0.3 m; widened here to the
  // fascia's full run so the pixel font stays legible from the far sidewalk).
  face.box(t.walls, 1.6, 21.6, 2.0, 2.75, 0, 0.3, HERO_COLORS.bronze);
  const fascia = letter(t, face, 'STUDIO MUSEUM IN HARLEM', 2.0, 21.2, 2.38, 0.32, 0.5, C.studioFascia);
  if (fascia) signs.push(fascia);
  // The stacked boxes' deep frames: a ledge at each box line (fk/custom/bid3.js stacks three boxes over the base).
  for (const y of [7.6, 15.2, 22.8]) if (y < height - 1) face.box(t.walls, 0, 22.9, y, y + 0.45, 0, 0.9, C.studioFrame);
  // The blade at the east end: a slab at u 0.75-1.25, y 13.7-22.5, the letters STUDIO MUSEUM down it on both faces.
  const y0 = Math.min(13.7, height - 9); const y1 = Math.min(22.5, height - 0.5);
  face.box(t.walls, 0.75, 1.25, y0, y1, 0.3, 1.5, C.studioFrame);
  const [bx, bz] = face.at(1.0, 0.9);
  const side = face.right;
  const step = (y1 - y0) / 13;
  for (const s of [1, -1]) {
    const n: Point = [side[0] * s, side[1] * s];
    emitStackedText(t.letters, 'STUDIO MUSEUM', {
      x: bx + n[0] * 0.27, y: (y0 + y1) / 2, z: bz + n[1] * 0.27, right: [n[1], -n[0]], height: step * 0.82, color: C.studioBlade,
    }, 1 / 0.82 - 1);
  }
  signs.push('STUDIO MUSEUM');
  return { signs };
}

function heroFrontFromEdge(a: Point, b: Point, ring: readonly Point[]): HeroFront {
  let cx = 0; let cz = 0;
  for (const p of ring) { cx += p[0]; cz += p[1]; }
  return heroFront([a[0], a[1], b[0], b[1]], [cx / ring.length, cz / ring.length]);
}

/** Draw one hero onto the city's buffers. `ring` is the footprint (ccw), `height` its extrusion. */
export function emitHero(key: HeroKey, f: readonly number[], ring: readonly Point[], height: number, targets: Targets): HeroResult {
  let cx = 0; let cz = 0;
  for (const p of ring) { cx += p[0]; cz += p[1]; }
  const front = heroFront(f, [cx / ring.length, cz / ring.length]);
  switch (key) {
    case 'apollo': return apollo(targets, front);
    case 'theresa': return theresa(targets, front, ring);
    case 'sob': return sob(targets, front, height);
    case 'studio': return studio(targets, front, height);
  }
}
