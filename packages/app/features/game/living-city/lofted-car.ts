// Adapted from mrdoob/slop-newyork @ be65d0a, js/actor-models.js LoftGeometry, BODY_SPECS, buildCarGeometry,
// buildCarProxyGeometry, buildLoftedBusBodyGeometry (MIT, © 2026 Mr.doob). Slop's LoftGeometry is itself ported from
// three.js examples/jsm/geometries/LoftGeometry.js, and its car bodies are adapted from three.js
// examples/jsm/generators/city/CarGenerator.js (both MIT, three.js authors; both present in the installed
// three@0.186.1).
//
// Lofted vehicle bodies as plain data. Slop builds these with three's geometry classes (LoftGeometry,
// LatheGeometry, ExtrudeGeometry, CircleGeometry, BoxGeometry) and BufferGeometryUtils.mergeGeometries. This port
// writes the same surfaces into number arrays instead, for two reasons:
//
// - The worklet render runtime (render-runtime/game-render.ts) must be able to build a car. The installed
//   LoftGeometry.js and BufferGeometryUtils.js import from 'three', not 'three/webgpu', so they are a second module
//   graph on that runtime; this file imports nothing at all and runs anywhere a function does.
// - Node tests can pin triangle counts and watertightness without three.
//
// Every builder is a plain function of its spec. Slop memoises layouts on the spec objects (`spec._body`,
// `spec._layout`); this port recomputes them so no module-level object is ever mutated.
//
// Differences from Slop, each kept small and listed so a reviewer can check them:
// - LoftGeometry caps use the ear clipper below instead of ShapeUtils.triangulateShape (Earcut). The section
//   outlines here are simple polygons, so both produce a valid fan of the same outline.
// - ExtrudeGeometry (Slop's `roundedBox`, the taxi sign) becomes a four-section loft: the cap outline, the
//   bevel-expanded outline twice, the cap outline again. That is ExtrudeGeometry with bevelSegments 1, with the side
//   walls and bevels lofted rather than extruded.
// - BoxGeometry becomes an indexed 24-vertex box (same faces and normals).
// - Bus wheels are static tyres in the body mesh (TRIM part). Slop draws them as separate spinning instanced meshes
//   with createBusWheelMaterial; nyc-mon's sim has no wheel spin to drive.
// - The NYPD light bar and the player-car wheel builders are not ported: nyc-mon has no police kind and no driven car.

/** [x, y, z] in metres, vehicle-local: +Z forward, +Y up, +X to the driver's left. */
export type V3 = [number, number, number];
type V2 = [number, number];

/** Part ids painted by the lofted car material (Slop `CAR_PARTS`). */
export const CAR_PARTS = { BODY: 0, WINDOW: 1, TYRE: 2, ALLOY: 3, TRIM: 4, MIRROR: 5, SIGN: 6, FRONT: 7, REAR: 8 } as const;
/** Part ids painted by the lofted bus material (Slop `BUS_PARTS`). */
export const BUS_PARTS = { BODY: 0, TRIM: 1, POD: 2 } as const;

// --- Design tables ----------------------------------------------------------------------------------------------
// Curves are [z, value] control points (z = +front); nose / tail entries are [length, tip value, superellipse
// exponent] roundings of the same quantities into the tips. Values are Slop's, unchanged.

type Curve = readonly (readonly [number, number])[];
type Rounding = readonly [number, number, number];
type RoundingKey = 'halfWidth' | 'edge' | 'crown' | 'sill' | 'shoulder';

/** What the body loft reads: shared by cars and the bus. */
export interface LoftBodySpec {
  readonly name: string;
  readonly zFront: number;
  readonly zRear: number;
  readonly wheelRadius: number;
  readonly wheelZ: number;
  readonly wheelX: number;
  readonly archGap: number;
  readonly archFlare: number;
  readonly tuck: number;
  readonly halfWidth: Curve;
  readonly sill: Curve;
  readonly shoulder: Curve;
  readonly edge: Curve;
  readonly crown: Curve;
  readonly tumble: Curve;
  readonly nose: Readonly<Partial<Record<RoundingKey, Rounding>>>;
  readonly tail: Readonly<Partial<Record<RoundingKey, Rounding>>>;
  readonly stationStep?: number;
  readonly lowerRound?: number;
  readonly upperRound?: number;
  readonly upperSamples?: readonly number[];
}

export interface CabinSpec {
  readonly cowl: number;
  readonly roofFront: number;
  readonly roofRear: number;
  readonly deck: number;
  readonly roofY: Curve;
  readonly rail: readonly [number, number];
  readonly inset: number;
  readonly bulge: number;
  readonly roofEdge: number;
  readonly roofCrown: number;
  readonly roofRound: number;
  readonly pillars: readonly number[];
}

export interface CarBodySpec extends LoftBodySpec {
  readonly name: CarBodyName;
  readonly cabin: CabinSpec;
  readonly doors: readonly number[];
  readonly handles: readonly number[];
  /** centre |x|, y, half-width, half-height */
  readonly headlight: readonly [number, number, number, number];
  readonly taillight: readonly [number, number, number, number];
  /** y, half-width, half-height */
  readonly grille: readonly [number, number, number];
  readonly intake: readonly [number, number, number];
  /** front / rear plate centre heights */
  readonly plates: readonly [number, number];
  readonly bumperLine: readonly [number, number];
  /** front / rear trim: [centre height, half-height] */
  readonly bumpers: readonly [readonly [number, number], readonly [number, number]];
  readonly chrome: boolean;
  readonly cladding: number;
  readonly sign: boolean;
  readonly rails: boolean;
  readonly rearWiper: boolean;
}

export type CarBodyName = 'sedan' | 'suv' | 'taxi';

const SEDAN: CarBodySpec = {
  name: 'sedan',
  zFront: 2.25,
  zRear: -2.25,
  wheelRadius: 0.35,
  wheelZ: 1.38,
  wheelX: 0.83,
  archGap: 0.065,
  archFlare: 0.02,
  tuck: 0.075,
  halfWidth: [[2.25, 0.91], [1.38, 0.922], [0, 0.928], [-1.38, 0.926], [-2.25, 0.915]],
  sill: [[2.25, 0.29], [1.2, 0.265], [-1.2, 0.265], [-2.25, 0.3]],
  shoulder: [[2.25, 0.66], [0, 0.7], [-2.25, 0.76]],
  edge: [[2.1, 0.79], [1.5, 0.85], [0.85, 0.935], [0.55, 0.955], [-1.0, 0.985], [-1.62, 0.975], [-2.1, 0.91]],
  crown: [[2.1, 0.035], [0.95, 0.03], [0.66, 0.004], [-1.56, 0.004], [-1.78, 0.016], [-2.25, 0.012]],
  tumble: [[2.25, 0.11], [0.9, 0.09], [-1.6, 0.085], [-2.25, 0.105]],
  nose: { halfWidth: [0.3, 0.7, 3], edge: [0.12, 0.77, 3], crown: [0.12, 0.01, 2], sill: [0.13, 0.33, 2], shoulder: [0.2, 0.59, 2.4] },
  tail: { halfWidth: [0.3, 0.72, 2.6], edge: [0.11, 0.905, 3], crown: [0.11, 0.008, 2], sill: [0.14, 0.35, 2], shoulder: [0.2, 0.69, 2.4] },
  cabin: {
    cowl: 0.86,
    roofFront: 0.0,
    roofRear: -1.0,
    deck: -1.68,
    roofY: [[0.0, 1.435], [-0.5, 1.455], [-1.0, 1.42]],
    rail: [0.645, 0.625],
    inset: 0.035,
    bulge: 0.012,
    roofEdge: 0.05,
    roofCrown: 0.035,
    roofRound: 4,
    pillars: [-0.3],
  },
  doors: [0.84, -0.3, -1.02],
  handles: [-0.13, -0.86],
  headlight: [0.59, 0.69, 0.23, 0.055],
  taillight: [0.575, 0.795, 0.255, 0.064],
  grille: [0.68, 0.31, 0.06],
  intake: [0.37, 0.46, 0.045],
  plates: [0.555, 0.68],
  bumperLine: [0.775, 0.565],
  bumpers: [[0.46, 0.03], [0.49, 0.035]],
  chrome: true,
  cladding: 0,
  sign: false,
  rails: false,
  rearWiper: false,
};

const SUV: CarBodySpec = {
  name: 'suv',
  zFront: 2.3,
  zRear: -2.3,
  wheelRadius: 0.39,
  wheelZ: 1.4,
  wheelX: 0.87,
  archGap: 0.075,
  archFlare: 0.03,
  tuck: 0.07,
  halfWidth: [[2.3, 0.948], [1.4, 0.96], [0, 0.966], [-1.4, 0.964], [-2.3, 0.956]],
  sill: [[2.3, 0.39], [1.2, 0.35], [-1.2, 0.35], [-2.3, 0.41]],
  shoulder: [[2.3, 0.8], [0, 0.84], [-2.3, 0.88]],
  edge: [[2.1, 0.99], [1.5, 1.045], [0.85, 1.1], [0.6, 1.12], [-1.0, 1.145], [-2.0, 1.175], [-2.3, 1.18]],
  crown: [[2.1, 0.035], [0.9, 0.03], [0.6, 0.004], [-2.3, 0.004]],
  tumble: [[2.3, 0.1], [0.9, 0.08], [-2.3, 0.08]],
  nose: { halfWidth: [0.27, 0.76, 3], edge: [0.13, 0.96, 3], crown: [0.13, 0.01, 2], sill: [0.12, 0.42, 2], shoulder: [0.2, 0.74, 2.4] },
  tail: { halfWidth: [0.24, 0.8, 2.6], edge: [0.08, 1.13, 3], crown: [0.08, 0, 2], sill: [0.14, 0.44, 2], shoulder: [0.18, 0.84, 2.4] },
  cabin: {
    cowl: 0.8,
    roofFront: 0.08,
    roofRear: -1.96,
    deck: -2.2,
    roofY: [[0.08, 1.735], [-0.9, 1.76], [-1.96, 1.745]],
    rail: [0.71, 0.7],
    inset: 0.035,
    bulge: 0.012,
    roofEdge: 0.055,
    roofCrown: 0.03,
    roofRound: 4,
    pillars: [-0.3, -1.18],
  },
  doors: [0.78, -0.3, -1.18],
  handles: [-0.13, -1.0],
  headlight: [0.64, 0.86, 0.235, 0.065],
  taillight: [0.745, 0.985, 0.105, 0.13],
  grille: [0.83, 0.36, 0.095],
  intake: [0.465, 0.44, 0.04],
  plates: [0.66, 0.82],
  bumperLine: [0.965, 0.655],
  bumpers: [[0.56, 0.04], [0.56, 0.04]],
  chrome: false,
  cladding: 0.5,
  sign: false,
  rails: true,
  rearWiper: true,
};

/** Slop's car design tables. The taxi is the sedan body with the medallion roof sign. */
export const BODY_SPECS: Readonly<Record<CarBodyName, CarBodySpec>> = {
  sedan: SEDAN,
  suv: SUV,
  taxi: { ...SEDAN, name: 'taxi', sign: true },
};

/** A 40-ft low-floor MTA bus (Slop `BUS_SPEC`). */
export interface BusSpec extends LoftBodySpec {
  readonly name: 'bus';
  /** Midpoint |x| and y of each pair of white lamps (the outer amber indicator excluded). */
  readonly headlight: readonly [number, number];
  /** How far the top of the windshield leans back, metres. */
  readonly rake: number;
  /** Side window band, y. */
  readonly window: readonly [number, number];
  /** Curb-side (-x) door z ranges. */
  readonly frontDoor: readonly [number, number];
  readonly rearDoor: readonly [number, number];
}

export const BUS_SPEC: BusSpec = {
  name: 'bus',
  headlight: [0.79, 0.8],
  zFront: 5.78,
  zRear: -5.78,
  wheelRadius: 0.48,
  wheelZ: 3.6,
  wheelX: 1.24,
  archGap: 0.09,
  archFlare: 0,
  tuck: 0.05,
  stationStep: 0.62,
  lowerRound: 2.6,
  upperRound: 6,
  upperSamples: [0.3, 0.56, 0.74, 0.88, 1],
  halfWidth: [[5.78, 1.3], [-5.78, 1.3]],
  sill: [[5.78, 0.36], [-5.78, 0.36]],
  shoulder: [[5.78, 1.05], [-5.78, 1.05]],
  edge: [[5.78, 2.96], [-5.78, 2.96]],
  crown: [[5.78, 0.045], [-5.78, 0.045]],
  tumble: [[5.78, 0.17], [-5.78, 0.17]],
  nose: { halfWidth: [0.28, 1.02, 2], edge: [0.24, 2.68, 2], crown: [0.24, 0.005, 2], sill: [0.07, 0.44, 2], shoulder: [0.2, 0.95, 2] },
  tail: { halfWidth: [0.24, 1.06, 2], edge: [0.2, 2.72, 2], crown: [0.2, 0.005, 2], sill: [0.09, 0.46, 2], shoulder: [0.2, 0.95, 2] },
  rake: 0.15,
  window: [1.24, 2.44],
  frontDoor: [4.36, 5.36],
  rearDoor: [-1.52, -0.5],
};

/** Lamp heights (front, rear) and centres across the car, for flares and spot placement (Slop sets these on the spec). */
export function lampLayout(spec: CarBodySpec): { lamps: readonly [number, number]; lampX: readonly [number, number] } {
  return { lamps: [spec.headlight[1], spec.taillight[1]], lampX: [spec.headlight[0], spec.taillight[0]] };
}

// --- Mesh data ----------------------------------------------------------------------------------------------------

/** One indexed surface with per-vertex normals and uvs (a three BufferGeometry, as arrays). */
export interface Part {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

/** A merged vehicle mesh, ready for BufferAttributes. `partId` is one float per vertex. */
export interface VehicleMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly partIds: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly triangles: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function emptyPart(): Part {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

/** three's BufferGeometry.computeVertexNormals for indexed geometry: area-weighted face normals, normalised. */
export function computeVertexNormals(part: Part): void {
  const p = part.positions;
  const n = new Array<number>(p.length).fill(0);
  const idx = part.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]! * 3;
    const b = idx[i + 1]! * 3;
    const c = idx[i + 2]! * 3;
    // cb x ab, as three does it.
    const cbx = p[c]! - p[b]!;
    const cby = p[c + 1]! - p[b + 1]!;
    const cbz = p[c + 2]! - p[b + 2]!;
    const abx = p[a]! - p[b]!;
    const aby = p[a + 1]! - p[b + 1]!;
    const abz = p[a + 2]! - p[b + 2]!;
    const nx = cby * abz - cbz * aby;
    const ny = cbz * abx - cbx * abz;
    const nz = cbx * aby - cby * abx;
    for (const v of [a, b, c]) {
      n[v] = n[v]! + nx;
      n[v + 1] = n[v + 1]! + ny;
      n[v + 2] = n[v + 2]! + nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i]!, n[i + 1]!, n[i + 2]!);
    if (l > 0) {
      n[i] = n[i]! / l;
      n[i + 1] = n[i + 1]! / l;
      n[i + 2] = n[i + 2]! / l;
    }
  }
  part.normals = n;
}

/** Applies a 3x3 linear map (row-major) to positions and normals, then a translation to positions. */
function transformPart(part: Part, m: readonly number[], t: V3 = [0, 0, 0]): Part {
  const map = (arr: number[], translate: boolean) => {
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i]!;
      const y = arr[i + 1]!;
      const z = arr[i + 2]!;
      arr[i] = m[0]! * x + m[1]! * y + m[2]! * z + (translate ? t[0] : 0);
      arr[i + 1] = m[3]! * x + m[4]! * y + m[5]! * z + (translate ? t[1] : 0);
      arr[i + 2] = m[6]! * x + m[7]! * y + m[8]! * z + (translate ? t[2] : 0);
    }
  };
  map(part.positions, true);
  map(part.normals, false);
  return part;
}

/** Object3D-style rotations (three's Matrix4.makeRotationX/Y/Z), applied about the origin. */
export function rotateX(part: Part, a: number): Part {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return transformPart(part, [1, 0, 0, 0, c, -s, 0, s, c]);
}
export function rotateY(part: Part, a: number): Part {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return transformPart(part, [c, 0, s, 0, 1, 0, -s, 0, c]);
}
export function rotateZ(part: Part, a: number): Part {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return transformPart(part, [c, -s, 0, s, c, 0, 0, 0, 1]);
}
export function translate(part: Part, x: number, y: number, z: number): Part {
  return transformPart(part, [1, 0, 0, 0, 1, 0, 0, 0, 1], [x, y, z]);
}

// --- Cap triangulation ------------------------------------------------------------------------------------------

function signedArea(c: readonly V2[]): number {
  let a = 0;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) a += c[j]![0] * c[i]![1] - c[i]![0] * c[j]![1];
  return a * 0.5;
}

function pointInTriangle(p: V2, a: V2, b: V2, c: V2): boolean {
  const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
  const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/**
 * Ear clipping for a counter-clockwise simple polygon: n - 2 triangles as index triples into `contour`, each
 * counter-clockwise. Collinear runs (the mirrored crown point sits between its neighbours) are clipped once no
 * convex ear remains.
 */
export function triangulateContour(contour: readonly V2[]): [number, number, number][] {
  const remaining = contour.map((_, i) => i);
  const faces: [number, number, number][] = [];
  let guard = contour.length * contour.length;
  while (remaining.length > 3 && guard-- > 0) {
    let clipped = false;
    let fallback = -1;
    let fallbackCross = -Infinity;
    for (let k = 0; k < remaining.length; k++) {
      const ia = remaining[(k + remaining.length - 1) % remaining.length]!;
      const ib = remaining[k]!;
      const ic = remaining[(k + 1) % remaining.length]!;
      const a = contour[ia]!;
      const b = contour[ib]!;
      const c = contour[ic]!;
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cross > fallbackCross) {
        fallbackCross = cross;
        fallback = k;
      }
      if (cross <= 1e-12) continue;
      let blocked = false;
      for (const j of remaining) {
        if (j === ia || j === ib || j === ic) continue;
        const p = contour[j]!;
        if ((p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1]) || (p[0] === c[0] && p[1] === c[1])) continue;
        if (pointInTriangle(p, a, b, c)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      faces.push([ia, ib, ic]);
      remaining.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) {
      const k = fallback;
      faces.push([
        remaining[(k + remaining.length - 1) % remaining.length]!,
        remaining[k]!,
        remaining[(k + 1) % remaining.length]!,
      ]);
      remaining.splice(k, 1);
    }
  }
  if (remaining.length === 3) faces.push([remaining[0]!, remaining[1]!, remaining[2]!]);
  return faces;
}

// --- LoftGeometry (pure) ------------------------------------------------------------------------------------------

export interface LoftOptions {
  readonly closed?: boolean;
  readonly capStart?: boolean;
  readonly capEnd?: boolean;
}

/**
 * Slop's LoftGeometry, line for line, into arrays: rows of sections, uvs from accumulated row / column distances,
 * optional planar caps oriented away from the neighbouring section, smooth normals, and the closed-ring seam
 * normals averaged so the duplicated seam column shades as one.
 */
export function loft(sections: readonly (readonly V3[])[], options: LoftOptions = {}): Part {
  const { closed = true, capStart = false, capEnd = false } = options;
  const part = emptyPart();
  const rows = sections.length;
  if (rows < 2) return part;
  const columns = sections[0]!.length;
  for (let i = 1; i < rows; i++) if (sections[i]!.length !== columns) return part;
  const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  const pointsPerRow = closed ? columns + 1 : columns;
  const { positions: vertices, uvs, indices } = part;

  const rowU = [0];
  for (let i = 1; i < rows; i++) {
    let d = 0;
    for (let j = 0; j < columns; j++) d += dist(sections[i]![j]!, sections[i - 1]![j]!);
    rowU.push(rowU[i - 1]! + d / columns);
  }
  const totalU = rowU[rows - 1]!;

  for (let i = 0; i < rows; i++) {
    const section = sections[i]!;
    const colV = [0];
    for (let j = 1; j < pointsPerRow; j++) colV.push(colV[j - 1]! + dist(section[j % columns]!, section[(j - 1) % columns]!));
    const totalV = colV[pointsPerRow - 1]!;
    for (let j = 0; j < pointsPerRow; j++) {
      const point = section[j % columns]!;
      vertices.push(point[0], point[1], point[2]);
      uvs.push(totalU > 0 ? rowU[i]! / totalU : i / (rows - 1), totalV > 0 ? colV[j]! / totalV : j / (pointsPerRow - 1));
    }
  }

  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < pointsPerRow - 1; j++) {
      const a = i * pointsPerRow + j;
      const b = i * pointsPerRow + j + 1;
      const c = (i + 1) * pointsPerRow + j + 1;
      const d = (i + 1) * pointsPerRow + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const generateCap = (sectionIndex: number) => {
    const section = sections[sectionIndex]!;
    const centroid: V3 = [0, 0, 0];
    const normal: V3 = [0, 0, 0];
    for (let i = 0; i < columns; i++) {
      const p = section[i]!;
      const q = section[(i + 1) % columns]!;
      centroid[0] += p[0];
      centroid[1] += p[1];
      centroid[2] += p[2];
      // Newell's method, as LoftGeometry.generateCap.
      normal[0] += (p[1] - q[1]) * (p[2] + q[2]);
      normal[1] += (p[2] - q[2]) * (p[0] + q[0]);
      normal[2] += (p[0] - q[0]) * (p[1] + q[1]);
    }
    centroid[0] /= columns;
    centroid[1] /= columns;
    centroid[2] /= columns;
    const nl = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    normal[0] /= nl;
    normal[1] /= nl;
    normal[2] /= nl;
    const neighbor = sections[sectionIndex === 0 ? 1 : rows - 2]!;
    const toNeighbor: V3 = [0, 0, 0];
    for (let i = 0; i < columns; i++) {
      toNeighbor[0] += neighbor[i]![0];
      toNeighbor[1] += neighbor[i]![1];
      toNeighbor[2] += neighbor[i]![2];
    }
    toNeighbor[0] = toNeighbor[0] / columns - centroid[0];
    toNeighbor[1] = toNeighbor[1] / columns - centroid[1];
    toNeighbor[2] = toNeighbor[2] / columns - centroid[2];
    if (normal[0] * toNeighbor[0] + normal[1] * toNeighbor[1] + normal[2] * toNeighbor[2] > 0) {
      normal[0] = -normal[0];
      normal[1] = -normal[1];
      normal[2] = -normal[2];
    }
    let tangent: V3 = Math.abs(normal[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
    const cross = (u: V3, v: V3): V3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const bit = cross(normal, tangent);
    const bl = Math.hypot(bit[0], bit[1], bit[2]) || 1;
    const bitangent: V3 = [bit[0] / bl, bit[1] / bl, bit[2] / bl];
    tangent = cross(bitangent, normal);

    let points = section.slice();
    let contour: V2[] = points.map((p) => {
      const d: V3 = [p[0] - centroid[0], p[1] - centroid[1], p[2] - centroid[2]];
      return [d[0] * tangent[0] + d[1] * tangent[1] + d[2] * tangent[2], d[0] * bitangent[0] + d[1] * bitangent[1] + d[2] * bitangent[2]];
    });
    if (signedArea(contour) < 0) {
      contour = contour.reverse();
      points = points.reverse();
    }
    const faces = triangulateContour(contour);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of contour) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const width = Math.max(maxX - minX, Number.EPSILON);
    const height = Math.max(maxY - minY, Number.EPSILON);
    const offset = vertices.length / 3;
    for (let i = 0; i < columns; i++) {
      const p = points[i]!;
      vertices.push(p[0], p[1], p[2]);
      uvs.push((contour[i]![0] - minX) / width, (contour[i]![1] - minY) / height);
    }
    for (const f of faces) indices.push(offset + f[0], offset + f[1], offset + f[2]);
  };

  if (capStart) generateCap(0);
  if (capEnd) generateCap(rows - 1);

  computeVertexNormals(part);
  if (closed) {
    const n = part.normals;
    for (let i = 0; i < rows; i++) {
      const a = i * pointsPerRow * 3;
      const b = (i * pointsPerRow + pointsPerRow - 1) * 3;
      const x = n[a]! + n[b]!;
      const y = n[a + 1]! + n[b + 1]!;
      const z = n[a + 2]! + n[b + 2]!;
      const l = Math.hypot(x, y, z) || 1;
      n[a] = n[b] = x / l;
      n[a + 1] = n[b + 1] = y / l;
      n[a + 2] = n[b + 2] = z / l;
    }
  }
  return part;
}

// --- Primitive parts (LatheGeometry, CircleGeometry, BoxGeometry, rounded boxes) -----------------------------------

/** three's LatheGeometry: the profile revolved about +Y, with its profile-derived normals. */
export function lathe(points: readonly V2[], segments: number): Part {
  const part = emptyPart();
  const init: V3[] = [];
  let prev: V3 = [0, 0, 0];
  for (let j = 0; j < points.length; j++) {
    if (j === points.length - 1) {
      // three pushes `prevNormal` here unnormalised; normalising keeps the same direction with a unit length.
      const l = Math.hypot(prev[0], prev[1]) || 1;
      init.push([prev[0] / l, prev[1] / l, 0]);
      continue;
    }
    const dx = points[j + 1]![0] - points[j]![0];
    const dy = points[j + 1]![1] - points[j]![1];
    const cur: V3 = [dy, -dx, 0];
    const sum: V3 = j === 0 ? cur : [cur[0] + prev[0], cur[1] + prev[1], 0];
    const l = Math.hypot(sum[0], sum[1]) || 1;
    init.push([sum[0] / l, sum[1] / l, 0]);
    prev = cur;
  }
  for (let i = 0; i <= segments; i++) {
    const phi = (i / segments) * Math.PI * 2;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    for (let j = 0; j < points.length; j++) {
      part.positions.push(points[j]![0] * s, points[j]![1], points[j]![0] * c);
      part.uvs.push(i / segments, j / (points.length - 1));
      part.normals.push(init[j]![0] * s, init[j]![1], init[j]![0] * c);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < points.length - 1; j++) {
      const base = j + i * points.length;
      const a = base;
      const b = base + points.length;
      const c = base + points.length + 1;
      const d = base + 1;
      part.indices.push(a, b, d, c, d, b);
    }
  }
  return part;
}

/** three's CircleGeometry in the XY plane facing +Z: a centre vertex and segments + 1 rim vertices. */
export function circle(radius: number, segments: number, thetaStart = 0, thetaLength = Math.PI * 2): Part {
  const part = emptyPart();
  part.positions.push(0, 0, 0);
  part.normals.push(0, 0, 1);
  part.uvs.push(0.5, 0.5);
  for (let s = 0; s <= segments; s++) {
    const a = thetaStart + (s / segments) * thetaLength;
    const x = radius * Math.cos(a);
    const y = radius * Math.sin(a);
    part.positions.push(x, y, 0);
    part.normals.push(0, 0, 1);
    part.uvs.push((x / radius + 1) / 2, (y / radius + 1) / 2);
  }
  for (let i = 1; i <= segments; i++) part.indices.push(i, i + 1, 0);
  return part;
}

/** An axis-aligned box centred on the origin, 24 vertices and 12 triangles, as BoxGeometry(sx, sy, sz). */
export function box(sx: number, sy: number, sz: number): Part {
  const part = emptyPart();
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const faces: [V3, number[]][] = [
    [[1, 0, 0], [hx, -hy, hz, hx, -hy, -hz, hx, hy, -hz, hx, hy, hz]],
    [[-1, 0, 0], [-hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz]],
    [[0, 1, 0], [-hx, hy, -hz, -hx, hy, hz, hx, hy, hz, hx, hy, -hz]],
    [[0, -1, 0], [-hx, -hy, hz, -hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz]],
    [[0, 0, 1], [-hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz]],
    [[0, 0, -1], [hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz]],
  ];
  for (const [n, c] of faces) {
    const base = part.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      part.positions.push(c[i * 3]!, c[i * 3 + 1]!, c[i * 3 + 2]!);
      part.normals.push(n[0], n[1], n[2]);
    }
    part.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    part.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return part;
}

/** Quadratic curve samples from p0 through control c to p1, excluding p0 (Shape.quadraticCurveTo with curveSegments). */
function quad(p0: V2, c: V2, p1: V2, segments: number): V2[] {
  const out: V2[] = [];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

/** Slop's roundedRectShape outline, counter-clockwise from the bottom edge, corners sampled with 2 segments. */
function roundedRectOutline(hw: number, hh: number, r: number, segments = 2): V2[] {
  const pts: V2[] = [[-hw + r, -hh], [hw - r, -hh]];
  pts.push(...quad([hw - r, -hh], [hw, -hh], [hw, -hh + r], segments));
  pts.push([hw, hh - r]);
  pts.push(...quad([hw, hh - r], [hw, hh], [hw - r, hh], segments));
  pts.push([-hw + r, hh]);
  pts.push(...quad([-hw + r, hh], [-hw, hh], [-hw, hh - r], segments));
  pts.push([-hw, -hh + r]);
  pts.push(...quad([-hw, -hh + r], [-hw, -hh], [-hw + r, -hh], segments));
  // The last sample lands on the first point; drop it so the ring has no duplicate.
  pts.pop();
  return pts;
}

/**
 * A closed prism along z through an outline: the cap outline at both ends and the bevel-grown outline between, the
 * shape ExtrudeGeometry makes with bevelSegments 1. `capOutline` and `bodyOutline` share a vertex count.
 */
function beveledPrism(capOutline: readonly V2[], bodyOutline: readonly V2[], z0: number, z1: number, bevel: number): Part {
  const ring = (o: readonly V2[], z: number) => o.map(([x, y]) => [x, y, z] as V3);
  // Sections run -z to +z. LoftGeometry wants each counter-clockwise as seen from the end (+z) looking back, which
  // is how a counter-clockwise xy outline already reads.
  const sections = bevel > 0
    ? [ring(capOutline, z0), ring(bodyOutline, z0 + bevel), ring(bodyOutline, z1 - bevel), ring(capOutline, z1)]
    : [ring(bodyOutline, z0), ring(bodyOutline, z1)];
  return loft(sections, { capStart: true, capEnd: true });
}

/** Slop's roundedBox: a rounded box extruded along z, centred on the origin, with a one-segment bevel. */
export function roundedBox(hw: number, hh: number, depth: number, r: number, bevel = 0.012): Part {
  const capR = Math.max(0.002, r - bevel);
  const cap = roundedRectOutline(hw - bevel, hh - bevel, capR);
  const body = roundedRectOutline(hw, hh, capR + bevel);
  return beveledPrism(cap, body, -depth / 2, depth / 2, bevel);
}

/** Outward offset of a counter-clockwise outline by `d`, along each vertex's bisector (ExtrudeGeometry getBevelVec). */
function offsetOutline(o: readonly V2[], d: number): V2[] {
  return o.map((p, i) => {
    const a = o[(i + o.length - 1) % o.length]!;
    const b = o[(i + 1) % o.length]!;
    const e0: V2 = [p[0] - a[0], p[1] - a[1]];
    const e1: V2 = [b[0] - p[0], b[1] - p[1]];
    const l0 = Math.hypot(e0[0], e0[1]) || 1;
    const l1 = Math.hypot(e1[0], e1[1]) || 1;
    // Outward normals of a counter-clockwise ring: (dy, -dx).
    const n0: V2 = [e0[1] / l0, -e0[0] / l0];
    const n1: V2 = [e1[1] / l1, -e1[0] / l1];
    const bx = n0[0] + n1[0];
    const by = n0[1] + n1[1];
    const bl = Math.hypot(bx, by) || 1;
    const cosHalf = Math.max(0.25, (bx * n0[0] + by * n0[1]) / bl);
    return [p[0] + (bx / bl) * (d / cosHalf), p[1] + (by / bl) * (d / cosHalf)];
  });
}

// --- Merging ----------------------------------------------------------------------------------------------------

interface TaggedPart {
  readonly part: Part;
  readonly id: number;
}

const tag = (part: Part, id: number): TaggedPart => ({ part, id });

/** BufferGeometryUtils.mergeGeometries over tagged parts, with the `partId` attribute Slop's `part()` adds. */
export function mergeParts(parts: readonly TaggedPart[]): VehicleMeshData {
  let vertexCount = 0;
  let indexCount = 0;
  for (const { part } of parts) {
    vertexCount += part.positions.length / 3;
    indexCount += part.indices.length;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const partIds = new Float32Array(vertexCount);
  const indices = new Uint32Array(indexCount);
  let v = 0;
  let k = 0;
  for (const { part, id } of parts) {
    positions.set(part.positions, v * 3);
    normals.set(part.normals, v * 3);
    const count = part.positions.length / 3;
    if (part.uvs.length === count * 2) uvs.set(part.uvs, v * 2);
    partIds.fill(id, v, v + count);
    for (let i = 0; i < part.indices.length; i++) indices[k + i] = part.indices[i]! + v;
    v += count;
    k += part.indices.length;
  }
  return { positions, normals, uvs, partIds, indices, vertexCount, triangles: indexCount / 3 };
}

// --- Body profile (Slop bodyProfile, carLayout) --------------------------------------------------------------------

/** Monotone cubic (Fritsch-Carlson) interpolation through [x, y] control points: smooth, never overshoots. */
export function smoothCurve(points: Curve): (x: number) => number {
  const pts = points.slice().sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  if (n === 1) return () => pts[0]![1];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1]! - xs[i]!);
    d.push((ys[i + 1]! - ys[i]!) / h[i]!);
  }
  const m = [d[0]!];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1]! * d[i]! <= 0) {
      m.push(0);
    } else {
      const w1 = 2 * h[i]! + h[i - 1]!;
      const w2 = h[i]! + 2 * h[i - 1]!;
      m.push((w1 + w2) / (w1 / d[i - 1]! + w2 / d[i]!));
    }
  }
  m.push(d[n - 2]!);
  return (x: number) => {
    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;
    let i = 0;
    while (x > xs[i + 1]!) i++;
    const t = (x - xs[i]!) / h[i]!;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * h[i]! * m[i + 1]!;
  };
}

/** 1 along the body, falling to 0 at the tip along a superelliptic quarter (vertical tangent at the tip). */
export function endFactor(z: number, zTip: number, length: number, exponent = 2): number {
  const u = zTip > 0 ? (z - (zTip - length)) / length : (zTip + length - z) / length;
  if (u <= 0) return 1;
  if (u >= 1) return 0;
  return Math.pow(1 - Math.pow(u, exponent), 1 / exponent);
}

/** One body cross-section: half-width W, sill yB, shoulder yS, top edge yE / xE, crown yT, sill half-width xB. */
export interface BodySection {
  readonly z: number;
  readonly W: number;
  readonly yB: number;
  readonly yS: number;
  readonly yE: number;
  readonly yT: number;
  readonly xE: number;
  readonly xB: number;
}

/** Slop `bodyProfile`: the spec's curves evaluated into cross-section parameters along the vehicle. */
export function bodyProfile(spec: LoftBodySpec): (z: number) => BodySection {
  const W0 = smoothCurve(spec.halfWidth);
  const B0 = smoothCurve(spec.sill);
  const S0 = smoothCurve(spec.shoulder);
  const E0 = smoothCurve(spec.edge);
  const C0 = smoothCurve(spec.crown);
  const T0 = smoothCurve(spec.tumble);
  const archR = spec.wheelRadius + spec.archGap;
  const axles = [spec.wheelZ, -spec.wheelZ];
  const rounded = (z: number, value: number, key: RoundingKey) => {
    const nose = spec.nose[key];
    const tail = spec.tail[key];
    let v = value;
    if (nose && z > 0) v = nose[1] + (v - nose[1]) * endFactor(z, spec.zFront, nose[0], nose[2]);
    if (tail && z < 0) v = tail[1] + (v - tail[1]) * endFactor(z, spec.zRear, tail[0], tail[2]);
    return v;
  };
  return (z: number) => {
    let flare = 0;
    for (const axle of axles) {
      const d = (z - axle) / (archR + 0.4);
      if (Math.abs(d) < 1) flare = Math.max(flare, (1 - d * d) ** 2);
    }
    const W = rounded(z, W0(z) + spec.archFlare * flare, 'halfWidth');
    let yB = rounded(z, B0(z), 'sill');
    for (const axle of axles) {
      const d = Math.abs(z - axle);
      if (d < archR) yB = Math.max(yB, spec.wheelRadius + Math.sqrt(archR * archR - d * d));
    }
    const yE = rounded(z, E0(z), 'edge');
    const yT = yE + Math.max(0, rounded(z, C0(z), 'crown'));
    const yS = Math.min(Math.max(rounded(z, S0(z), 'shoulder'), yB + 0.035), yE - 0.035);
    const xE = Math.max(W - T0(z), W * 0.55);
    return { z, W, yB, yS, yE, yT, xE, xB: W - spec.tuck };
  };
}

export interface CabinSection {
  readonly z: number;
  readonly beltX: number;
  readonly beltY: number;
  readonly railX: number;
  readonly railY: number;
  readonly h: number;
  readonly bulge: number;
}

export interface CarLayout {
  readonly spec: CarBodySpec;
  readonly body: (z: number) => BodySection;
  readonly cabin: (z: number) => CabinSection;
  readonly cabinTop: (c: CabinSection, x: number) => number;
  readonly archR: number;
  readonly belt: { readonly cowl: { x: number; y: number }; readonly deck: { x: number; y: number } };
  readonly rail: {
    readonly front: { x: number; y: number };
    readonly mid: { x: number; y: number };
    readonly rear: { x: number; y: number };
    readonly roofMid: number;
  };
}

/** Slop `carLayout`: the body profile plus the glasshouse. */
export function carLayout(spec: CarBodySpec): CarLayout {
  const body = bodyProfile(spec);
  const archR = spec.wheelRadius + spec.archGap;
  const cab = spec.cabin;
  const roofY = smoothCurve(cab.roofY);
  const H = cab.roofEdge + cab.roofCrown;
  const belt = (z: number) => {
    const s = body(z);
    return { x: s.xE - cab.inset, y: s.yE - 0.004 };
  };
  const bc = belt(cab.cowl);
  const bd = belt(cab.deck);
  const railF = { x: cab.rail[0], y: roofY(cab.roofFront) - H };
  const railR = { x: cab.rail[1], y: roofY(cab.roofRear) - H };
  const roofMid = (cab.roofFront + cab.roofRear) / 2;
  const railM = { x: (cab.rail[0] + cab.rail[1]) / 2, y: roofY(roofMid) - H };
  // At the cowl & deck the glass arch stays under the hood / trunk crown, so the glass grows out of the panel.
  const hCowl = Math.max(0.006, body(cab.cowl).yT - bc.y - 0.008);
  const hDeck = Math.max(0.006, body(cab.deck).yT - bd.y - 0.008);
  const cabin = (z: number): CabinSection => {
    const b = belt(z);
    let railX: number;
    let railY: number;
    let h: number;
    if (z >= cab.roofFront) {
      const t = (cab.cowl - z) / (cab.cowl - cab.roofFront);
      railX = lerp(bc.x, railF.x, t);
      railY = lerp(bc.y, railF.y, t);
      h = lerp(hCowl, H, Math.min(1, t * 1.6));
    } else if (z <= cab.roofRear) {
      const t = (z - cab.deck) / (cab.roofRear - cab.deck);
      railX = lerp(bd.x, railR.x, t);
      railY = lerp(bd.y, railR.y, t);
      h = lerp(hDeck, H, Math.min(1, t * 1.6));
    } else {
      const t = (cab.roofFront - z) / (cab.roofFront - cab.roofRear);
      railX = lerp(railF.x, railR.x, t);
      railY = roofY(z) - H;
      h = H;
    }
    return { z, beltX: Math.max(b.x, railX), beltY: Math.min(b.y, railY), railX, railY, h, bulge: cab.bulge };
  };
  const cabinTop = (c: CabinSection, x: number) => {
    const n = cab.roofRound;
    const ratio = Math.min(1, Math.abs(x) / Math.max(c.railX, 1e-4));
    const th = Math.acos(Math.pow(ratio, n / 2));
    return c.railY + c.h * Math.pow(Math.sin(th), 2 / n);
  };
  return { spec, body, cabin, cabinTop, archR, belt: { cowl: bc, deck: bd }, rail: { front: railF, mid: railM, rear: railR, roofMid } };
}

/** Section winding used by every car loft: left (-x) bottom, up and over the top, right (+x) bottom. */
function mirrorSection(right: readonly V2[], center: V2 | null, z: number): V3[] {
  const pts: V3[] = [];
  for (const [x, y] of right) pts.push([-x, y, z]);
  if (center) pts.push([center[0], center[1], z]);
  for (let i = right.length - 1; i >= 0; i--) pts.push([right[i]![0], right[i]![1], z]);
  return pts;
}

const BODY_LOWER_ROUND = 2.8;
const BODY_UPPER_ROUND = 3.2;

/** Right half of a body cross-section: superelliptic lower and upper corners and a parabolic crown. */
function bodyHalfProfile(s: BodySection, detail: number, spec: LoftBodySpec): V2[] {
  const n1 = spec.lowerRound || BODY_LOWER_ROUND;
  const n2 = spec.upperRound || BODY_UPPER_ROUND;
  const right: V2[] = [];
  const low = detail ? [0, 0.32, 0.64, 1] : [0, 1];
  const up = detail ? spec.upperSamples || [0.38, 0.72, 1] : [1];
  const top = detail ? [0.66, 0.33] : [0.5];
  for (const a of low) {
    const th = (a * Math.PI) / 2;
    right.push([s.xB + (s.W - s.xB) * Math.pow(Math.sin(th), 2 / n1), s.yS - (s.yS - s.yB) * Math.pow(Math.cos(th), 2 / n1)]);
  }
  for (const a of up) {
    const th = (a * Math.PI) / 2;
    right.push([s.xE + (s.W - s.xE) * Math.pow(Math.cos(th), 2 / n2), s.yS + (s.yE - s.yS) * Math.pow(Math.sin(th), 2 / n2)]);
  }
  for (const f of top) right.push([s.xE * f, s.yE + (s.yT - s.yE) * (1 - f * f)]);
  return right;
}

function bodyStations(spec: LoftBodySpec, detail: number, cabin?: CabinSpec): number[] {
  const zs: number[] = [];
  const add = (z: number) => zs.push(Math.min(spec.zFront, Math.max(spec.zRear, z)));
  const step = detail ? spec.stationStep || 0.28 : 0.75;
  for (let z = spec.zRear; z < spec.zFront; z += step) add(z);
  add(spec.zFront);
  const noseLen = Math.max(...Object.values(spec.nose).map((v) => v![0]));
  const tailLen = Math.max(...Object.values(spec.tail).map((v) => v![0]));
  for (const u of detail ? [0, 0.3, 0.52, 0.7, 0.83, 0.92, 0.97, 0.993] : [0, 0.6, 0.92]) {
    add(spec.zFront - noseLen * (1 - u));
    add(spec.zRear + tailLen * (1 - u));
  }
  const archR = spec.wheelRadius + spec.archGap;
  const k = detail ? 8 : 4;
  for (const axle of [spec.wheelZ, -spec.wheelZ]) {
    for (let i = 0; i <= k; i++) add(axle + archR * Math.cos((i / k) * Math.PI));
    add(axle + archR + 0.006);
    add(axle - archR - 0.006);
  }
  if (detail && cabin) {
    add(cabin.cowl);
    add(cabin.deck);
  }
  zs.sort((a, b) => b - a);
  const eps = detail ? 0.004 : 0.04;
  const out: number[] = [];
  for (const z of zs) if (!out.length || out[out.length - 1]! - z > eps) out.push(z);
  out[0] = spec.zFront;
  out[out.length - 1] = spec.zRear;
  return out;
}

/** The closed, capped body loft (Slop `buildBodyLoft`). */
export function buildBodyLoft(spec: LoftBodySpec, detail = 1, cabin?: CabinSpec): Part {
  const body = bodyProfile(spec);
  const sections = bodyStations(spec, detail, cabin).map((z) => {
    const s = body(z);
    return mirrorSection(bodyHalfProfile(s, detail, spec), [0, s.yT], z);
  });
  return loft(sections, { capStart: true, capEnd: true });
}

function cabinSection(c: CabinSection, detail: number, roundness: number): V3[] {
  const right: V2[] = [[c.beltX, c.beltY]];
  if (detail) {
    for (const s of [1 / 3, 2 / 3]) right.push([lerp(c.beltX, c.railX, s) + c.bulge * 4 * s * (1 - s), lerp(c.beltY, c.railY, s)]);
  }
  right.push([c.railX, c.railY]);
  for (const f of detail ? [0.2, 0.42, 0.68] : [0.5]) {
    const th = (f * Math.PI) / 2;
    right.push([c.railX * Math.pow(Math.cos(th), 2 / roundness), c.railY + c.h * Math.pow(Math.sin(th), 2 / roundness)]);
  }
  return mirrorSection(right, [0, c.railY + c.h], c.z);
}

function cabinStations(cab: CabinSpec, detail: number): number[] {
  const zs: number[] = [];
  for (const t of detail ? [0, 0.1, 0.24, 0.42, 0.62, 0.82] : [0, 0.5]) zs.push(lerp(cab.cowl, cab.roofFront, t));
  for (const t of detail ? [0, 0.25, 0.5, 0.75] : [0, 0.5]) zs.push(lerp(cab.roofFront, cab.roofRear, t));
  for (const t of detail ? [1, 0.8, 0.6, 0.4, 0.22, 0.1, 0] : [1, 0.5, 0]) zs.push(lerp(cab.deck, cab.roofRear, t));
  return zs;
}

/** The glasshouse: an open loft sitting on the belt line (Slop `buildCarCabin`). */
export function buildCarCabin(L: CarLayout, detail = 1): Part {
  const cab = L.spec.cabin;
  const sections = cabinStations(cab, detail).map((z) => cabinSection(L.cabin(z), detail, cab.roofRound));
  return loft(sections, { closed: false });
}

/** Half-width of a body's outer skin at height y of the cross-section at z (Slop `carBodyHalfWidthAt`). */
export function carBodyHalfWidthAt(spec: LoftBodySpec, z: number, y: number): number {
  const s = bodyProfile(spec)(z);
  const n1 = spec.lowerRound || BODY_LOWER_ROUND;
  const n2 = spec.upperRound || BODY_UPPER_ROUND;
  const pts: V2[] = [];
  for (let i = 0; i <= 16; i++) {
    const th = ((i / 16) * Math.PI) / 2;
    pts.push([s.xB + (s.W - s.xB) * Math.pow(Math.sin(th), 2 / n1), s.yS - (s.yS - s.yB) * Math.pow(Math.cos(th), 2 / n1)]);
  }
  for (let i = 1; i <= 16; i++) {
    const th = ((i / 16) * Math.PI) / 2;
    pts.push([s.xE + (s.W - s.xE) * Math.pow(Math.cos(th), 2 / n2), s.yS + (s.yE - s.yS) * Math.pow(Math.sin(th), 2 / n2)]);
  }
  if (y <= pts[0]![1]) return pts[0]![0];
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i]![1]) {
      const t = (y - pts[i - 1]![1]) / Math.max(pts[i]![1] - pts[i - 1]![1], 1e-6);
      return lerp(pts[i - 1]![0], pts[i]![0], t);
    }
  }
  return s.xE;
}

// --- Car parts ----------------------------------------------------------------------------------------------------

/** Tyre, alloy lips and dished hubs at an axle (Slop `buildWheelParts` with translateToAxle), plus the arch liner. */
function wheelParts(spec: CarBodySpec, side: number, z: number): TaggedPart[] {
  const r = spec.wheelRadius;
  const rim = r * 0.64;
  const width = r * 0.68;
  const profile: V2[] = [
    [rim + 0.014, -width * 0.44],
    [r * 0.96, -width * 0.33],
    [r, -width * 0.05],
    [r, width * 0.05],
    [r * 0.96, width * 0.33],
    [rim + 0.014, width * 0.44],
  ];
  const x = side * spec.wheelX;
  const place = (p: Part) => translate(rotateZ(p, -side * Math.PI * 0.5), x, r, z);
  const tyre = place(lathe(profile, 20));
  const lip = place(lathe([[rim + 0.014, width * 0.44], [rim, width * 0.29]], 20));
  const backLip = place(lathe([[rim, -width * 0.29], [rim + 0.014, -width * 0.44]], 20));
  const dish = (dir: number) => {
    const hub = circle(rim, 20);
    hub.positions[2] = -0.015;
    computeVertexNormals(hub);
    return translate(rotateY(hub, dir * side * Math.PI * 0.5), x + dir * side * width * 0.29, r, z);
  };
  return [
    tag(tyre, CAR_PARTS.TYRE),
    tag(lip, CAR_PARTS.ALLOY),
    tag(backLip, CAR_PARTS.ALLOY),
    tag(dish(1), CAR_PARTS.ALLOY),
    tag(dish(-1), CAR_PARTS.ALLOY),
    wheelWell(spec, side, z),
  ];
}

/** Dark arch liner behind a wheel, so the arch never shows through to the other side (Slop `buildWheelWell`). */
function wheelWell(spec: LoftBodySpec, side: number, z: number, inset?: number): TaggedPart {
  const r = spec.wheelRadius;
  const width = r * 0.68;
  const x = side * (spec.wheelX - (inset ?? width * 0.5 + 0.02));
  const radius = spec.wheelRadius + spec.archGap + 0.01;
  const outer = translate(rotateY(circle(radius, 10, 0, Math.PI), side * Math.PI * 0.5), x, r, z);
  const inner = translate(rotateY(circle(radius, 10, 0, Math.PI), -side * Math.PI * 0.5), x, r, z);
  const offset = outer.positions.length / 3;
  return tag(
    {
      positions: [...outer.positions, ...inner.positions],
      normals: [...outer.normals, ...inner.normals],
      uvs: [...outer.uvs, ...inner.uvs],
      indices: [...outer.indices, ...inner.indices.map((i) => i + offset)],
    },
    CAR_PARTS.TRIM,
  );
}

function mirrors(L: CarLayout): TaggedPart[] {
  const z = L.spec.cabin.cowl - 0.17;
  const c = L.cabin(z);
  const list: TaggedPart[] = [];
  for (const side of [-1, 1]) {
    const housing = translate(rotateY(roundedBox(0.1, 0.06, 0.085, 0.035, 0.014), side * 0.12), side * (c.beltX + 0.15), c.beltY + 0.085, z - 0.02);
    const arm = translate(rotateZ(box(0.12, 0.035, 0.06), side * 0.35), side * (c.beltX + 0.04), c.beltY + 0.045, z);
    list.push(tag(housing, CAR_PARTS.MIRROR), tag(arm, CAR_PARTS.TRIM));
  }
  return list;
}

function roofRails(L: CarLayout): TaggedPart[] {
  const cab = L.spec.cabin;
  const list: TaggedPart[] = [];
  for (const side of [-1, 1]) {
    const sections = [0.04, 0.1, 0.9, 0.96].map((t, i) => {
      const z = lerp(cab.roofFront, cab.roofRear, t);
      const c = L.cabin(z);
      const x = side * c.railX * 0.8;
      const y = L.cabinTop(c, x) + (i === 0 || i === 3 ? 0.004 : 0.05);
      return ([
        [x - 0.02, y - 0.016, z],
        [x + 0.02, y - 0.016, z],
        [x + 0.02, y + 0.016, z],
        [x - 0.02, y + 0.016, z],
      ] as V3[]).reverse();
    });
    list.push(tag(loft(sections, { capStart: true, capEnd: true }), CAR_PARTS.TRIM));
  }
  return list;
}

/** Where the NYC medallion roof light sits (Slop `taxiSignPlacement`). */
export function taxiSignPlacement(L: CarLayout): { z: number; y: number } {
  const cab = L.spec.cabin;
  const z = lerp(cab.roofFront, cab.roofRear, 0.45);
  const c = L.cabin(z);
  return { z, y: c.railY + c.h };
}

/** The medallion roof light: a lit, gently tapered box on a black mount (Slop `buildTaxiSign`). */
function taxiSign(L: CarLayout): TaggedPart[] {
  const { z, y } = taxiSignPlacement(L);
  const hw0 = 0.3;
  const hw1 = 0.27;
  const h = 0.15;
  const r = 0.035;
  const outline: V2[] = [[-hw0, 0], [hw0, 0], [hw1, h - r]];
  outline.push(...quad([hw1, h - r], [hw1 - 0.004, h], [hw1 - r, h], 3));
  outline.push([-hw1 + r, h]);
  outline.push(...quad([-hw1 + r, h], [-hw1 + 0.004, h], [-hw1, h - r], 3));
  // ExtrudeGeometry: depth 0.12, bevelThickness 0.025, bevelSize 0.012; the shape spans z 0..depth before Slop's
  // translate(0, y + 0.03, z - 0.06).
  const bevelT = 0.025;
  const sign = beveledPrism(outline, offsetOutline(outline, 0.012), -bevelT, 0.12 + bevelT, bevelT);
  translate(sign, 0, y + 0.03, z - 0.06);
  const mount = translate(box(0.46, 0.04, 0.12), 0, y + 0.012, z);
  return [tag(sign, CAR_PARTS.SIGN), tag(mount, CAR_PARTS.TRIM)];
}

/** Bumper strips wrapped around the nose and tail, six rectangular sections each (Slop `buildBumpers`). */
function bumpers(spec: CarBodySpec): TaggedPart[] {
  return spec.bumpers.map(([y, h], end) => {
    const direction = end === 0 ? 1 : -1;
    const tip = end === 0 ? spec.zFront : spec.zRear;
    const sections: V3[][] = [];
    for (const side of [-1, 1]) {
      for (const setback of side < 0 ? [0.3, 0.07, 0] : [0, 0.07, 0.3]) {
        const z = tip - direction * setback;
        const x = side * (carBodyHalfWidthAt(spec, z, y) + 0.012);
        const innerX = x - side * 0.05;
        const outerZ = z + direction * 0.025;
        const innerZ = z - direction * 0.105;
        const section: V3[] = [
          [x, y - h, outerZ],
          [innerX, y - h, innerZ],
          [innerX, y + h, innerZ],
          [x, y + h, outerZ],
        ];
        sections.push(direction > 0 ? section : section.reverse());
      }
    }
    return tag(loft(sections, { capStart: true, capEnd: true }), CAR_PARTS.TRIM);
  });
}

/**
 * The full car (Slop `buildCarGeometry`): body, glasshouse, mirrors, bumpers, four wheels with arch liners, roof
 * rails on SUVs and the medallion sign on taxis. The sign gates on the spec, and the spec comes from the vehicle
 * kind (`bodySpecForKind`), never from a paint test.
 */
export function buildCarGeometryData(spec: CarBodySpec, includeWheels = true): VehicleMeshData {
  const L = carLayout(spec);
  const parts: TaggedPart[] = [
    tag(buildBodyLoft(spec, 1, spec.cabin), CAR_PARTS.BODY),
    tag(buildCarCabin(L, 1), CAR_PARTS.WINDOW),
    ...mirrors(L),
    ...bumpers(spec),
  ];
  for (const side of [-1, 1]) {
    for (const z of [-spec.wheelZ, spec.wheelZ]) {
      if (includeWheels) parts.push(...wheelParts(spec, side, z));
      else parts.push(wheelWell(spec, side, z));
    }
  }
  if (spec.rails) parts.push(...roofRails(L));
  if (spec.sign) parts.push(...taxiSign(L));
  return mergeParts(parts);
}

/**
 * A distant-car stand-in (Slop `buildCarProxyGeometry`): the same body and glasshouse from coarse sections, dark
 * wheel blocks and the taxi's roof sign. Same attributes as the full model, so it shares the material.
 */
export function buildCarProxyGeometryData(spec: CarBodySpec): VehicleMeshData {
  const L = carLayout(spec);
  const parts: TaggedPart[] = [tag(buildBodyLoft(spec, 0), CAR_PARTS.BODY), tag(buildCarCabin(L, 0), CAR_PARTS.WINDOW)];
  const r = spec.wheelRadius;
  for (const side of [-1, 1]) {
    for (const z of [-spec.wheelZ, spec.wheelZ]) {
      parts.push(tag(translate(box(r * 0.6, r * 1.7, r * 1.7), side * spec.wheelX, r * 0.88, z), CAR_PARTS.TYRE));
    }
  }
  if (spec.sign) {
    const { z, y } = taxiSignPlacement(L);
    parts.push(tag(translate(box(0.58, 0.16, 0.16), 0, y + 0.1, z), CAR_PARTS.SIGN));
  }
  return mergeParts(parts);
}

// --- Bus ----------------------------------------------------------------------------------------------------------

/** The windshield rake: the upper front leans back by up to `rake`, fading out along the first metre (Slop `busRake`). */
export function busRake(y: number, z: number, spec: BusSpec = BUS_SPEC): number {
  const along = Math.min(1, Math.max(0, (z - (spec.zFront - 1.0)) / 1.0));
  const up = Math.min(1, Math.max(0, (y - 1.0) / 1.75));
  return spec.rake * along * along * Math.pow(up, 1.3);
}

/** A bus tyre at an axle: the outer profile of Slop's `buildBusWheelGeo` tyre, static. */
function busTyre(spec: BusSpec, side: number, z: number): TaggedPart {
  const r = spec.wheelRadius;
  const w = 0.3;
  const tyre = lathe(
    [
      [r * 0.72, -w * 0.5],
      [r * 0.97, -w * 0.38],
      [r, 0],
      [r * 0.97, w * 0.38],
      [r * 0.72, w * 0.5],
    ],
    20,
  );
  return tag(translate(rotateZ(tyre, -side * Math.PI * 0.5), side * spec.wheelX, r, z), BUS_PARTS.TRIM);
}

/**
 * The lofted bus (Slop `buildLoftedBusBodyGeometry`): raked body, bumpers, the folded bike rack, stalk mirrors, the
 * roof AC and battery pods, arch liners, and static tyres.
 */
export function buildBusGeometryData(spec: BusSpec = BUS_SPEC): VehicleMeshData {
  const body = buildBodyLoft(spec, 1);
  const pos = body.positions;
  for (let i = 0; i < pos.length; i += 3) pos[i + 2] = pos[i + 2]! - busRake(pos[i + 1]!, pos[i + 2]!, spec);
  computeVertexNormals(body);
  const parts: TaggedPart[] = [tag(body, BUS_PARTS.BODY)];

  parts.push(tag(translate(roundedBox(1.24, 0.12, 0.24, 0.07, 0.03), 0, 0.5, spec.zFront - 0.05), BUS_PARTS.TRIM));
  parts.push(tag(translate(roundedBox(1.24, 0.11, 0.22, 0.06, 0.03), 0, 0.48, spec.zRear + 0.05), BUS_PARTS.TRIM));
  const rackZ = spec.zFront + 0.13;
  parts.push(tag(translate(roundedBox(0.5, 0.024, 0.05, 0.02, 0.008), 0, 1.0, rackZ + 0.05), BUS_PARTS.TRIM));
  parts.push(tag(translate(roundedBox(0.46, 0.02, 0.05, 0.018, 0.008), 0, 0.74, rackZ), BUS_PARTS.TRIM));
  for (const side of [-1, 1]) {
    parts.push(tag(translate(rotateX(box(0.035, 0.36, 0.035), -0.14), side * 0.47, 0.83, rackZ + 0.02), BUS_PARTS.TRIM));
    // Mirror stalk from the roof corner, curving forward and out to a tall head ahead of the windshield corner.
    const stalk = translate(rotateY(rotateX(box(0.035, 0.035, 0.5), 0.55), side * 0.35), side * 1.2, 2.58, spec.zFront - 0.12);
    const head = translate(roundedBox(0.075, 0.2, 0.06, 0.03, 0.012), side * 1.36, 2.24, spec.zFront + 0.12);
    parts.push(tag(stalk, BUS_PARTS.TRIM), tag(head, BUS_PARTS.TRIM));
  }

  const roofY = spec.edge[0]![1] + spec.crown[0]![1];
  parts.push(tag(translate(roundedBox(0.98, 0.15, 2.5, 0.12, 0.05), 0, roofY + 0.1, -3.55), BUS_PARTS.POD));
  parts.push(tag(translate(roundedBox(0.82, 0.1, 3.0, 0.08, 0.04), 0, roofY + 0.06, 1.1), BUS_PARTS.POD));

  for (const side of [-1, 1]) {
    for (const z of [-spec.wheelZ, spec.wheelZ]) {
      const well = wheelWell(spec, side, z, 0.2);
      // Slop's bus liner is a single half-disc; keep only the outward-facing half (the first circle).
      const half = well.part.positions.length / 6;
      const single: Part = {
        positions: well.part.positions.slice(0, half * 3),
        normals: well.part.normals.slice(0, half * 3),
        uvs: well.part.uvs.slice(0, half * 2),
        indices: well.part.indices.slice(0, well.part.indices.length / 2),
      };
      parts.push(tag(single, BUS_PARTS.TRIM), busTyre(spec, side, z));
    }
  }
  return mergeParts(parts);
}

// --- Kinds ----------------------------------------------------------------------------------------------------------

/** The sim's vehicle classes (vehicle-sim.ts `VehicleKind`), restated so this file imports nothing. */
export type LoftedVehicleKind = 'sedan' | 'taxi' | 'van' | 'bus';

/**
 * Which body each sim kind wears. Slop has no van; the SUV is its tallest car body and the closest silhouette to
 * nyc-mon's 5.0 m van class. The bus is its own spec.
 */
export function bodySpecForKind(kind: Exclude<LoftedVehicleKind, 'bus'>): CarBodySpec {
  switch (kind) {
    case 'sedan':
      return BODY_SPECS.sedan;
    case 'taxi':
      return BODY_SPECS.taxi;
    case 'van':
      return BODY_SPECS.suv;
  }
}

/** The near-detail mesh for a sim kind. */
export function buildVehicleGeometryData(kind: LoftedVehicleKind): VehicleMeshData {
  return kind === 'bus' ? buildBusGeometryData() : buildCarGeometryData(bodySpecForKind(kind));
}

/** Front lamp centre |x|, lamp height and nose z for a kind: what headlight spots and flares mount on. */
export function frontLampMount(kind: LoftedVehicleKind): { x: number; y: number; zFront: number } {
  if (kind === 'bus') return { x: BUS_SPEC.headlight[0], y: BUS_SPEC.headlight[1], zFront: BUS_SPEC.zFront };
  const spec = bodySpecForKind(kind);
  return { x: spec.headlight[0], y: spec.headlight[1], zFront: spec.zFront };
}

/** Rear lamp centre |x|, lamp height and tail z for a kind. The bus tail column sits at |x| 1.04, y 0.92 (Slop material). */
export function rearLampMount(kind: LoftedVehicleKind): { x: number; y: number; zRear: number } {
  if (kind === 'bus') return { x: 1.04, y: 0.92, zRear: BUS_SPEC.zRear };
  const spec = bodySpecForKind(kind);
  return { x: spec.taillight[0], y: spec.taillight[1], zRear: spec.zRear };
}
