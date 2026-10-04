'use client';

import { Blocks, type BlockSpec } from './districtBlock';

/**
 * What makes the avenue read as a street: kerbs and sidewalks, dashed lanes,
 * one cross street with zebra crossings, lamp posts, two cabs and a hydrant.
 * Shared by every district and built once at module load.
 *
 * Layout, in the street node's space (y = 0 is the road, -z runs down the
 * avenue): the roadway is 10 m wide (|x| < 5), sidewalks run to |x| = 7 where
 * the building rows start, and the cross street spans CROSS_STREET.
 */
export const ROAD_HALF = 5;
export const SIDEWALK_HALF = 7;
/** z range [far, near] of the cross street's roadway. */
export const CROSS_STREET = [-20, -12] as const;
/** z range [far, near] the building rows leave open around the cross street. */
export const CROSS_STREET_GAP = [-22, -10] as const;

const AVENUE_NEAR = 6;
const AVENUE_FAR = -64;
const CURB_H = 0.16;

function sidewalks(): BlockSpec[] {
  const out: BlockSpec[] = [];
  const [crossFar, crossNear] = CROSS_STREET;
  const runs = [
    [AVENUE_NEAR, crossNear],
    [crossFar, AVENUE_FAR],
  ] as const;
  for (const side of [-1, 1]) {
    for (const [near, far] of runs) {
      const len = near - far;
      const z = (near + far) / 2;
      out.push({ p: [side * (ROAD_HALF + 1), 0, z], s: [2, CURB_H, len], m: 'streetSidewalk' });
      out.push({ p: [side * (ROAD_HALF + 0.08), 0, z], s: [0.16, CURB_H + 0.02, len], m: 'streetCurb' });
    }
  }
  return out;
}

/** Dashes down a line at x, skipping the intersection. */
function dashes(x: number, width: number, length: number, pitch: number, m: string): BlockSpec[] {
  const out: BlockSpec[] = [];
  const [gapFar, gapNear] = CROSS_STREET_GAP;
  for (let z = 1; z > AVENUE_FAR + length; z -= pitch) {
    const near = z;
    const far = z - length;
    if (far < gapNear && near > gapFar) continue;
    out.push({ p: [x, 0, (near + far) / 2], s: [width, 0.02, length], m });
  }
  return out;
}

function crosswalks(): BlockSpec[] {
  const out: BlockSpec[] = [];
  const [crossFar, crossNear] = CROSS_STREET;
  // Across the avenue, on both sides of the cross street.
  for (const zMid of [crossNear + 1.6, crossFar - 1.6]) {
    for (let x = -ROAD_HALF + 0.6; x < ROAD_HALF; x += 1.1) {
      out.push({ p: [x, 0, zMid], s: [0.55, 0.025, 2.8], m: 'streetPaint' });
    }
    // Stop line on the approach side.
    out.push({ p: [0, 0, zMid + (zMid > crossNear ? 1.9 : -1.9)], s: [ROAD_HALF * 2 - 0.4, 0.025, 0.35], m: 'streetPaint' });
  }
  // Across the cross street, in line with each sidewalk.
  for (const side of [-1, 1]) {
    for (let z = crossNear - 0.6; z > crossFar; z -= 1.1) {
      out.push({ p: [side * (ROAD_HALF + 1), 0, z], s: [2.6, 0.025, 0.55], m: 'streetPaint' });
    }
  }
  return out;
}

function lampPost(side: number, z: number): BlockSpec[] {
  const x = side * (ROAD_HALF + 0.5);
  return [
    { p: [x, CURB_H, z], s: [0.3, 0.4, 0.3], m: 'streetPole' },
    { p: [x, CURB_H, z], s: [0.14, 5.2, 0.14], m: 'streetPole' },
    // Arm reaching over the road, and the lit head hanging off it.
    { p: [x - side * 0.7, CURB_H + 5.1, z], s: [1.5, 0.12, 0.12], m: 'streetPole' },
    { p: [x - side * 1.35, CURB_H + 4.8, z], s: [0.6, 0.22, 0.34], m: 'streetLamp' },
  ];
}

/**
 * A yellow cab, in the palette's orange. Built along z (down the avenue);
 * `across` turns it 90 degrees to drive the cross street.
 */
function cab(x: number, z: number, across = false): BlockSpec[] {
  const parts: BlockSpec[] = [
    { p: [0, 0.12, 0], s: [1.9, 0.25, 4.6], m: 'streetCabTrim' },
    { p: [0, 0.35, 0], s: [1.9, 0.6, 4.6], m: 'streetCab' },
    { p: [0, 0.95, 0.2], s: [1.6, 0.55, 2.3], m: 'streetCabTrim' },
    { p: [0, 1.5, 0.2], s: [1.6, 0.06, 2.3], m: 'streetCab' },
    { p: [0, 1.56, 0.2], s: [0.6, 0.18, 0.25], m: 'streetLamp' },
    // Wheels.
    ...[-1, 1].flatMap((sx) =>
      [-1.5, 1.5].map((dz): BlockSpec => ({ p: [sx * 0.9, 0, dz], s: [0.3, 0.6, 0.7], m: 'streetCabTrim' })),
    ),
  ];
  return parts.map(({ p, s, m }) =>
    across
      ? { p: [x + p[2], p[1], z + p[0]], s: [s[2], s[1], s[0]], m }
      : { p: [x + p[0], p[1], z + p[2]], s, m },
  );
}

function hydrant(x: number, z: number): BlockSpec[] {
  return [
    { p: [x, CURB_H, z], s: [0.4, 0.1, 0.4], m: 'streetHydrant' },
    { p: [x, CURB_H + 0.1, z], s: [0.26, 0.55, 0.26], m: 'streetHydrant' },
    { p: [x, CURB_H + 0.65, z], s: [0.32, 0.1, 0.32], m: 'streetHydrant' },
    { p: [x, CURB_H + 0.75, z], s: [0.14, 0.1, 0.14], m: 'streetHydrant' },
    { p: [x, CURB_H + 0.4, z], s: [0.5, 0.12, 0.12], m: 'streetHydrant' },
  ];
}

const DRESSING: BlockSpec[] = [
  ...sidewalks(),
  ...dashes(0, 0.22, 3, 6, 'districtAvenue'),
  ...dashes(-ROAD_HALF / 2, 0.12, 2, 6, 'streetLane'),
  ...dashes(ROAD_HALF / 2, 0.12, 2, 6, 'streetLane'),
  ...crosswalks(),
  ...[-4, -26, -38, -50].flatMap((z, i) => lampPost(i % 2 ? -1 : 1, z)),
  ...[-8, -32, -44, -56].flatMap((z, i) => lampPost(i % 2 ? 1 : -1, z)),
  // One cab pulling into the intersection from the left, clear of the
  // landmark's base, and one coming up the far lane.
  ...cab(-4.6, (CROSS_STREET[0] + CROSS_STREET[1]) / 2 + 2, true),
  ...cab(-2.5, -34),
  ...hydrant(ROAD_HALF + 0.6, -6.5),
];

export function StreetDressing() {
  return <Blocks list={DRESSING} prefix="street" />;
}
