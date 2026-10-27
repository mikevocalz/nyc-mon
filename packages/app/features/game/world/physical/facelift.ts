// The futuristic facelift on the physically lit city (Slop-grade city plan
// § 5.5; docs/design/handoff/slop-grade-city.md § 4): the 2026-10-13
// approved direction (MOBILE_WORLD_PR_PACK.md) restated for PBR, on top of
// E2's Slop materials. Additive, keyed by stable building id through
// future-layer.ts faceliftPlan, and built only when the scene asks for it
// under EXPO_PUBLIC_WORLD_PHYSICAL and EXPO_PUBLIC_WORLD_FUTURE.
//
// One mesh, one draw, one material:
//
// - Skin quads. A copy of each chosen masonry wall quad, 2.5 cm proud of the
//   wall, carrying that wall's own aFacadeWall / aFacadeGrid. The material
//   runs E2's facadeCell on them, so it finds the same window cells the
//   pre-war shader draws, then keeps only painted-aluminium window frames
//   and the modular panel joints (gridLine anti-aliased lines) and discards
//   the rest by alpha test. The walls are read back from the built
//   city:walls-masonry geometry, so the wall kinds are city-mesh.ts's and
//   not a second guess.
// - Solid parts: lit canopies, rear balconies and roof gardens, lit by the
//   rig's sun and sky like any other PBR surface.
// - Glow parts: vertical strips, roofline trims, entrance bands and the
//   royal kerb line. Their emissive is scaled so its luminance clears the
//   bloom threshold of every preset (glowGain), so they bloom.
//
// The kit city-mesh.ts already builds for project-brick towers (fins,
// balconies, entrance, strips, roof garden) stays where it is; this adds
// frames and joints to it and lays glow over its strips and entrance band,
// which the cel neon material draws at display brightness.
//
// The LED AdSurfaces keep city-mesh.ts's billboard geometry and placement;
// createFaceliftAdMaterial swaps their material for an emissive brand
// gradient with no lettering, whose slow sweep stops under Reduce Motion.
import type { Three } from '@acme/ui/three';
import { physicalFacelift } from '@acme/theme';
import type { BufferGeometry } from 'three/webgpu';
import type { BuildingClass, CityBuilding, CityDatasetV3, CityRoad, RoadClass } from '../../city-dataset.ts';
import { LAYER, neonTrimShare, type FaceliftBakePick } from '../city-mesh.ts';
import { CURB_HEIGHT } from '../curb.ts';
import { wallFrame } from '../facade-detail.ts';
import {
  classifyFaceliftBlock, emitNychaBalcony, faceliftPlan, FACELIFT_BLOCKS, NYCHA_BALCONY_SHARE, NYCHA_BALCONY_TOP, scaledRing,
  type FaceliftBlock, type FaceliftDensity, type FaceliftPlan,
} from '../future-layer.ts';
import { hashUnit, mapArea, pairs, pointInRing, ribbon, VertexBuffer } from '../geometry.ts';
import { CITY_COLORS, hexToRgb } from '../palette.ts';
import { box, type Frame } from '../parts.ts';
import { createLampPoolMaterial } from '../materials.ts';
import { PHYSICAL_GRADE, PHYSICAL_POST } from '../physical-look.ts';
import { PRE_WAR } from '../physical-materials-constants.ts';
import { SURFACES } from '../surfaces.ts';
import type { StreetClearance } from '../walkability.ts';
import { CLASS_FAMILY } from './class-family.ts';
import { facadeCell } from './facade.ts';
import { FACADE_GRID_ATTRIBUTE, FACADE_WALL_ATTRIBUTE, WALL_KINDS } from './facade-attributes.ts';
import { asColorNode, asNode, asTsl, type TslNode } from './loose-tsl.ts';
import { physicalTsl } from './tsl-common.ts';

type Point = [number, number];
type Rgb = readonly number[];
type Mat = InstanceType<Three['Material']>;
type Mesh = InstanceType<Three['Mesh']>;

/** Per-vertex facelift data: (mode, glow). Mode 0 solid, 1 frames, 2 joints, 3 both; glow 0..1 of the target. */
export const FACELIFT_ATTRIBUTE = 'aFacelift';

/** Sizes and finishes. nyc-mon picks, every one TODO(tune) on an iPhone 17 / iPad Pro frame. */
export const FACELIFT = {
  /** Skin quads sit this far proud of the wall, m: in front of the facade, behind the kit's 4 cm fins. */
  skinOffset: 0.025,
  /** Painted-aluminium frame width inside the window opening, m. */
  frameWidth: 0.07,
  /** Meeting rail and centre mullion half-width, m. */
  railHalfWidth: 0.025,
  /** Painted aluminium: dielectric. Roughness starts at the curb's 0.72 (handoff § 4). */
  frameRoughness: 0.72,
  /** Panel joint half-width, m, and the sealant's roughness. */
  jointHalfWidth: 0.018,
  jointRoughness: 0.9,
  canopyRoughness: 0.6,
  /** Upgraded-entrance canopy: underside height, thickness, depth, m. */
  canopyBottom: 2.7,
  canopyThickness: 0.2,
  canopyDepth: 1.2,
  canopyMaxWidth: 2.8,
  /** Vertical strip: half-width, depth, start above the street and stop under the parapet, m. */
  stripHalfWidth: 0.1,
  stripDepth: 0.06,
  stripBottom: 1.2,
  stripTopGap: 0.5,
  /** Roofline trim band below the roof and its stand-off, m (the cel trim is 0.26 m tall at 0.06). */
  trimTop: 0.02,
  trimBottom: 0.36,
  trimOffset: 0.09,
  /** Kerb light line: inset from the carriageway edge onto the sidewalk, width, lift, longest piece, m. */
  kerbInset: 0.15,
  kerbWidth: 0.1,
  kerbLift: 0.006,
  kerbPiece: 2,
  /**
   * Share of commercial road ways (by road id hash) that carry the kerb
   * line. Both kerbs of every avenue way came to about 20 km of light on
   * the tile, which reads as uniform neon; the handoff gives no density for
   * this piece, so this is a start value for Mike's G6 review.
   */
  kerbShare: 0.5,
  /** Roof garden: footprint scale and planter wall height, m; no garden on smaller roofs, m². */
  gardenScale: 0.55,
  gardenWall: 0.45,
  gardenMinArea: 60,
  /** Walls shorter than this get no strips or canopies, m. */
  minWallForLight: 8,
  /** No frames or joints on walls narrower than one window module, m. */
  minWallForSkin: 2,
  minWallForBalcony: 6,
} as const;

/**
 * Emitted-light targets. Luminance is Rec. 709 on scene-linear colour,
 * before exposure. The threshold the pipeline blooms from is at most 1.35
 * (midday) plus BloomNode's 0.3 smooth width, so 2.4 clears every preset
 * with the pipeline's 8x peak limit applied (facelift.test.ts checks each
 * preset and each glow token). TODO(tune) on device: daylight strength.
 */
export const FACELIFT_GLOW = {
  target: 2.4,
  adTarget: 2.1,
  /** A dark token is never pushed past this gain, so a near-black colour cannot turn into a floodlight. */
  maxGain: 14,
  /** LED sweep on the ad surfaces: metres per cycle up the panel and seconds per cycle (well under 3 Hz). */
  adSweepMetres: 4,
  adSweepSeconds: 8,
  adSweepDepth: 0.15,
} as const;

// ---- pure helpers -------------------------------------------------------------

/** sRGB channel (0..1) to linear, the exact piecewise curve three's sRGBTransferEOTF uses. */
export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Rec. 709 luminance of a linear colour. */
export function luminance(rgb: Rgb): number {
  const [r, g, b] = PHYSICAL_POST.luma;
  return rgb[0]! * r + rgb[1]! * g + rgb[2]! * b;
}

/** The emissive gain that lifts a linear colour to `target` luminance; the shader computes the same. */
export function glowGain(linear: Rgb, target: number = FACELIFT_GLOW.target): number {
  return Math.min(FACELIFT_GLOW.maxGain, Math.max(1, target / Math.max(luminance(linear), 1e-4)));
}

/**
 * The luminance the bloom pass sees for a glow token under one preset:
 * gain, then exposure and white balance, then the pipeline's peak limit
 * (post/pipeline.ts mountPhysical), all as the shader chain applies them.
 */
export function bloomLuminance(hex: string, preset: keyof typeof PHYSICAL_GRADE, target: number = FACELIFT_GLOW.target): number {
  const linear = hexToRgb(hex).map(srgbToLinear);
  const gain = glowGain(linear, target);
  const look = PHYSICAL_GRADE[preset];
  const exposed = linear.map((v, i) => v * gain * look.exposure * look.balance[i]!);
  const peak = Math.max(...exposed);
  const limit = PHYSICAL_POST.bloomPeak / Math.max(peak, PHYSICAL_POST.bloomPeak);
  return luminance(exposed.map((v) => v * limit));
}

/** The masonry family a class's wall refresh picks from; null for curtain wall. */
function refreshFamily(class_: BuildingClass): keyof typeof physicalFacelift.wallRefresh | null {
  const { family } = CLASS_FAMILY[class_];
  return family === 'curtainWall' ? null : family;
}

/**
 * The refreshed wall tone for a building whose plan carries the palette
 * piece, or null. The wall colour is city-mesh.ts's vertex colour, so this
 * is the value its wall tone would take; the facade shader keeps the brick
 * bond and relief.
 */
export function faceliftWallTone(building: Pick<CityBuilding, 'id' | 'class'>, plan: Pick<FaceliftPlan, 'palette'>): string | null {
  if (!plan.palette) return null;
  const family = refreshFamily(building.class);
  if (!family) return null;
  const tones = physicalFacelift.wallRefresh[family];
  return tones[Math.floor(hashUnit(`${building.id}:facelift:tone`) * tones.length) % tones.length]!;
}

/**
 * LED streetlight colour, cooler than the sodium lampHalo: `color` is the
 * token, `linear` the scene-linear rgb the lamp pools and halos multiply.
 * It goes to the emissive pools under the furniture lamps, the living
 * city's dusk halos, and the streetlamp PointLights the clustered rig
 * carries at night (night-lights.ts, which reads the same streetLed token).
 */
export const FACELIFT_STREETLIGHT = {
  color: physicalFacelift.streetLed,
  linear: hexToRgb(physicalFacelift.streetLed).map(srgbToLinear) as [number, number, number],
} as const;

/** The furniture lamps' light pools in the LED colour (materials.ts createLampPoolMaterial). */
export function createFaceliftLampPools(THREE: Three): Mat {
  return createLampPoolMaterial(THREE, THREE.TSL.color(new THREE.Color(...FACELIFT_STREETLIGHT.linear)));
}

const COMMERCIAL: ReadonlySet<RoadClass> = new Set(['primary', 'secondary', 'trunk']);

function segmentDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax; const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/** Distance to the nearest commercial carriageway edge, bucketed like city-mesh.ts SegmentGrid (32 m cells). */
export class CommercialFrontage {
  private readonly cells = new Map<number, number[]>();
  private static readonly CELL = 32;

  constructor(roads: readonly CityRoad[]) {
    for (const road of roads) {
      if (!COMMERCIAL.has(road.class)) continue;
      const p = road.points;
      const pad = road.widthMeters / 2;
      for (let k = 2; k < p.length; k += 2) {
        const ax = p[k - 2]!; const az = p[k - 1]!; const bx = p[k]!; const bz = p[k + 1]!;
        const C = CommercialFrontage.CELL;
        for (let cx = Math.floor((Math.min(ax, bx) - pad) / C); cx <= Math.floor((Math.max(ax, bx) + pad) / C); cx++) {
          for (let cz = Math.floor((Math.min(az, bz) - pad) / C); cz <= Math.floor((Math.max(az, bz) + pad) / C); cz++) {
            const key = cx * 65_536 + cz;
            let cell = this.cells.get(key);
            if (!cell) { cell = []; this.cells.set(key, cell); }
            cell.push(ax, az, bx, bz, pad);
          }
        }
      }
    }
  }

  nearest(x: number, z: number): number {
    const C = CommercialFrontage.CELL;
    const cx = Math.floor(x / C); const cz = Math.floor(z / C);
    let best = Infinity;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const cell = this.cells.get((cx + i) * 65_536 + cz + j);
      if (!cell) continue;
      for (let k = 0; k < cell.length; k += 5) {
        const d = segmentDistance(x, z, cell[k]!, cell[k + 1]!, cell[k + 2]!, cell[k + 3]!) - cell[k + 4]!;
        if (d < best) best = d;
      }
    }
    return Math.max(0, best);
  }

  /** city-mesh.ts's D17 fascia rule: some wall of 5 m or more, on a building 6 m or taller, within 14 m of a commercial road. */
  onAvenue(ring: readonly Point[], heightMeters: number): boolean {
    if (heightMeters < 6) return false;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]!;
      const [bx, bz] = ring[(i + 1) % ring.length]!;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 5) continue;
      const [ox, oz] = outward(ax, az, bx, bz);
      if (this.nearest((ax + bx) / 2 + ox * 6, (az + bz) / 2 + oz * 6) <= 14) return true;
    }
    return false;
  }
}

/** Right of travel on the counter-clockwise ring: out of the solid (city-mesh.ts normalOf). */
function outward(ax: number, az: number, bx: number, bz: number): Point {
  const length = Math.hypot(bx - ax, bz - az) || 1;
  return [-(bz - az) / length, (bx - ax) / length];
}

/** The counter-clockwise outer ring and the recorded front edge on it, as city-mesh.ts derives them. */
export function ccwRing(building: Pick<CityBuilding, 'ring' | 'frontEdgeIndex'>): { ring: Point[]; frontEdge: number } {
  const flat = pairs(building.ring);
  const reversed = mapArea(flat) < 0;
  const ring = reversed ? [...flat].reverse() : flat;
  const n = ring.length;
  const fi = building.frontEdgeIndex;
  const frontEdge = fi !== undefined && fi >= 0 && fi < n ? (reversed ? (((n - 2 - fi) % n) + n) % n : fi) : -1;
  return { ring, frontEdge };
}

/**
 * Where city-mesh.ts put the project-brick kit's entrance: the first edge of
 * 8 m or more on the recorded front (any such edge when there is none), at
 * the same `doorAt` hash. Null when no edge qualifies.
 */
export function kitEntrance(building: Pick<CityBuilding, 'id' | 'ring' | 'frontEdgeIndex'>): { edge: number; at: number } | null {
  const { ring, frontEdge } = ccwRing(building);
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 8) continue;
    if (frontEdge < 0 || i === frontEdge) {
      return { edge: i, at: (hashUnit(`${building.id}:${i}:doorAt`) - 0.5) * Math.max(0, length - 8) };
    }
  }
  return null;
}

/**
 * Each building's facelift plan on a tile: its block type (landmark, then
 * the D17 avenue rule on the ccw ring) and faceliftPlan with today's
 * neonTrimShare. The facelift geometry and the city bake both read this, so
 * the trims one drops are the trims the other leaves out.
 */
export function faceliftPlanner(
  dataset: Pick<CityDatasetV3, 'roads' | 'landmarks'>, density?: Readonly<Record<FaceliftBlock, FaceliftDensity>>,
): (building: CityBuilding) => FaceliftPlan {
  const frontage = new CommercialFrontage(dataset.roads);
  const landmarks = new Set(dataset.landmarks.map((l) => l.buildingId));
  return (building) => {
    const landmark = landmarks.has(building.id);
    const block = classifyFaceliftBlock(building, { landmark, onAvenue: !landmark && frontage.onAvenue(ccwRing(building).ring, building.heightMeters) });
    return faceliftPlan(building, block, neonTrimShare(building.heightMeters), density);
  };
}

/** The bake's per-building picks (city-mesh.ts PhysicalMeshOptions.facelift): the refreshed wall tone and the trim gate. */
export function faceliftBakePicks(
  dataset: Pick<CityDatasetV3, 'roads' | 'landmarks'>, density?: Readonly<Record<FaceliftBlock, FaceliftDensity>>,
): (building: CityBuilding) => FaceliftBakePick {
  const plan = faceliftPlanner(dataset, density);
  return (building) => {
    const p = plan(building);
    return { wallTone: faceliftWallTone(building, p), trim: p.trim };
  };
}

const edgeKey = (ax: number, az: number, bx: number, bz: number) =>
  `${Math.fround(ax)},${Math.fround(az)},${Math.fround(bx)},${Math.fround(bz)}`;

// ---- geometry -------------------------------------------------------------------

export interface FaceliftStats {
  /** Buildings per block type on the tile. */
  blocks: Record<FaceliftBlock, number>;
  /** Buildings whose plan carries each piece. */
  planned: { palette: number; frames: number; panels: number; roofGarden: number; balcony: number; verticalLight: number; entrance: number; trim: number };
  /** Emitted pieces. */
  skinWalls: number;
  strips: number;
  trims: number;
  canopies: number;
  balconies: number;
  roofGardens: number;
  /** Kit glow laid over city-mesh.ts's project-brick strips and entrance bands. */
  kitStripCovers: number;
  kitEntranceCovers: number;
  kerbMetres: number;
  vertices: number;
}

/** Skin and glow attributes, kept in step with the VertexBuffer like physical/facade-attributes.ts. */
class SkinWriter {
  wall = new Float32Array(4 * 4096);
  grid = new Float32Array(4 * 4096);
  mode = new Float32Array(2 * 4096);
  count = 0;

  padTo(target: number, glow = 0): void {
    while (this.count < target) this.push([0, 1, 1, WALL_KINDS.blankStone], [3, 1, 0.5, 0], 0, glow);
  }

  push(wall: ArrayLike<number>, grid: ArrayLike<number>, mode: number, glow: number): void {
    if ((this.count + 1) * 4 > this.wall.length) {
      const grow = (a: Float32Array) => { const b = new Float32Array(a.length * 2); b.set(a); return b; };
      this.wall = grow(this.wall); this.grid = grow(this.grid); this.mode = grow(this.mode);
    }
    const i = this.count * 4;
    for (let k = 0; k < 4; k++) { this.wall[i + k] = wall[k]!; this.grid[i + k] = grid[k]!; }
    this.mode[this.count * 2] = mode;
    this.mode[this.count * 2 + 1] = glow;
    this.count++;
  }
}

/** A wall quad read back from a city-mesh wall geometry. */
interface WallQuad {
  /** First of its six vertices. */
  vertex: number;
  length: number;
  height: number;
  kind: number;
  /** aFacadeGrid of the wall: floor height, window width, seed + tone, family * 4 + pier. */
  grid: [number, number, number, number];
}

/** The wall quads of one city-mesh wall geometry, by building edge. */
function readWalls(geometry: BufferGeometry): Map<string, WallQuad> {
  const out = new Map<string, WallQuad>();
  const wall = geometry.getAttribute(FACADE_WALL_ATTRIBUTE);
  const grid = geometry.getAttribute(FACADE_GRID_ATTRIBUTE);
  const pos = geometry.getAttribute('position');
  if (!wall || !grid || !pos) return out;
  const w = wall.array as Float32Array;
  const g = grid.array as Float32Array;
  const p = pos.array as Float32Array;
  const along = [0, 1, 1, 0, 1, 0];
  for (let v = 0; v + 6 <= pos.count;) {
    const length = w[v * 4 + 1]!;
    let match = length > 0 && p[v * 3 + 1] === 0;
    for (let k = 0; match && k < 6; k++) {
      const i = (v + k) * 4;
      match = w[i]! === along[k]! * length && w[i + 1] === length && w[i + 3] === w[v * 4 + 3];
    }
    if (!match) { v++; continue; }
    const key = edgeKey(p[v * 3]!, p[v * 3 + 2]!, p[v * 3 + 3]!, p[v * 3 + 5]!);
    out.set(key, {
      vertex: v, length, height: w[v * 4 + 2]!, kind: w[v * 4 + 3]!,
      grid: [g[v * 4]!, g[v * 4 + 1]!, g[v * 4 + 2]!, g[v * 4 + 3]!],
    });
    v += 6;
  }
  return out;
}

/** The centre of the door bay the pre-war shader draws on an entry wall (facadeCell's `door`), m from the wall start. */
export function doorBayCentre(length: number, grid: readonly number[]): { s: number; bayWidth: number } {
  const pier = Math.min(grid[3]! % 4, length * 0.2);
  const inner = length - pier * 2;
  const bays = Math.max(Math.floor(inner / grid[1]! + 0.5), 1);
  const bayWidth = inner / bays;
  const tone = (grid[2]! - Math.floor(grid[2]!) - 0.1) / 0.8;
  const index = Math.min(Math.floor(tone * bays), bays - 1);
  return { s: pier + (index + 0.5) * bayWidth, bayWidth };
}

export interface FaceliftInput {
  dataset: CityDatasetV3;
  /** The built city's wall geometries (city:walls-masonry, city:walls-glass) with aFacadeWall / aFacadeGrid. */
  masonry?: BufferGeometry;
  glass?: BufferGeometry;
  clearance: StreetClearance;
  /** The density table; defaults to future-layer.ts FACELIFT_DENSITY. */
  density?: Readonly<Record<FaceliftBlock, FaceliftDensity>>;
}

export interface FaceliftGeometry {
  buffer: VertexBuffer;
  wall: Float32Array;
  grid: Float32Array;
  mode: Float32Array;
  plans: ReadonlyMap<string, FaceliftPlan>;
  stats: FaceliftStats;
}

export function buildFaceliftGeometry(THREE: Three, input: FaceliftInput): FaceliftGeometry {
  const { dataset, clearance } = input;
  const buffer = new VertexBuffer(65_536);
  const skin = new SkinWriter();
  const planOf = faceliftPlanner(dataset, input.density);
  const landmarks = new Set(dataset.landmarks.map((l) => l.buildingId));
  const masonryWalls = input.masonry ? readWalls(input.masonry) : new Map<string, WallQuad>();
  const glassWalls = input.glass ? readWalls(input.glass) : new Map<string, WallQuad>();
  const masonryPos = input.masonry?.getAttribute('position')?.array as Float32Array | undefined;
  const masonryNormal = input.masonry?.getAttribute('normal')?.array as Float32Array | undefined;
  const masonryWall = input.masonry?.getAttribute(FACADE_WALL_ATTRIBUTE)?.array as Float32Array | undefined;
  const masonryGrid = input.masonry?.getAttribute(FACADE_GRID_ATTRIBUTE)?.array as Float32Array | undefined;

  const plans = new Map<string, FaceliftPlan>();
  const stats: FaceliftStats = {
    blocks: Object.fromEntries(FACELIFT_BLOCKS.map((b) => [b, 0])) as Record<FaceliftBlock, number>,
    planned: { palette: 0, frames: 0, panels: 0, roofGarden: 0, balcony: 0, verticalLight: 0, entrance: 0, trim: 0 },
    skinWalls: 0, strips: 0, trims: 0, canopies: 0, balconies: 0, roofGardens: 0, kitStripCovers: 0, kitEntranceCovers: 0,
    kerbMetres: 0, vertices: 0,
  };
  const rgb = (hex: string) => hexToRgb(hex);
  const pickHex = (list: readonly string[], seed: string) => list[Math.floor(hashUnit(seed) * list.length) % list.length]!;

  // Solid and glow parts: write through the buffer, then pad the skin
  // attributes to the same count with mode 0 and the part's glow weight.
  const solid = (write: () => void) => { write(); skin.padTo(buffer.vertexCount, 0); };
  const glow = (write: () => void) => { buffer.surface(0.5, 0); write(); skin.padTo(buffer.vertexCount, 1); };

  for (const building of dataset.buildings) {
    const { ring, frontEdge } = ccwRing(building);
    const h = building.heightMeters;
    const landmark = landmarks.has(building.id);
    const plan = planOf(building);
    plans.set(building.id, plan);
    stats.blocks[plan.block]++;
    for (const k of Object.keys(stats.planned) as (keyof FaceliftStats['planned'])[]) if (plan[k]) stats.planned[k]++;
    // Landmarks keep their accents and nothing else (city-mesh.ts skips them before the trims too).
    if (landmark) continue;

    const walls = building.class === 'glass' ? glassWalls : masonryWalls;
    const isMasonry = building.class !== 'glass';
    let canopyDone = false;
    const kitDoor = plan.celKit ? kitEntrance(building) : null;
    // Entrance wall: the longest shop wall, else the longest entry wall.
    let entranceEdge = -1;
    if (plan.entrance && !plan.celKit) {
      let best = -1;
      for (const want of [WALL_KINDS.shop, WALL_KINDS.entry]) {
        for (let i = 0; i < ring.length; i++) {
          const [ax, az] = ring[i]!; const [bx, bz] = ring[(i + 1) % ring.length]!;
          const quad = walls.get(edgeKey(ax, az, bx, bz));
          if (!quad || quad.kind !== want || quad.length < FACELIFT.minWallForLight) continue;
          if (quad.length > best) { best = quad.length; entranceEdge = i; }
        }
        if (entranceEdge >= 0) break;
      }
    }

    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]!;
      const [bx, bz] = ring[(i + 1) % ring.length]!;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 1e-6) continue;
      const out = outward(ax, az, bx, bz);
      const f = wallFrame([ax, az], [bx, bz], out);
      const quad = walls.get(edgeKey(ax, az, bx, bz));

      // Kit glow: over city-mesh.ts's strips (every 8 m+ edge) and its entrance band.
      if (plan.celKit && length >= 8) {
        const hl = length / 2 - 0.25;
        const color = rgb(pickHex(physicalFacelift.strip, `${building.id}:facelift:stripTone`));
        glow(() => { for (const s of [-1, 1]) stripBox(buffer, f, s * hl, h, color); });
        stats.kitStripCovers++;
        if (kitDoor && kitDoor.edge === i) {
          const at = kitDoor.at;
          glow(() => box(buffer, f, [at - 1.75, 2.42, 1.3], [at + 1.75, 2.63, 1.46], rgb(physicalFacelift.entrance), { skip: ['back'] }));
          stats.kitEntranceCovers++;
        }
      }

      if (!quad) continue;
      const blank = quad.kind === WALL_KINDS.lotLine || quad.kind === WALL_KINDS.blankStone;
      const street = quad.kind === WALL_KINDS.shop || quad.kind === WALL_KINDS.entry;

      // Skin: frames and joints on masonry walls that have windows.
      const mode = (plan.frames ? 1 : 0) + (plan.panels ? 2 : 0);
      if (isMasonry && mode > 0 && !blank && length >= FACELIFT.minWallForSkin && masonryPos && masonryNormal && masonryWall && masonryGrid) {
        const v0 = quad.vertex;
        const nx = masonryNormal[v0 * 3]!; const nz = masonryNormal[v0 * 3 + 2]!;
        buffer.surface(FACELIFT.frameRoughness, 0);
        for (let k = 0; k < 6; k++) {
          const v = v0 + k;
          buffer.vertex(
            masonryPos[v * 3]! + nx * FACELIFT.skinOffset, masonryPos[v * 3 + 1]!, masonryPos[v * 3 + 2]! + nz * FACELIFT.skinOffset,
            nx, 0, nz, rgb(physicalFacelift.frame),
          );
          skin.push(masonryWall.subarray(v * 4, v * 4 + 4), masonryGrid.subarray(v * 4, v * 4 + 4), mode, 0);
        }
        stats.skinWalls++;
      }

      // Vertical light up both ends of the street walls.
      if (plan.verticalLight && !plan.celKit && street && length >= FACELIFT.minWallForLight && h >= 6) {
        const hl = length / 2 - 0.25;
        const color = rgb(pickHex(physicalFacelift.strip, `${building.id}:facelift:stripTone`));
        glow(() => { for (const s of [-1, 1]) stripBox(buffer, f, s * hl, h, color); });
        stats.strips += 2;
      }

      // Upgraded entrance: a painted-aluminium canopy and its light band, over the shader's door bay or a shop bay.
      if (i === entranceEdge && !canopyDone) {
        const { s, bayWidth } = quad.kind === WALL_KINDS.entry
          ? doorBayCentre(length, quad.grid)
          : shopBay(length, quad.grid, `${building.id}:${i}:facelift:bay`);
        const at = s - length / 2;
        const half = Math.min(FACELIFT.canopyMaxWidth, Math.max(1.6, bayWidth - 0.2)) / 2;
        const y0 = FACELIFT.canopyBottom;
        const y1 = y0 + FACELIFT.canopyThickness;
        const d = FACELIFT.canopyDepth;
        solid(() => {
          buffer.surface(FACELIFT.canopyRoughness, 0);
          box(buffer, f, [at - half, y0, 0], [at + half, y1, d], rgb(physicalFacelift.canopy), { skip: ['back'] });
        });
        glow(() => box(buffer, f, [at - half + 0.1, y0 - 0.08, d - 0.2], [at + half - 0.1, y0, d - 0.05], rgb(physicalFacelift.entrance), { skip: ['back', 'top'] }));
        canopyDone = true;
        stats.canopies++;
      }

      // Planted balconies on rear walls only, so street-face fire escapes stay.
      if (plan.balcony && !plan.celKit && quad.kind === WALL_KINDS.rear && length >= FACELIFT.minWallForBalcony) {
        const pitch = quad.grid[0];
        const top = Math.floor((h * NYCHA_BALCONY_TOP) / pitch);
        solid(() => {
          for (let k = 2; k <= top; k++) {
            if (hashUnit(`${building.id}:${i}:facelift:balcony:${k}`) >= NYCHA_BALCONY_SHARE) continue;
            const at = (hashUnit(`${building.id}:${i}:${k}:facelift:balcAt`) - 0.5) * Math.max(0, length - 5);
            emitNychaBalcony(buffer, f, at, k * pitch, hexToRgb(CITY_COLORS.curb), hexToRgb(physicalFacelift.frame), hexToRgb(CITY_COLORS.leafDark));
            stats.balconies++;
          }
        });
      }
    }

    // Roofline trim: brand 400/500 glow over the cel trim (same hash, so the cel trim is under it).
    if (plan.trim) {
      const color = rgb(pickHex(physicalFacelift.trim, `${building.id}:facelift:trimTone`));
      glow(() => offsetWalls(buffer, ring, h - FACELIFT.trimBottom, h - FACELIFT.trimTop, FACELIFT.trimOffset, color));
      stats.trims++;
    }

    // Roof garden on the planned roofs the kit does not already plant.
    if (plan.roofGarden && !plan.celKit && h >= 6 && Math.abs(mapArea(ring)) >= FACELIFT.gardenMinArea) {
      const garden = scaledRing(ring, FACELIFT.gardenScale);
      if (garden.every(([x, z]) => pointInRing(x, z, ring))) {
        solid(() => {
          buffer.surface(...SURFACES.wood);
          flat(THREE, buffer, garden, h + 0.06, hexToRgb(CITY_COLORS.garden));
          buffer.surface(...SURFACES.stone);
          offsetWalls(buffer, garden, h, h + FACELIFT.gardenWall, 0, hexToRgb(CITY_COLORS.curb));
        });
        stats.roofGardens++;
      }
    }
  }

  // The royal kerb light line along both kerbs of a share of the commercial avenue ways, broken where it would cross another carriageway.
  const kerb = rgb(physicalFacelift.kerb);
  const y = LAYER.sidewalks + CURB_HEIGHT + FACELIFT.kerbLift;
  glow(() => {
    for (const road of dataset.roads) {
      if (!COMMERCIAL.has(road.class) || hashUnit(`${road.id}:facelift:kerb`) >= FACELIFT.kerbShare) continue;
      const points = pairs(road.points);
      const offset = road.widthMeters / 2 + FACELIFT.kerbInset + FACELIFT.kerbWidth / 2;
      const { left, right } = ribbon(points, offset);
      for (const side of [left, right]) stats.kerbMetres += kerbLine(buffer, side, y, kerb, clearance);
    }
  });

  skin.padTo(buffer.vertexCount, 0);
  stats.vertices = buffer.vertexCount;
  return {
    buffer, plans, stats,
    wall: skin.wall.slice(0, skin.count * 4), grid: skin.grid.slice(0, skin.count * 4), mode: skin.mode.slice(0, skin.count * 2),
  };
}

/** A shop bay picked by hash on a shop wall, on the shader's bay lattice. */
function shopBay(length: number, grid: readonly number[], seed: string): { s: number; bayWidth: number } {
  const pier = Math.min(grid[3]! % 4, length * 0.2);
  const inner = length - pier * 2;
  const bays = Math.max(Math.floor(inner / grid[1]! + 0.5), 1);
  const bayWidth = inner / bays;
  const index = Math.min(Math.floor(hashUnit(seed) * bays), bays - 1);
  return { s: pier + (index + 0.5) * bayWidth, bayWidth };
}

/** A vertical light strip at local x `at`, from the street-level start to under the parapet. */
function stripBox(buffer: VertexBuffer, f: Frame, at: number, h: number, color: Rgb): void {
  const w = FACELIFT.stripHalfWidth;
  box(buffer, f, [at - w, FACELIFT.stripBottom - 0.05, 0], [at + w, h - FACELIFT.stripTopGap + 0.05, FACELIFT.stripDepth], color, { skip: ['back', 'bottom'] });
}

/** Walls of a ring between two heights, each quad pushed `offset` metres out along its own normal (city-mesh.ts emitWalls). */
function offsetWalls(buffer: VertexBuffer, ring: readonly Point[], bottom: number, top: number, offset: number, color: Rgb): void {
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    if (Math.hypot(bx - ax, bz - az) < 1e-6) continue;
    const [nx, nz] = outward(ax, az, bx, bz);
    const ox = nx * offset; const oz = nz * offset;
    buffer.quad([ax + ox, bottom, az + oz], [bx + ox, bottom, bz + oz], [bx + ox, top, bz + oz], [ax + ox, top, az + oz], [nx, 0, nz], color);
  }
}

/** A flat up-facing polygon at height y. */
function flat(THREE: Three, buffer: VertexBuffer, ring: readonly Point[], y: number, color: Rgb): void {
  const faces = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []);
  for (const face of faces) {
    let [a, b, c] = face.map((i) => ring[i]!) as [Point, Point, Point];
    if (mapArea([a, b, c]) < 0) [b, c] = [c, b];
    for (const [x, z] of [a, b, c]) buffer.vertex(x, y, z, 0, 1, 0, color);
  }
}

/** One kerb light line along a polyline, in pieces; returns the metres drawn. */
function kerbLine(buffer: VertexBuffer, line: readonly Point[], y: number, color: Rgb, clearance: StreetClearance): number {
  const half = FACELIFT.kerbWidth / 2;
  let drawn = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1]!;
    const [bx, bz] = line[i]!;
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 1e-3) continue;
    const pieces = Math.ceil(length / FACELIFT.kerbPiece);
    const dx = (bx - ax) / length; const dz = (bz - az) / length;
    const px = -dz * half; const pz = dx * half;
    for (let k = 0; k < pieces; k++) {
      const t0 = (k / pieces) * length; const t1 = ((k + 1) / pieces) * length;
      const x0 = ax + dx * t0; const z0 = az + dz * t0; const x1 = ax + dx * t1; const z1 = az + dz * t1;
      const mx = (x0 + x1) / 2; const mz = (z0 + z1) / 2;
      if (clearance.inCarriageway(mx, mz, 0) || clearance.inBuilding(mx, mz)) continue;
      // Counter-clockwise from above: right edge, then left edge.
      buffer.quad([x0 + px, y, z0 + pz], [x1 + px, y, z1 + pz], [x1 - px, y, z1 - pz], [x0 - px, y, z0 - pz], [0, 1, 0], color);
      drawn += t1 - t0;
    }
  }
  return drawn;
}

// ---- materials ------------------------------------------------------------------

type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;
type BasicMat = InstanceType<Three['MeshBasicNodeMaterial']>;

/** The shader side of glowGain: the same clamp, per fragment. */
function glowGainNode(THREE: Three, linear: TslNode, target: number): TslNode {
  const { T } = physicalTsl(THREE);
  const [r, g, b] = PHYSICAL_POST.luma;
  const lum = T.dot(linear, T.vec3(r, g, b));
  return T.clamp(T.float(target).div(T.max(lum, 1e-4)), 1, FACELIFT_GLOW.maxGain);
}

/**
 * The facelift material: lit solid parts, glow parts above the bloom
 * threshold, and alpha-tested skin quads that keep only the frames and
 * joints of E2's facade lattice.
 */
export function createFaceliftMaterial(THREE: Three): StdMat {
  const { T, c, filteredPulse, gridLine, lineAA } = physicalTsl(THREE);
  const mat = new THREE.MeshStandardNodeMaterial({ metalness: 0, roughness: FACELIFT.frameRoughness });
  mat.alphaTest = 0.5;

  const data = T.attribute(FACELIFT_ATTRIBUTE, 'vec2');
  const mode = data.x;
  const glowWeight = data.y;
  const isSkin = T.step(0.5, mode);
  const wantFrames = T.step(0.5, T.mod(mode, 2));
  const wantJoints = T.step(1.5, mode);
  const linear = T.sRGBTransferEOTF(T.attribute('color', 'vec3'));
  const roughMetal = T.attribute('aRoughMetal', 'vec2');

  const cell = facadeCell(THREE, { wallLocal: true });
  const { cellUV, fw, gridV, isRoof, isGroundFloor, solid, door, back, blank, bayWidth, floorHeight, uCoord, vCoord, coping } = cell;
  const halfX = (1 - PRE_WAR.windowRatioX) * 0.5;
  const halfY = (1 - PRE_WAR.windowRatioY) * 0.5;
  const fx = T.float(FACELIFT.frameWidth).div(bayWidth);
  const fy = T.float(FACELIFT.frameWidth).div(floorHeight);
  const open = T.float(1).sub(solid).mul(T.float(1).sub(door));
  const front = T.max(T.float(1).sub(back).sub(blank), 0);
  // The pre-war shader's band course: its windows are stone there, so no frame.
  const belt = PRE_WAR.beltEvery;
  const isCornice = T.max(
    filteredPulse(T.fract(gridV.div(belt)), 0.86, 1.0, fw.y.div(belt)).mul(front),
    isGroundFloor.mul(filteredPulse(cellUV.y, 0.86, 1.0, fw.y)),
  );
  const opening = filteredPulse(cellUV.x, halfX, 1 - halfX, fw.x).mul(filteredPulse(cellUV.y, halfY, 1 - halfY, fw.y)).mul(open);
  const glass = filteredPulse(cellUV.x, fx.add(halfX), fx.negate().add(1 - halfX), fw.x)
    .mul(filteredPulse(cellUV.y, fy.add(halfY), fy.negate().add(1 - halfY), fw.y)).mul(open);
  const rails = T.max(
    lineAA(cellUV.y.sub(0.52), T.float(FACELIFT.railHalfWidth).div(floorHeight)),
    lineAA(cellUV.x.sub(0.5), T.float(FACELIFT.railHalfWidth).div(bayWidth)),
  ).mul(glass);
  const upper = T.float(1).sub(isRoof).mul(T.float(1).sub(isCornice)).mul(T.float(1).sub(isGroundFloor));
  const frames = T.clamp(T.max(opening.sub(glass), rails), 0, 1).mul(upper).mul(wantFrames);
  const joints = T.max(gridLine(vCoord, floorHeight, FACELIFT.jointHalfWidth), gridLine(uCoord, bayWidth, FACELIFT.jointHalfWidth))
    .mul(T.float(1).sub(opening)).mul(upper).mul(T.float(1).sub(coping)).mul(T.float(1).sub(blank)).mul(wantJoints);
  const isFrame = T.step(joints, frames);

  mat.opacityNode = asNode(T.mix(T.float(1), T.max(frames, joints), isSkin));
  mat.colorNode = asColorNode(T.mix(
    // Glow parts stay dark as surfaces; their light is all emissive.
    linear.mul(T.float(1).sub(T.step(0.001, glowWeight).mul(0.9))),
    T.mix(c(physicalFacelift.panelJoint), c(physicalFacelift.frame), isFrame),
    isSkin,
  ));
  mat.roughnessNode = asNode(T.mix(roughMetal.x, T.mix(T.float(FACELIFT.jointRoughness), T.float(FACELIFT.frameRoughness), isFrame), isSkin));
  mat.metalnessNode = asNode(T.mix(roughMetal.y, T.float(0), isSkin));
  mat.emissiveNode = asNode(linear.mul(glowGainNode(THREE, linear, FACELIFT_GLOW.target)).mul(glowWeight).mul(T.float(1).sub(isSkin)));
  return mat;
}

export interface FaceliftAdMaterial {
  material: BasicMat;
  /** Seconds since start; the sweep holds still while `reducedMotion` is true. */
  update(time: number, reducedMotion: boolean): void;
}

/**
 * The LED AdSurfaces: city-mesh.ts's billboard gradient (brand pairs, top
 * to bottom), lifted above the bloom threshold, behind an LED dot pitch,
 * with a slow brightness sweep up the panel. No logos or lettering: the
 * billboard geometry carries none and this draws none.
 */
export function createFaceliftAdMaterial(THREE: Three): FaceliftAdMaterial {
  const { T } = physicalTsl(THREE);
  const material = new THREE.MeshBasicNodeMaterial();
  const time = THREE.TSL.uniform(0);
  const linear = T.sRGBTransferEOTF(T.attribute('color', 'vec3'));
  const uv = T.uv(); // metres across and up the panel (city-mesh.ts emitBillboard)
  const dots = T.mix(T.float(0.78), T.float(1), T.step(0.3, T.fract(uv.x.mul(5))).mul(T.step(0.3, T.fract(uv.y.mul(5)))));
  const phase = uv.y.div(FACELIFT_GLOW.adSweepMetres).sub(asTsl(time).div(FACELIFT_GLOW.adSweepSeconds));
  const sweep = T.float(1 - FACELIFT_GLOW.adSweepDepth).add(T.float(FACELIFT_GLOW.adSweepDepth).mul(T.sin(phase.mul(Math.PI * 2)).mul(0.5).add(0.5)));
  material.colorNode = asColorNode(T.vec4(linear.mul(glowGainNode(THREE, linear, FACELIFT_GLOW.adTarget)).mul(dots).mul(sweep), 1));
  return {
    material,
    update(t, reducedMotion) {
      if (!reducedMotion) time.value = t;
    },
  };
}

// ---- entry point ----------------------------------------------------------------

export interface PhysicalFacelift {
  /** One draw: skin, solid and glow parts. */
  mesh: Mesh | null;
  stats: FaceliftStats;
  plans: ReadonlyMap<string, FaceliftPlan>;
  /** Advance the ad sweep; pass the frame's Reduce Motion so it holds still. */
  update(time: number, reducedMotion: boolean): void;
  dispose(): void;
}

/**
 * Build the facelift over a city built with `{ facadeAttributes: true }`
 * and the physical wall materials. `meshes` is buildCityMeshes's output;
 * the billboards keep their mesh and take the ad material until dispose.
 */
export function buildPhysicalFacelift(
  THREE: Three, dataset: CityDatasetV3, meshes: readonly Mesh[], clearance: StreetClearance,
  density?: Readonly<Record<FaceliftBlock, FaceliftDensity>>,
): PhysicalFacelift {
  const byName = (name: string) => meshes.find((m) => m.name === name);
  const geometry = buildFaceliftGeometry(THREE, {
    dataset, clearance, density,
    masonry: byName('city:walls-masonry')?.geometry,
    glass: byName('city:walls-glass')?.geometry,
  });
  const material = createFaceliftMaterial(THREE);
  let mesh: Mesh | null = null;
  if (geometry.buffer.vertexCount > 0) {
    const g = geometry.buffer.toGeometry(THREE);
    g.setAttribute(FACADE_WALL_ATTRIBUTE, new THREE.BufferAttribute(geometry.wall, 4));
    g.setAttribute(FACADE_GRID_ATTRIBUTE, new THREE.BufferAttribute(geometry.grid, 4));
    g.setAttribute(FACELIFT_ATTRIBUTE, new THREE.BufferAttribute(geometry.mode, 2));
    mesh = new THREE.Mesh(g, material);
    mesh.name = 'city:facelift';
    mesh.matrixAutoUpdate = false;
  }
  const ads = createFaceliftAdMaterial(THREE);
  const billboards = byName('city:billboards');
  const previous = billboards ? (billboards.material as Mat) : null;
  if (billboards) billboards.material = ads.material;
  return {
    mesh,
    stats: geometry.stats,
    plans: geometry.plans,
    update: (time, reducedMotion) => ads.update(time, reducedMotion),
    dispose() {
      if (billboards && previous) billboards.material = previous;
      mesh?.geometry.dispose();
      material.dispose();
      ads.material.dispose();
    },
  };
}
