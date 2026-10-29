// The "future layer" (docs/implementation/MOBILE_WORLD_PR_PACK.md): the
// optional, reversible decoration that sits on the record-backed city —
// NYC roof furniture, the creator-approved NYCHA exterior facelift and the
// addressable AdSurface inventory the CMS pipeline later fills.
//
// Canon, and what is still a gap:
//
// - Roofscape: Valdrada's FURN ids 23–26 — ROOF_AC, ROOF_BULKHEAD,
//   CHIMNEY_POT, STANDPIPE — placed by its runtime roofEngine
//   (docs/design/handoff/harlem-v3.md, furniture table). No cyberpunk
//   invention: these are the four kinds the record pipeline already names.
//   The record roofKind byte (membrane, solar and green-roof bits, the DOB
//   water-tank record) is NOT in the v3 schema, so every pick below is a
//   hash rule — flagged as estimated, same discipline as `d`-less detail.
//   When a later bake imports roofKind, record bits replace the hashes the
//   way `d` replaced the v2 hashes.
// - NYCHA facelift: MOBILE_WORLD_PR_PACK "Approved art direction"
//   (creator, 2026-10-13): charcoal window framing, modular facade panels,
//   planted balconies and roof gardens, vertical architectural lighting,
//   upgraded entrances. Overlays are additive, semantic and keyed by
//   building id — FUTURE_LAYER off leaves the city byte-identical.
//   Targeting uses `class === 'nycha'`, which on the v3 tile is Valdrada
//   STYLE 12 (PROJECT_BRICK), classify()'s rule over PLUTO records. It is
//   classification against a named NYC dataset, but NOT yet the verified
//   NYCHA development dataset — that cross-check stays open as FUT-01.
//   Canon also wants >= 3 kit families by typology/borough (FUT-02); this
//   ships one procedural kit with hash variants. Courtyard landscaping,
//   wayfinding signage and entrance interiors stay unimplemented — the
//   tile does not identify campus grounds.
// - AdSurfaces: the PR pack's addressable contract — stable world-space id,
//   geo/borough/neighbourhood, orientation, dimensions, visibility limits,
//   permitted formats, LOD priority, campaign eligibility. The registry
//   below describes the LED panels the renderer already draws (D17); the
//   Payload collections the canon assigns (campaign, creative, schedule,
//   daypart, approval, community inventory, analytics) do not exist yet —
//   the schema is a product decision, so only the inventory is data-driven.
//
// Pure (no three import): placements are pure functions so node tests pin
// them; emitters write into the shared buffers, so the layer adds no draw
// calls. Everything is hash-seeded by building id — deterministic.
import type { BuildingClass, CityBuilding, CityDatasetV3, GeoPoint } from '../city-dataset.ts';
import { hashUnit, mapArea, pointInRing, ringCentroid, type VertexBuffer } from './geometry.ts';
import { box, cone, cylinder, frame, type Frame } from './parts.ts';
import { parseDefaultOnFlag } from './sky-rig.ts';
import { SURFACES } from './surfaces.ts';
import { VD_LANE } from './curb.ts';
import { facadeSpec } from './vd-facades.ts';

type Point = readonly [number, number];
type Rgb = readonly number[];

/**
 * The future layer is on (EXPO_PUBLIC_WORLD_FUTURE). Default ON;
 * EXPO_PUBLIC_WORLD_FUTURE=0 is the kill switch.
 */
export const FUTURE_LAYER = parseDefaultOnFlag(process.env.EXPO_PUBLIC_WORLD_FUTURE);

/** Per-kind counts for stats and tests. */
export interface FutureLayerStats {
  bulkheads: number;
  acUnits: number;
  chimneyPots: number;
  standpipes: number;
  nychaTowers: number;
  nychaPanels: number;
  nychaBalconies: number;
  nychaEntrances: number;
  roofGardens: number;
  lightStrips: number;
}

export function emptyFutureStats(): FutureLayerStats {
  return {
    bulkheads: 0, acUnits: 0, chimneyPots: 0, standpipes: 0,
    nychaTowers: 0, nychaPanels: 0, nychaBalconies: 0, nychaEntrances: 0,
    roofGardens: 0, lightStrips: 0,
  };
}

// --- Roofscape (Valdrada FURN 23–26) ---------------------------------------

/** No roof furniture below this height, metres — garden sheds and garages stay bare. */
export const ROOF_MIN_HEIGHT = 8;
/** Pieces a single roof may carry at most. */
export const MAX_PIECES_PER_ROOF = 4;

export type RoofPieceKind = 'bulkhead' | 'roofAc' | 'chimneyPot' | 'standpipe';
export interface RoofPiece {
  readonly kind: RoofPieceKind;
  readonly x: number;
  readonly z: number;
  /** Unit direction rows run along (chimney pots); [0, 1] elsewhere. */
  readonly dir: Point;
  /** Item count for row kinds. */
  readonly count: number;
}

/** The ring's longest edge as a unit direction — chimney rows align with it. */
export function longestEdgeDir(ring: readonly Point[]): Point {
  let best: Point = [0, 1];
  let longest = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    const l = Math.hypot(bx - ax, bz - az);
    if (l > longest) { longest = l; best = [(bx - ax) / l, (bz - az) / l]; }
  }
  return best;
}

/**
 * A spot on the roof, `clear` metres in from the footprint edge: the
 * centroid first, then deterministic jitters (a hash of the building id
 * picks the angle and radius). Returns null when nothing fits.
 */
function roofSpot(ring: readonly Point[], id: string, salt: string, clear: number): Point | null {
  const [cx, cz] = ringCentroid(ring);
  const inside = (x: number, z: number) => pointInRing(x, z, ring)
    && pointInRing(x + clear, z, ring) && pointInRing(x - clear, z, ring)
    && pointInRing(x, z + clear, ring) && pointInRing(x, z - clear, ring);
  if (inside(cx, cz)) return [cx, cz];
  const reach = Math.max(2, Math.sqrt(Math.abs(mapArea(ring)) / Math.PI) * 0.6);
  for (let k = 0; k < 8; k++) {
    const a = hashUnit(`${id}:${salt}:a${k}`) * Math.PI * 2;
    const r = Math.sqrt(hashUnit(`${id}:${salt}:r${k}`)) * reach;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (inside(x, z)) return [x, z];
  }
  return null;
}

/**
 * The roof-furniture plan for one building: which of Valdrada's four roof
 * kinds stand where. Rule-driven today (roofKind is not in v3); keyed by
 * building id so the plan is stable. Churches keep bare roofs.
 */
export function roofscapePlan(building: Pick<CityBuilding, 'id' | 'class' | 'heightMeters'>, ring: readonly Point[]): RoofPiece[] {
  const { id } = building;
  const h = building.heightMeters;
  if (h < ROOF_MIN_HEIGHT || building.class === 'church') return [];
  const area = Math.abs(mapArea(ring));
  if (area < 50) return [];
  const out: RoofPiece[] = [];
  // ROOF_BULKHEAD (24): the stair/elevator penthouse every tall NYC roof
  // needs — likelier on big footprints, never on glass curtain walls.
  if (building.class !== 'glass' && h >= 10 && area >= 100 && hashUnit(`${id}:bulkhead`) < 0.28) {
    const spot = roofSpot(ring, id, 'bh', 2.2);
    if (spot) out.push({ kind: 'bulkhead', x: spot[0], z: spot[1], dir: longestEdgeDir(ring), count: 1 });
  }
  // ROOF_AC (23): packaged condensers, mostly on commercial and large roofs.
  const acShare = building.class === 'glass' || building.class === 'civic' || building.class === 'plain' ? 0.4
    : building.class === 'brownstone' ? 0.1 : 0.2;
  if (area >= 150 && hashUnit(`${id}:roofac`) < acShare) {
    const units = 1 + Math.floor(hashUnit(`${id}:roofac:n`) * 2);
    for (let u = 0; u < units && out.length < MAX_PIECES_PER_ROOF; u++) {
      const spot = roofSpot(ring, id, `ac${u}`, 1.1);
      if (spot) out.push({ kind: 'roofAc', x: spot[0], z: spot[1], dir: [0, 1], count: 1 });
    }
  }
  // CHIMNEY_POT (25): the pot row on masonry low-rises under eight storeys.
  if (building.class !== 'glass' && h <= 25 && hashUnit(`${id}:chimney`) < 0.22) {
    const spot = roofSpot(ring, id, 'ch', 1.6);
    if (spot && out.length < MAX_PIECES_PER_ROOF) {
      out.push({ kind: 'chimneyPot', x: spot[0], z: spot[1], dir: longestEdgeDir(ring), count: 1 + Math.floor(hashUnit(`${id}:chimney:n`) * 3) });
    }
  }
  // STANDPIPE (26): a vent pipe; churches out, everything else a modest share.
  if (out.length < MAX_PIECES_PER_ROOF && hashUnit(`${id}:standpipe`) < 0.16) {
    const spot = roofSpot(ring, id, 'sp', 0.5);
    if (spot) out.push({ kind: 'standpipe', x: spot[0], z: spot[1], dir: [0, 1], count: 1 });
  }
  return out;
}

/** A stair/elevator bulkhead: a brick-and-concrete penthouse with its cap slab and a door face. */
export function emitBulkhead(buffer: VertexBuffer, x: number, z: number, roof: number, dir: Point, scale: number, brick: Rgb, concrete: Rgb, door: Rgb): void {
  const f = frame(x, z, dir, roof);
  const w = 3.2 * scale;
  const d = 2.2 * scale;
  const h = 2.6 * scale;
  buffer.surface(...SURFACES.stone);
  box(buffer, f, [-w / 2, 0, -d / 2], [w / 2, h, d / 2], brick, { skip: ['bottom'] });
  buffer.surface(...SURFACES.tarRoof);
  box(buffer, f, [-w / 2 - 0.08, h, -d / 2 - 0.08], [w / 2 + 0.08, h + 0.12, d / 2 + 0.08], concrete, { skip: ['bottom'] });
  // Door on the short face.
  box(buffer, f, [-0.4, 0, d / 2], [0.4, 1.9 * scale, d / 2 + 0.06], door, { skip: ['back', 'bottom', 'top'] });
}

/** A packaged roof condenser: box on rail feet with a fan drum on top. */
export function emitRoofAc(buffer: VertexBuffer, x: number, z: number, roof: number, metal: Rgb, dark: Rgb): void {
  const f = frame(x, z, [0, 1], roof);
  buffer.surface(...SURFACES.iron);
  for (const s of [-0.45, 0.45]) box(buffer, f, [s - 0.05, 0, -0.5], [s + 0.05, 0.15, 0.5], dark, { skip: ['bottom'] });
  buffer.surface(...SURFACES.iron);
  box(buffer, f, [-0.7, 0.15, -0.55], [0.7, 1.0, 0.55], metal, {});
  cylinder(buffer, f, 0, 0, 0.42, 1.0, 1.14, 8, dark);
}

/** A row of terracotta chimney pots along `dir`, each a short square flue with a cap slab (boxes keep the row cheap). */
export function emitChimneyPots(buffer: VertexBuffer, x: number, z: number, roof: number, dir: Point, count: number, clay: Rgb, cap: Rgb): void {
  const f = frame(x, z, dir, roof);
  for (let k = 0; k < count; k++) {
    const at = (k - (count - 1) / 2) * 0.55;
    buffer.surface(...SURFACES.stone);
    box(buffer, f, [at - 0.15, 0, -0.15], [at + 0.15, 0.7, 0.15], clay, { skip: ['bottom'] });
    buffer.surface(...SURFACES.tarRoof);
    box(buffer, f, [at - 0.19, 0.7, -0.19], [at + 0.19, 0.78, 0.19], cap, { skip: ['bottom'] });
  }
}

/** A standpipe vent: a slim square pipe with a cowl cap, 1.8 m tall. */
export function emitStandpipe(buffer: VertexBuffer, x: number, z: number, roof: number, pipe: Rgb, cap: Rgb): void {
  const f = frame(x, z, [0, 1], roof);
  buffer.surface(...SURFACES.iron);
  box(buffer, f, [-0.09, 0, -0.09], [0.09, 1.6, 0.09], pipe, { skip: ['bottom'] });
  cone(buffer, f, 0, 0, 0.2, 1.6, 1.85, 6, cap);
}

// --- NYCHA exterior facelift (PR pack art direction, creator 2026-10-13) ---

/** The facelift targets the nycha class only: Valdrada STYLE 12, PROJECT_BRICK. */
export function isNychaTower(building: Pick<CityBuilding, 'class'>): boolean {
  return building.class === 'nycha';
}

/** Panel module pitch on the facade, metres. */
export const NYCHA_PANEL_PITCH = 3.0;
/** Balcony share per eligible floor edge (hash of building id + edge + floor). */
export const NYCHA_BALCONY_SHARE = 0.24;
/** Balconies climb no higher than this share of the tower, so the silhouette stays masonry. */
export const NYCHA_BALCONY_TOP = 0.7;

/**
 * The modular panel grid on one facade edge: a charcoal spandrel band at
 * each floor line (the "charcoal window framing" of the canon — the facade
 * shader owns the panes, so the kit frames the slab edges) and vertical
 * concrete fins at the panel pitch. Written into the near-field detail
 * buffer, banded like the stoops.
 */
export function emitNychaPanels(buffer: VertexBuffer, f: Frame, length: number, heightMeters: number, floorPitch: number, charcoal: Rgb, fin: Rgb): void {
  const hl = length / 2 - 0.4;
  const floors = Math.max(2, Math.round(heightMeters / floorPitch));
  buffer.surface(...SURFACES.stone);
  // A spandrel band every other floor line: the panel seams read without
  // doubling the vertex cost of a per-floor grid.
  for (let k = 2; k < floors; k += 2) {
    box(buffer, f, [-hl, k * floorPitch - 0.1, 0], [hl, k * floorPitch + 0.12, 0.05], charcoal, { skip: ['back', 'bottom'] });
  }
  buffer.surface(...SURFACES.stone);
  // Vertical fins at twice the panel pitch — the grid reads at street range.
  const fins = Math.floor((length - 1.5) / (NYCHA_PANEL_PITCH * 2));
  for (let m = 0; m <= fins; m++) {
    const x = -hl + 0.6 + m * NYCHA_PANEL_PITCH * 2;
    box(buffer, f, [x - 0.07, 0.4, 0], [x + 0.07, heightMeters - 0.6, 0.04], fin, { skip: ['back', 'bottom'] });
  }
}

/** A planted balcony: slab, front rail and the planter strip that greens the edge. */
export function emitNychaBalcony(buffer: VertexBuffer, f: Frame, at: number, floorY: number, slab: Rgb, rail: Rgb, leaf: Rgb): void {
  buffer.surface(...SURFACES.stone);
  box(buffer, f, [at - 1.1, floorY - 0.18, 0], [at + 1.1, floorY, 1.0], slab, {});
  buffer.surface(...SURFACES.iron);
  box(buffer, f, [at - 1.1, floorY + 0.9, 0.94], [at + 1.1, floorY + 1.0, 1.0], rail, { skip: ['back', 'bottom', 'left', 'right'] });
  buffer.surface(...SURFACES.wood);
  box(buffer, f, [at - 0.9, floorY, 0.62], [at + 0.9, floorY + 0.28, 0.9], leaf, { skip: ['back', 'bottom'] });
}

/** Whether this edge floor carries a planted balcony (deterministic). */
export function hasNychaBalcony(id: string, edge: number, floor: number): boolean {
  return hashUnit(`${id}:${edge}:balcony:${floor}`) < NYCHA_BALCONY_SHARE;
}

/**
 * The upgraded entrance: a concrete canopy over the door, a warm lit band
 * under it (into the neon buffer — the near-future light, not a sign) and
 * two planters beside the opening.
 */
export function emitNychaEntrance(buffer: VertexBuffer, glow: VertexBuffer, f: Frame, at: number, canopy: Rgb, warm: Rgb, soil: Rgb, leaf: Rgb): void {
  buffer.surface(...SURFACES.stone);
  box(buffer, f, [at - 1.8, 2.6, 0], [at + 1.8, 2.9, 1.5], canopy, { skip: ['back'] });
  box(buffer, f, [at - 1.6, 0, 1.1], [at - 1.0, 0.5, 1.7], soil, {});
  box(buffer, f, [at + 1.0, 0, 1.1], [at + 1.6, 0.5, 1.7], soil, {});
  buffer.surface(...SURFACES.wood);
  box(buffer, f, [at - 1.55, 0.5, 1.15], [at - 1.05, 0.8, 1.65], leaf, {});
  box(buffer, f, [at + 1.05, 0.5, 1.15], [at + 1.55, 0.8, 1.65], leaf, {});
  // The lit band runs under the canopy lip — warm architectural light.
  box(glow, f, [at - 1.7, 2.45, 1.32], [at + 1.7, 2.6, 1.44], warm, { skip: ['back', 'bottom'] });
}

/**
 * Vertical architectural lighting: a slim warm strip up each end of a
 * facade edge, from the canopy line to the parapet — the canon's "vertical
 * architectural lighting", kept to two quads per edge.
 */
export function emitNychaLightStrip(glow: VertexBuffer, f: Frame, length: number, heightMeters: number, warm: Rgb): void {
  const hl = length / 2 - 0.25;
  glow.surface(...SURFACES.iron);
  for (const s of [-1, 1]) {
    box(glow, f, [s * hl - 0.09, 1.2, 0], [s * hl + 0.09, heightMeters - 0.5, 0.04], warm, { skip: ['back', 'bottom'] });
  }
}

/** The footprint scaled about its centroid — the roof garden's planted patch. */
export function scaledRing(ring: readonly Point[], scale: number): [number, number][] {
  const [cx, cz] = ringCentroid(ring);
  return ring.map(([x, z]) => [cx + (x - cx) * scale, cz + (z - cz) * scale]);
}

// --- Addressable AdSurface inventory (PR pack contract) ---------------------

/**
 * Creative formats the renderer can show today. The canon wants CMS-driven
 * stills/video/holograms; until the Payload collections exist a surface
 * honestly lists the one format the mesh draws.
 */
export const AD_FORMATS = ['emissive-panel'] as const;

/** Classes whose buildings are residences or sensitive uses: no paid campaigns. */
const AD_RESIDENTIAL: ReadonlySet<BuildingClass> = new Set(['brownstone', 'brick', 'nycha', 'church']);

/**
 * Campaign placement eligibility (PR pack: "no arbitrary advertising on
 * real residences"; community placements for nonprofits and small local
 * businesses stay welcome everywhere).
 */
export function adEligibility(class_: BuildingClass): 'campaign' | 'community' {
  return AD_RESIDENTIAL.has(class_) ? 'community' : 'campaign';
}

/** The stable world-space id: one per building edge. */
export function adSurfaceId(buildingId: string, edge: number): string {
  return `ad:${buildingId}:e${edge}`;
}

/** Inverse of projectCityPoint (city-dataset.ts) — local metres back to WGS84. */
export function unprojectCityPoint(x: number, z: number, origin: GeoPoint): GeoPoint {
  const radians = Math.PI / 180;
  const radius = 6_371_008.8;
  const [originLon, originLat] = origin;
  return [x / (radians * radius * Math.cos(originLat * radians)) + originLon, originLat - z / (radians * radius)];
}

export interface AdSurface {
  readonly id: string;
  readonly buildingId: string;
  readonly edge: number;
  readonly kind: 'facade-panel';
  /** Panel centre in tile-local metres. */
  readonly x: number;
  readonly z: number;
  /** WGS84 position, for the geo-targeted campaign join. */
  readonly geo: GeoPoint;
  /** This tile's locale (Harlem, Manhattan) — single-tile game today. */
  readonly borough: 'Manhattan';
  readonly neighborhood: 'Harlem';
  /** Unit outward direction the panel faces. */
  readonly normal: Point;
  readonly widthMeters: number;
  readonly heightMeters: number;
  /** Top edge height, metres; the panel runs top-heightMeters .. topMeters. */
  readonly topMeters: number;
  readonly formats: readonly (typeof AD_FORMATS)[number][];
  readonly eligibility: 'campaign' | 'community';
  /** 0..1, nearest the play centre first — the CMS's LOD pick order. */
  readonly lodPriority: number;
  /** Dataset the surface belongs to (the registry key changes with the tile). */
  readonly tileId: string;
}

/** One registry row for a rendered panel — same numbers the emitter drew. */
export function adSurface(
  building: Pick<CityBuilding, 'id' | 'class'>, edge: number,
  x: number, z: number, normal: Point, widthMeters: number, heightMeters: number, topMeters: number,
  dataset: Pick<CityDatasetV3, 'id' | 'origin' | 'extentMeters'>,
): AdSurface {
  const distance = Math.hypot(x, z);
  return {
    id: adSurfaceId(building.id, edge),
    buildingId: building.id,
    edge,
    kind: 'facade-panel',
    x, z,
    geo: unprojectCityPoint(x, z, dataset.origin),
    borough: 'Manhattan',
    neighborhood: 'Harlem',
    normal,
    widthMeters,
    heightMeters,
    topMeters,
    formats: AD_FORMATS,
    eligibility: adEligibility(building.class),
    lodPriority: Math.max(0, 1 - distance / dataset.extentMeters),
    tileId: dataset.id,
  };
}

// --- Physical facelift: which buildings carry which piece ---------------------
//
// The facelift restated for the physically lit city (Slop-grade city plan
// § 5.5; docs/design/handoff/slop-grade-city.md § 4). Under
// EXPO_PUBLIC_WORLD_PHYSICAL the kit stops being all-or-nothing on one
// class: each block type carries each piece on a share of its buildings,
// picked by a hash of the stable building id, so the same buildings always
// carry the same pieces and the street stays lived-in rather than uniformly
// lit. physical/facelift.ts builds the geometry from these plans. Nothing
// above this section reads them, so the cel city's bytes do not change.
//
// FUT-01 is still open. `projectTower` is found by `class === 'nycha'`,
// which is Valdrada STYLE 12 (PROJECT_BRICK) from classify() over PLUTO
// records, not the verified NYCHA development dataset. The block type is a
// look for tall project-brick slabs and carries no NYCHA claim or label.

/** Block types of the density proposal, in the order classifyFaceliftBlock tests them. */
export const FACELIFT_BLOCKS = ['civic', 'projectTower', 'glass', 'avenue', 'brownstoneSide', 'walkUp', 'other'] as const;
export type FaceliftBlock = (typeof FACELIFT_BLOCKS)[number];

/** Brick walk-ups are the `brick` class in D18's fire-escape band, metres. */
export const WALK_UP_HEIGHT: readonly [number, number] = [12, 32];

/**
 * One block type's row. Every share is the fraction of that block type's
 * buildings carrying the piece, 0..1.
 */
export interface FaceliftDensity {
  /** Refined wall tone on the facade family. */
  readonly palette: number;
  /** Painted-aluminium window frames. */
  readonly frames: number;
  /** Modular panel joints over the wall. */
  readonly panels: number;
  /** Panels only on buildings with at least this many floors. */
  readonly panelMinFloors: number;
  readonly roofGarden: number;
  /** Planted balconies, on rear walls (street faces keep their fire escapes). */
  readonly balcony: number;
  /** Vertical light strips up the ends of the street walls. */
  readonly verticalLight: number;
  /** Lit canopy over the door or a shop bay. */
  readonly entrance: number;
  /**
   * Neon roofline trim. 'today' keeps city-mesh.ts neonTrimShare (D17,
   * 18-85 % by height); a number is the share, capped by today's rule so
   * every planned trim sits on a building that already has one.
   */
  readonly trim: number | 'today';
  /**
   * city-mesh.ts already builds this block's balconies, panel fins,
   * entrance, light strips and roof garden (the 2026-10-18 kit); the
   * physical facelift adds frames, joints and the glow over that kit
   * instead of a second copy.
   */
  readonly celKit: boolean;
}

/**
 * The handoff's proposed densities (§ 4, "Proposed density per block
 * type"), for Mike to approve inside G6. None is measured: change a number
 * here and the plan, the geometry and the tests follow. `other` is not in
 * the proposal (brick under 12 m or over 32 m and plain fronts off the
 * avenues) and stays as shipped: no facelift, today's trims.
 */
export const FACELIFT_DENSITY: Readonly<Record<FaceliftBlock, FaceliftDensity>> = {
  avenue: {
    palette: 0.6, frames: 0.6, panels: 0.25, panelMinFloors: 5, roofGarden: 0.1, balcony: 0,
    verticalLight: 0.15, entrance: 0.5, trim: 'today', celKit: false,
  },
  brownstoneSide: {
    palette: 0.3, frames: 0.3, panels: 0, panelMinFloors: 0, roofGarden: 0.1, balcony: 0,
    verticalLight: 0, entrance: 0.2, trim: 0.1, celKit: false,
  },
  walkUp: {
    palette: 0.4, frames: 0.4, panels: 0, panelMinFloors: 0, roofGarden: 0, balcony: 0.15,
    verticalLight: 0.05, entrance: 0.25, trim: 0.15, celKit: false,
  },
  projectTower: {
    palette: 1, frames: 1, panels: 1, panelMinFloors: 0, roofGarden: 1, balcony: 1,
    verticalLight: 1, entrance: 1, trim: 0, celKit: true,
  },
  civic: {
    palette: 0, frames: 0, panels: 0, panelMinFloors: 0, roofGarden: 0, balcony: 0,
    verticalLight: 0, entrance: 0, trim: 0, celKit: false,
  },
  glass: {
    palette: 0, frames: 0, panels: 0, panelMinFloors: 0, roofGarden: 0.2, balcony: 0,
    verticalLight: 0.3, entrance: 0.5, trim: 'today', celKit: false,
  },
  other: {
    palette: 0, frames: 0, panels: 0, panelMinFloors: 0, roofGarden: 0, balcony: 0,
    verticalLight: 0, entrance: 0, trim: 'today', celKit: false,
  },
};

/**
 * A building's block type. `onAvenue` is the D17 fascia rule (a wall
 * within 14 m of a primary, secondary or trunk road); landmarks, civic
 * stone and churches come first so they stay the reference points.
 */
export function classifyFaceliftBlock(
  building: Pick<CityBuilding, 'class' | 'heightMeters'>, context: { landmark: boolean; onAvenue: boolean },
): FaceliftBlock {
  if (context.landmark || building.class === 'civic' || building.class === 'church') return 'civic';
  if (building.class === 'nycha') return 'projectTower';
  if (building.class === 'glass') return 'glass';
  if (context.onAvenue) return 'avenue';
  if (building.class === 'brownstone') return 'brownstoneSide';
  const [low, high] = WALK_UP_HEIGHT;
  if (building.class === 'brick' && building.heightMeters >= low && building.heightMeters <= high) return 'walkUp';
  return 'other';
}

export interface FaceliftPlan {
  readonly block: FaceliftBlock;
  readonly palette: boolean;
  readonly frames: boolean;
  readonly panels: boolean;
  readonly roofGarden: boolean;
  readonly balcony: boolean;
  readonly verticalLight: boolean;
  readonly entrance: boolean;
  readonly trim: boolean;
  readonly celKit: boolean;
}

const NO_FACELIFT: Omit<FaceliftPlan, 'block'> = {
  palette: false, frames: false, panels: false, roofGarden: false, balcony: false, verticalLight: false,
  entrance: false, trim: false, celKit: false,
};

/** Floors for the panel rule: the record's `f`, else the height over the record's or a 3.2 m pitch. */
function floorCount(building: Pick<CityBuilding, 'heightMeters' | 'floors' | 'floorHeightMeters'>): number {
  return building.floors ?? Math.round(building.heightMeters / (building.floorHeightMeters ?? 3.2));
}

/**
 * Which pieces one building carries. Each piece has its own hash of the
 * building id, so a share change moves only that piece. `todayTrimShare`
 * is city-mesh.ts neonTrimShare(height); the trim uses the cel trim's own
 * hash so a planned trim always lands on a building the cel city trims.
 */
export function faceliftPlan(
  building: Pick<CityBuilding, 'id' | 'heightMeters' | 'floors' | 'floorHeightMeters'>, block: FaceliftBlock, todayTrimShare: number,
  density: Readonly<Record<FaceliftBlock, FaceliftDensity>> = FACELIFT_DENSITY,
): FaceliftPlan {
  // A building Valdrada measured (vd-facade-specs.ts: the 125th Street fronts and the landmark heroes) keeps its real
  // facade under the vd lane: no refreshed tone, frames, joints, canopies, light strips, gardens or trim on it.
  if (VD_LANE && facadeSpec(building.id)) return { ...NO_FACELIFT, block };
  const row = density[block];
  const pick = (piece: string, share: number) => share > 0 && hashUnit(`${building.id}:facelift:${piece}`) < share;
  const trimShare = row.trim === 'today' ? todayTrimShare : Math.min(row.trim, todayTrimShare);
  return {
    block,
    palette: pick('palette', row.palette),
    frames: pick('frames', row.frames),
    panels: floorCount(building) >= row.panelMinFloors && pick('panels', row.panels),
    roofGarden: pick('garden', row.roofGarden),
    balcony: pick('balcony', row.balcony),
    verticalLight: pick('light', row.verticalLight),
    entrance: pick('entrance', row.entrance),
    trim: trimShare > 0 && hashUnit(`${building.id}:trim`) < trimShare,
    celKit: row.celKit,
  };
}
