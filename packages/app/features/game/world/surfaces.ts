// Surface families for the PBR lane (world/pbr-materials.ts): the
// roughness/metalness ranges each family lives in, the per-vertex picks the
// emitters stamp into the aRoughMetal attribute, and the ambient-occlusion
// bake that reuses the authored contact shadows. The ranges are the
// handoff's (docs/design/handoff/realism.md, lane-design-seq):
// masonry 0.85–0.95 rough / 0 metal, asphalt 0.9–0.98 / 0, glass 0.04–0.12 /
// curtain metal 0.75, storefront 0.3–0.5 / 0–0.2, painted metal 0.35–0.55 /
// 0.6–0.8, foliage 0.7–0.9 / 0. Pure: no three import, so node tests pin the
// values and the field.
import { hashUnit, segmentDistanceSq } from './geometry.ts';

export interface SurfaceRange {
  readonly rough: readonly [number, number];
  readonly metal: readonly [number, number];
}

/** The handoff ranges. `glass` metal is the curtain wall's, not the pane dielectric's. */
export const SURFACE_RANGES = {
  masonry: { rough: [0.85, 0.95], metal: [0, 0] },
  asphalt: { rough: [0.9, 0.98], metal: [0, 0] },
  glass: { rough: [0.04, 0.12], metal: [0.75, 0.75] },
  storefront: { rough: [0.3, 0.5], metal: [0, 0.2] },
  paintedMetal: { rough: [0.35, 0.55], metal: [0.6, 0.8] },
  foliage: { rough: [0.7, 0.9], metal: [0, 0] },
} as const satisfies Record<string, SurfaceRange>;

export type SurfaceFamily = keyof typeof SURFACE_RANGES;

/** A point inside a family's range from a 0..1 seed (a building-id hash), so the block is not one flat value. */
export function surfacePick(family: SurfaceFamily, seed: number): readonly [number, number] {
  const range = SURFACE_RANGES[family];
  const t = Math.min(1, Math.max(0, seed));
  return [
    range.rough[0] + (range.rough[1] - range.rough[0]) * t,
    range.metal[0] + (range.metal[1] - range.metal[0]) * t,
  ];
}

/** Mid-range pick, for shader-side masks and uniform instanced geometry. */
export function surfaceMid(family: SurfaceFamily): readonly [number, number] {
  return surfacePick(family, 0.5);
}

/**
 * Families the handoff does not list, parked at the nearest listed family.
 * Each is a constant rather than a range: they are small parts inside shared
 * buffers, so a second seed dimension would buy nothing the eye can read.
 * All TODO(tune) once the flagged render has been eyeballed on a device.
 */
export const SURFACES = {
  /** Stone stoops, cornices, cast-concrete trim — masonry family. */
  stone: [0.9, 0],
  /** Painted cast iron: stoop rails, fire escapes, hydrants, sign poles — paintedMetal mid. */
  iron: surfaceMid('paintedMetal'),
  /** Weathered cedar water-tank staves — foliage family. */
  wood: [0.8, 0],
  /** Awning canvas — foliage family. */
  fabric: [0.85, 0],
  /** Built-up tar and gravel roofs — asphalt family. */
  tarRoof: [0.94, 0],
  /** Metallic-flake body paint — paintedMetal toward the glossy end. */
  carPaint: [0.4, 0.55],
  /** Car glasshouse — glass roughness, dielectric (not curtain metal). */
  carGlass: [0.08, 0],
  /** Tyres — asphalt family. */
  tyre: [0.95, 0],
  /** Flat East River water — storefront-smooth, dielectric. */
  water: [0.15, 0],
} as const satisfies Record<string, readonly [number, number]>;

/** Per-building roughness/metalness seed, same id-hash convention as the wall tone (city-mesh.ts). */
export function buildingSurface(className: string, id: string): readonly [number, number] {
  return surfacePick(className === 'glass' ? 'glass' : 'masonry', hashUnit(`${id}:surface`));
}

// --- Baked occlusion -------------------------------------------------------
//
// There is no raytraced AO bake in the tile pipeline; the only authored
// shadow data is the contact-shadow ring (materials.ts `shadows`): a strip
// `contactReach` metres wide around each footprint whose opacity falls off as
// fall² · 0.34, leaning away from the sun. aOcclusion reuses exactly those
// numbers as "share of indirect sky light reaching the vertex": 1 is open
// sky, 0.66 sits under the densest ring. The visual cast shadow still comes
// from the transparent ring mesh; aOcclusion only tempers the env/hemi term
// (three's PhysicalLightingModel multiplies it into reflectedLight
// .indirectDiffuse — it does not darken the direct sun). The lean lives in
// the ring geometry and is not reproduced in the field below, which is
// symmetric: a documented approximation, not a second shadow.

/** Deepest ring opacity — kept in lockstep with `shadows.opacityNode` (fall² · 0.34). */
export const CONTACT_AO_DEPTH = 0.34;

/** Contact-shadow reach for a building, the emitShadow formula (city-mesh.ts). */
export function contactReach(heightMeters: number): number {
  return Math.max(1.2, Math.min(5, heightMeters * 0.12));
}

/**
 * Wall-base gradient, the same falloff shape as the ring: fully occluded at
 * the ground line, open sky once the wall is above the shadow's reach. Wall
 * quads carry two heights only, so the ramp interpolates across the whole
 * facade — it reads as a mild vertical darkening, not a crisp contact line.
 */
export function wallAo(y: number, reach: number): number {
  const fall = Math.max(0, 1 - Math.min(1, y / Math.max(reach, 1e-6)));
  return 1 - CONTACT_AO_DEPTH * fall * fall;
}

/**
 * Distance-to-footprint field over the tile, one 16 m grid cell of padded
 * footprint edges per building. Querying returns the darkest ring falloff of
 * any edge within reach — the value the contact-shadow mesh would paint at
 * that point, minus the sun lean it does not reproduce.
 */
export class ContactField {
  private readonly cells = new Map<number, number[]>();
  private static readonly CELL = 16;

  private static key(cx: number, cz: number): number {
    // Offset keeps negative scene coordinates from colliding (city spans ±extent).
    return (cx + 0x8000) * 0x10000 + (cz + 0x8000);
  }

  /** A building footprint ring ([x, z] points) and its height, from the banded building loop. */
  add(ring: readonly (readonly number[])[], heightMeters: number): void {
    const reach = contactReach(heightMeters);
    const cell = ContactField.CELL;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const x0 = Math.floor((Math.min(a[0]!, b[0]!) - reach) / cell);
      const x1 = Math.floor((Math.max(a[0]!, b[0]!) + reach) / cell);
      const z0 = Math.floor((Math.min(a[1]!, b[1]!) - reach) / cell);
      const z1 = Math.floor((Math.max(a[1]!, b[1]!) + reach) / cell);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const key = ContactField.key(cx, cz);
          let bucket = this.cells.get(key);
          if (!bucket) {
            bucket = [];
            this.cells.set(key, bucket);
          }
          bucket.push(a[0]!, a[1]!, b[0]!, b[1]!, reach);
        }
      }
    }
  }

  /** Darkest contact-shadow falloff at (x, z): 1 in the open, ~0.66 at a wall foot. */
  occlusion(x: number, z: number): number {
    const bucket = this.cells.get(
      ContactField.key(Math.floor(x / ContactField.CELL), Math.floor(z / ContactField.CELL)),
    );
    if (!bucket) return 1;
    let ao = 1;
    for (let k = 0; k < bucket.length; k += 5) {
      const d = Math.sqrt(segmentDistanceSq(x, z, bucket[k]!, bucket[k + 1]!, bucket[k + 2]!, bucket[k + 3]!));
      const reach = bucket[k + 4]!;
      if (d < reach) {
        const fall = 1 - d / reach;
        ao = Math.min(ao, 1 - CONTACT_AO_DEPTH * fall * fall);
      }
    }
    return ao;
  }
}
