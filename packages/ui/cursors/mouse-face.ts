/**
 * Geometry of the mouse face cursor, on a 100-unit square with the centre of
 * the face at (50, 50). Pure data, shared by the Skia drawing and the tests.
 *
 * The build follows NeonBlade's fox face: straight stroked segments with
 * round caps, a top bar, cheeks, and a chin that closes to a point. A mouse
 * swaps the fox's pointed ears for two large round ones (drawn as octagons
 * to keep the faceted line style), stretches the chin into a long, narrow
 * snout, and adds a nose, eyes and whiskers.
 */
export type Pt = readonly [x: number, y: number];

const C = 50;
const mirror = ([x, y]: Pt): Pt => [2 * C - x, y];

/** Regular polygon points, first vertex at `start` radians, clockwise in screen space. */
function ring(cx: number, cy: number, r: number, sides: number, start: number): Pt[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / sides;
    return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)] as Pt;
  });
}

// Head: a top bar between the ears, cheeks that widen, then a long narrow snout.
const TOP_L: Pt = [38, 36];
const CHEEK_L: Pt = [26, 54];
const SNOUT: Pt = [50, 90];

// Ears: big octagons (flat on top) set on the head's upper corners.
const EAR_L = { cx: 27, cy: 24.5, r: 16.5 };
const EAR_INNER_R = 9.5;
const OCT = Math.PI / 8; // 22.5 deg: flat top and sides

const earL = ring(EAR_L.cx, EAR_L.cy, EAR_L.r, 8, OCT);
// Inner ear: five sides of a smaller octagon, open toward the head.
const innerL = ring(EAR_L.cx - 1.5, EAR_L.cy - 1.5, EAR_INNER_R, 8, OCT);
const innerOpenL = [innerL[3]!, innerL[4]!, innerL[5]!, innerL[6]!, innerL[7]!, innerL[0]!];

/** Polylines to stroke (each is open; repeat the first point to close). */
export interface MouseFaceGeometry {
  lines: Pt[][];
  /** Filled shapes: the face outline and both ears (for `fillOpacity`). */
  fills: Pt[][];
  /** The nose diamond, filled solid. */
  nose: Pt[];
}

function build(): MouseFaceGeometry {
  const head: Pt[] = [TOP_L, mirror(TOP_L), mirror(CHEEK_L), SNOUT, CHEEK_L, TOP_L];
  const earR = earL.map(mirror);
  const close = (p: Pt[]) => [...p, p[0]!];
  // Bridge of the nose, like the fox's centre line, stopping at the nose.
  const bridge: Pt[] = [[C, 36], [C, 80]];
  const eyeL: Pt[] = [[36.5, 54], [42, 57.5]];
  // Whiskers fan out from beside the snout.
  const whiskersL: Pt[][] = [
    [[37, 71], [12, 64]],
    [[38, 75], [10, 75]],
    [[39, 79], [13, 86]],
  ];
  const nose: Pt[] = [[C, 81], [C + 3.6, 85.2], [C, 90.5], [C - 3.6, 85.2]];
  return {
    lines: [
      head,
      bridge,
      close(earL),
      close(earR),
      innerOpenL,
      innerOpenL.map(mirror),
      eyeL,
      eyeL.map(mirror),
      ...whiskersL,
      ...whiskersL.map((w) => w.map(mirror)),
    ],
    fills: [head, earL, earR],
    nose,
  };
}

export const MOUSE_FACE: MouseFaceGeometry = build();

/** SVG path data for a list of polylines; `closed` adds Z to each. */
export function toPathData(polys: readonly (readonly Pt[])[], closed = false): string {
  return polys
    .map((p) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + (closed ? ' Z' : ''))
    .join(' ');
}

/**
 * Line weight: NeonBlade's fox draws `strokeWidth` on an 83-unit box, so the
 * same number on this 100-unit box is scaled up to match its weight at the
 * same pixel size.
 */
export const STROKE_SCALE = 100 / 83;
