// Bakes the tile into a handful of meshes, one per material: facades
// (masonry and glass), roofs, contact shadows, land-use areas, sidewalks,
// roads and landmark accents. Every building, road and area lands in a
// shared vertex buffer, so draw calls stay flat as the feature count grows
// (metro-live's mergeByMaterial, applied while building). Beside colour,
// each vertex carries its surface family — aRoughMetal from the surfaces.ts
// ranges by a building/road id hash, and aOcclusion from the contact-shadow
// field — which only the flagged PBR materials read; the cel lane ignores
// the extra attributes entirely.
import type { Three } from '@acme/ui/three';
import type { BuildingClass, CityBuilding, CityDatasetV3, CityLandmark, CityRoad, RoadClass } from '../city-dataset.ts';
import { counterClockwise, hashUnit, mapArea, pairs, pointInRing, ribbon, VertexBuffer } from './geometry.ts';
import {
  emitAwning, emitCornice, emitFireEscapeFloor, emitParapet, emitStoop, emitWaterTower, fireEscapeFloors, FLOOR_HEIGHT,
  hasFireEscape, hasShopSign, hasStoop, hasWaterTower, shopWords, STOOP_REACH, STOOP_WIDTH, towerSpot, wallFrame,
} from './facade-detail.ts';
import { emitStackedText, emitText, textWidth, type TextFace } from './lettering.ts';
import {
  adSurface, emitBulkhead, emitChimneyPots, emitNychaBalcony, emitNychaEntrance, emitNychaLightStrip, emitNychaPanels,
  emitRoofAc, emitStandpipe, emptyFutureStats, FUTURE_LAYER, hasNychaBalcony, isNychaTower, NYCHA_BALCONY_TOP,
  roofscapePlan, scaledRing, type AdSurface, type FutureLayerStats,
} from './future-layer.ts';
import { BandedBuffer, box } from './parts.ts';
import type { CityMaterials } from './materials.ts';
import { WINDOW_GRID } from './windows.ts';
import { createStreetClearance, WALKWAY_CLASSES, type StreetClearance } from './walkability.ts';
import { AWNING_TONES, CITY_COLORS, hexToRgb, WALL_TONES, type CityColor } from './palette.ts';
import { CURB_HEIGHT, VD_LANE } from './curb.ts';
import { VD_STOREFRONTS } from './vd-storefronts.ts';
import { facadePhoto } from './vd-facades.ts';
import { buildingSurface, ContactField, contactReach, surfacePick, SURFACES, wallAo } from './surfaces.ts';

type Point = [number, number];
type Mesh = InstanceType<Three['Mesh']>;

/** Ground-plane layers, metres. Small enough to vanish next to a 1.8 m Caller; polygon offset does the rest. */
export const LAYER = { areas: 0.02, sidewalks: 0.045, roads: 0.06, crossings: 0.065, shadows: 0.08 } as const;
/** Area kinds bottom to top: big lawns first so pitches and playgrounds sit on them. */
export const AREA_ORDER = ['school', 'parking', 'park', 'garden', 'grass', 'plaza', 'pitch', 'playground', 'water'] as const;
/**
 * Height of an area kind. Each kind gets its own 2.5 mm step (was 0.01 mm per
 * area, which no depth buffer resolves past a few metres), all below the
 * sidewalks.
 */
export const AREA_STEP = 0.0025;
export function areaLayer(kind: string): number {
  const i = AREA_ORDER.indexOf(kind as (typeof AREA_ORDER)[number]);
  return LAYER.areas + Math.max(0, i) * AREA_STEP;
}
/** Contact shadows draw only in z bands this tall, metres, around the Caller ... */
export const SHADOW_BAND_METRES = 50;
/** ... out to this distance north and south of them. */
export const SHADOW_RADIUS = 160;
/** The z bands to draw for a focus z: [first, last], inclusive, clamped to the tile. `out` reuses the caller's tuple so per-frame callers allocate nothing. */
export function shadowBands(focusZ: number, minZ: number, bandCount: number, out: [number, number] = [0, 0]): [number, number] {
  const first = Math.floor((focusZ - SHADOW_RADIUS - minZ) / SHADOW_BAND_METRES);
  const last = Math.floor((focusZ + SHADOW_RADIUS - minZ) / SHADOW_BAND_METRES);
  out[0] = Math.max(0, Math.min(bandCount - 1, first));
  out[1] = Math.max(0, Math.min(bandCount - 1, last));
  return out;
}

const rgb = (key: CityColor) => hexToRgb(CITY_COLORS[key]);
const tint = (color: readonly number[], amount: number) => color.map((v) => Math.max(0, Math.min(1, v * amount)));

const CENTRE_LINE_MIN_WIDTH = 9;

/** Triangulate a ring (with holes) and emit it facing up at height y, counter-clockwise on the map. `ao` bakes per-corner occlusion when given. */
function emitFlat(THREE: Three, buffer: VertexBuffer, ring: Point[], holes: Point[][], y: number, color: readonly number[], ao?: (x: number, z: number) => number): void {
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
  const holeVectors = holes.map((hole) => hole.map(([x, z]) => new THREE.Vector2(x, z)));
  const all = [...ring, ...holes.flat()];
  const faces = THREE.ShapeUtils.triangulateShape(contour, holeVectors);
  for (const face of faces) {
    let [a, b, c] = face.map((i) => all[i]!) as [Point, Point, Point];
    if (!a || !b || !c) continue;
    if (mapArea([a, b, c]) < 0) [b, c] = [c, b];
    for (const [x, z] of [a, b, c]) buffer.vertex(x, y, z, 0, 1, 0, color, x, z, ao?.(x, z));
  }
}

/**
 * Walls around a ring. Outer rings counter-clockwise on the map, holes clockwise, so normals face out of the solid. `ao` is the [bottom, top] occlusion pair.
 * `uvScale` rescales the metre uv the facade shader grids over: the v3 bake's floor height and window width land the shader's fixed rows and columns on the real pitch.
 */
function emitWalls(buffer: VertexBuffer, ring: Point[], bottom: number, top: number, color: readonly number[], outward = 0, ao?: readonly [number, number], uvScale: readonly [number, number] = [1, 1]): void {
  let along = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 1e-6) continue;
    // Right of travel on a north-up map, in scene axes (x east, z south).
    const nx = -(bz - az) / length;
    const nz = (bx - ax) / length;
    const ox = nx * outward;
    const oz = nz * outward;
    buffer.quad(
      [ax + ox, bottom, az + oz], [bx + ox, bottom, bz + oz], [bx + ox, top, bz + oz], [ax + ox, top, az + oz],
      [nx, 0, nz], color,
      [
        [along * uvScale[0], bottom * uvScale[1]], [(along + length) * uvScale[0], bottom * uvScale[1]],
        [(along + length) * uvScale[0], top * uvScale[1]], [along * uvScale[0], top * uvScale[1]],
      ],
      ao && [ao[0], ao[0], ao[1], ao[1]],
    );
    along += length;
  }
}

/** A soft contact-shadow strip from the wall out to `reach` metres, nudged away from the sun. */
function emitShadow(buffer: VertexBuffer, ring: Point[], reach: number, sunAway: Point, color: readonly number[]): void {
  const n = ring.length;
  const outer: Point[] = [];
  for (let i = 0; i < n; i++) {
    const [px, pz] = ring[(i + n - 1) % n]!;
    const [x, z] = ring[i]!;
    const [qx, qz] = ring[(i + 1) % n]!;
    const n1 = normalOf(px, pz, x, z);
    const n2 = normalOf(x, z, qx, qz);
    let mx = n1[0] + n2[0];
    let mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const scale = reach / Math.max(0.45, mx * n1[0] + mz * n1[1]);
    // Push the outer edge further on the side facing away from the sun.
    const lean = Math.max(0, mx * sunAway[0] + mz * sunAway[1]) * reach * 0.8;
    outer.push([x + mx * scale + sunAway[0] * lean, z + mz * scale + sunAway[1] * lean]);
  }
  const y = LAYER.shadows;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[j]!;
    const [cx, cz] = outer[j]!;
    const [dx, dz] = outer[i]!;
    buffer.quad([ax, y, az], [bx, y, bz], [cx, y, cz], [dx, y, dz], [0, 1, 0], color, [[0, 0], [0, 0], [0, 1], [0, 1]]);
  }
}

function normalOf(ax: number, az: number, bx: number, bz: number): Point {
  const length = Math.hypot(bx - ax, bz - az) || 1;
  return [-(bz - az) / length, (bx - ax) / length];
}

/** A box from its centre, facing direction (unit, scene x/z), width, depth and vertical span. */
function emitBox(buffer: VertexBuffer, cx: number, cz: number, dir: Point, width: number, depth: number, bottom: number, top: number, color: readonly number[]): void {
  const [fx, fz] = dir;
  const rx = -fz; const rz = fx; // across the facade
  const hw = width / 2; const hd = depth / 2;
  const corner = (s: number, t: number): Point => [cx + rx * hw * s + fx * hd * t, cz + rz * hw * s + fz * hd * t];
  const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  const ccw = counterClockwise(ring);
  emitWalls(buffer, ccw, bottom, top, color);
  for (const y of [top, bottom]) {
    const [a, b, c, d] = ccw as [Point, Point, Point, Point];
    const face = y === top ? [a, b, c, d] : [a, d, c, b];
    buffer.quad(
      [face[0]![0], y, face[0]![1]], [face[1]![0], y, face[1]![1]], [face[2]![0], y, face[2]![1]], [face[3]![0], y, face[3]![1]],
      [0, y === top ? 1 : -1, 0], color,
    );
  }
}

/** The footprint edge facing the nearest road, as midpoint, outward direction and length. */
function streetFace(ring: Point[], roads: readonly CityRoad[]): { mid: Point; out: Point; length: number } | null {
  let best: { mid: Point; out: Point; length: number } | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 4) continue;
    const mid: Point = [(ax + bx) / 2, (az + bz) / 2];
    const out = normalOf(ax, az, bx, bz);
    const probe: Point = [mid[0] + out[0] * 8, mid[1] + out[1] * 8];
    let near = Infinity;
    for (const road of roads) {
      if (WALKWAY_CLASSES.has(road.class) || road.class === 'service' || road.class === 'crossing') continue;
      const p = road.points;
      for (let k = 2; k < p.length; k += 2) {
        const d = segmentDistance(probe[0], probe[1], p[k - 2]!, p[k - 1]!, p[k]!, p[k + 1]!);
        if (d < near) near = d;
      }
    }
    // Prefer close, long edges: the frontage, not a side wall.
    const score = near - length * 0.3;
    if (score < bestScore) { bestScore = score; best = { mid, out, length }; }
  }
  return best;
}

/**
 * The front face a v3 building carries as `fi` (the stored ring's edge index), in the
 * same shape `streetFace` returns. Right of travel is outward only on a
 * counter-clockwise ring, so a stored clockwise ring flips the normal.
 */
function recordedFace(building: CityBuilding): { mid: Point; out: Point; length: number } | null {
  const i = building.frontEdgeIndex;
  if (i === undefined || i < 0) return null;
  const pts = pairs(building.ring);
  const n = pts.length;
  if (i >= n) return null;
  const a = pts[i]!;
  const b = pts[(i + 1) % n]!;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 1e-6) return null;
  const [ox, oz] = normalOf(a[0], a[1], b[0], b[1]);
  const out: Point = mapArea(pts) < 0 ? [-ox, -oz] : [ox, oz];
  return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], out, length };
}

function segmentDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax; const dz = bz - az;
  const len = dx * dx + dz * dz;
  const t = len > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len)) : 0;
  return Math.hypot(ax + dx * t - x, az + dz * t - z);
}

function landmarkAccents(buffer: VertexBuffer, text: VertexBuffer, landmark: CityLandmark, building: CityBuilding, ring: Point[], roads: readonly CityRoad[]): void {
  const face = recordedFace(building) ?? streetFace(ring, roads);
  const h = building.heightMeters;
  switch (landmark.key) {
    case 'apollo-theater': {
      if (!face) return;
      // Marquee band over the entrance, and the tall blade sign standing out from the wall, both lettered APOLLO.
      const width = Math.min(face.length * 0.8, 16);
      const [mx, mz] = face.mid;
      const [ox, oz] = face.out;
      emitBox(buffer, mx + ox * 0.9, mz + oz * 0.9, face.out, width, 1.8, 4.2, 5.6, rgb('marquee'));
      emitBox(buffer, mx + ox * 1.85, mz + oz * 1.85, face.out, width + 0.2, 0.12, 4.35, 5.45, rgb('marqueeLights'));
      const right: Point = [oz, -ox];
      emitText(text, 'APOLLO', { x: mx + ox * 1.93, y: 4.9, z: mz + oz * 1.93, right, height: 0.8, color: rgb('marquee') });
      const across: Point = [-oz, ox];
      const side = width * 0.32;
      const top = Math.min(h + 2, 17);
      const bx = mx + across[0] * side; const bz = mz + across[1] * side;
      emitBox(buffer, bx + ox * 1.5, bz + oz * 1.5, face.out, 0.5, 2.6, 6, top, rgb('marquee'));
      const letter = Math.min(1.3, (top - 6 - 0.8) / (6 * 1.18));
      for (const s of [1, -1]) {
        // Each face of the blade reads down the street it faces.
        const n: Point = [across[0] * s, across[1] * s];
        emitStackedText(text, 'APOLLO', {
          x: bx + ox * 1.5 + n[0] * 0.27, y: (6 + top) / 2, z: bz + oz * 1.5 + n[1] * 0.27,
          right: [n[1], -n[0]], height: letter, color: rgb('marqueeLights'),
        });
      }
      return;
    }
    case 'hotel-theresa':
      // A pale crown band at the cornice; the walls already take the terracotta colour.
      emitWalls(buffer, ring, h - 1.6, h - 0.4, rgb('marqueeLights'), 0.08);
      return;
    case 'acp-state-office':
      emitWalls(buffer, ring, h - 1.2, h - 0.5, rgb('beacon'), 0.08);
      return;
  }
}

export interface CityMeshStats {
  buildings: number; roads: number; areas: number; triangles: number; drawCalls: number; neonTrims: number; storefronts: number; billboards: number;
  cornices: number; stoops: number; fireEscapes: number; awnings: number; shopSigns: number; waterTowers: number;
  parapets: number;
  /** The flagged future layer (future-layer.ts): all zero when FUTURE_LAYER is off. */
  future: FutureLayerStats;
}

/**
 * The `d` detail bitset (city-dataset.ts §5.2 order: cornice, fire escape,
 * stoop, water tower, storefront, setbacks, gable). Where the bake carries a
 * mask, each bit replaces the v2 hash outright. Bits 5 (setbacks) and 6
 * (gable) are data only for now: the mesh has no setback or gable feature
 * for them to drive, and `e` provenance bits never reach the renderer.
 */
const DETAIL = { cornice: 1, fireEscape: 2, stoop: 4, waterTower: 8, storefront: 16 } as const;

/** Masonry fronts that carry a cornice. */
const CORNICE_CLASSES: ReadonlySet<BuildingClass> = new Set(['brownstone', 'brick', 'nycha', 'civic', 'church', 'plain']);
/** Lit shop-sign panels: brand faces under white lettering. */
const SHOP_SIGN_TONES = ['awningRed', 'awningGreen', 'awningBlue', 'awningOrange', 'awningBlack'] as const satisfies readonly CityColor[];

/** The wall tone for a building: one of its class's family, by a hash of its id. */
export function wallTone(building: Pick<CityBuilding, 'id' | 'class'>): CityColor {
  const family: readonly CityColor[] = WALL_TONES[building.class];
  return family[Math.floor(hashUnit(`${building.id}:tone`) * family.length) % family.length]!;
}

/** Roads whose frontage gets storefront light bands and billboards: Harlem's commercial avenues and 125th Street. */
const COMMERCIAL: ReadonlySet<RoadClass> = new Set(['primary', 'secondary', 'trunk']);
const NEON_KEYS = ['neonOrange', 'neonRoyal', 'neonCarolina', 'neonApple', 'neonLeaf'] as const satisfies readonly CityColor[];
/** Billboard gradients, top to bottom, all brand pairs. */
const BILLBOARD_PAIRS = [
  ['neonOrange', 'neonApple'], ['neonRoyal', 'neonCarolina'], ['neonCarolina', 'neonLeaf'], ['neonApple', 'neonRoyal'], ['neonOrange', 'neonRoyal'],
] as const satisfies readonly (readonly [CityColor, CityColor])[];
export const MAX_BILLBOARDS = 48;
/**
 * Top edge a hologram can mount at, metres. The chase camera never pitches
 * to a roofline, so boards clamp into the band a player sees: above the
 * storefront signs (~4 m), below the second storey. Taller facades still
 * qualify — only their mount height drops.
 */
export const BILLBOARD_TOP = 12;

/**
 * Share of buildings of a height that carry a neon roofline trim. Taller
 * buildings are likelier: the skyline is where the near-future city shows.
 */
export function neonTrimShare(heightMeters: number): number {
  if (heightMeters < 9) return 0;
  return Math.min(0.85, 0.18 + (heightMeters - 9) * 0.02);
}

/** Brand neon colour for a building, by a hash of its id. */
export function neonKeyFor(id: string): (typeof NEON_KEYS)[number] {
  return NEON_KEYS[Math.floor(hashUnit(`${id}:neon`) * NEON_KEYS.length) % NEON_KEYS.length]!;
}

export function buildCityMeshes(THREE: Three, dataset: CityDatasetV3, materials: CityMaterials, sunAway: Point, clearance: StreetClearance = createStreetClearance(dataset), future = FUTURE_LAYER) {
  const masonry = new VertexBuffer(262144);
  const glass = new VertexBuffer();
  const roofs = new VertexBuffer(131072);
  const shadows = new VertexBuffer(196608);
  const areas = new VertexBuffer();
  const sidewalks = new VertexBuffer(16384);
  const roads = new VertexBuffer(16384);
  const accents = new VertexBuffer();
  const neon = new VertexBuffer(65536);
  const billboards = new VertexBuffer();
  // Street-level detail drawn only near the Caller: stoops, fire escapes, awnings.
  const detail = new BandedBuffer();
  const landmarkText = new VertexBuffer();
  const texts: (TextFace & { text: string })[] = [];
  const adSurfaces: AdSurface[] = [];
  const futureStats = emptyFutureStats();
  let cornices = 0; let stoops = 0; let fireEscapes = 0; let awnings = 0; let shopSigns = 0; let waterTowers = 0;
  let parapets = 0;
  const landmarkByBuilding = new Map(dataset.landmarks.map((l) => [l.buildingId, l]));
  const shadowColor = rgb('shadow');
  const commercial = new SegmentGrid(dataset.roads.filter((r) => COMMERCIAL.has(r.class)));
  // vd lane: Valdrada's measured 125th Street storefronts, by nyc-mon building id.
  const storefronts = new Map<string, (typeof VD_STOREFRONTS)[number][]>();
  if (VD_LANE) for (const front of VD_STOREFRONTS) storefronts.set(front.b, [...(storefronts.get(front.b) ?? []), front]);
  // Baked occlusion: footprints collect into the contact-shadow field as the
  // banded loop runs, and the ground layers emit after it queries them.
  const field = new ContactField();
  const occlude = (x: number, z: number) => field.occlusion(x, z);

  // Buildings in z bands, so the contact shadows of one band are one vertex range (drawn by distance).
  const minZ = -dataset.extentMeters - SHADOW_BAND_METRES;
  const bandCount = Math.max(1, Math.ceil((dataset.extentMeters * 2 + SHADOW_BAND_METRES * 2) / SHADOW_BAND_METRES) + 1);
  const bandOf = (building: CityBuilding) => {
    let z = 0;
    const r = building.ring;
    for (let i = 1; i < r.length; i += 2) z += r[i]!;
    z /= Math.max(1, r.length / 2);
    return Math.max(0, Math.min(bandCount - 1, Math.floor((z - minZ) / SHADOW_BAND_METRES)));
  };
  const banded = dataset.buildings.map((building) => ({ building, band: bandOf(building) })).sort((x, y) => x.band - y.band);
  const bandStart = new Int32Array(bandCount + 1);
  let band = -1;
  let trims = 0;
  let fronts = 0;
  let boards = 0;

  for (const { building, band: buildingBand } of banded) {
    while (band < buildingBand) bandStart[++band] = shadows.vertexCount;
    detail.mark(buildingBand);
    // The ccw ring and whether the stored order flipped: `fi` indexes the
    // stored ring, so a stored clockwise ring shifts the recorded front edge.
    const flat = pairs(building.ring);
    const reversed = mapArea(flat) < 0;
    const ring = reversed ? [...flat].reverse() : flat;
    const n = ring.length;
    const frontEdge =
      building.frontEdgeIndex !== undefined && building.frontEdgeIndex >= 0 && building.frontEdgeIndex < n
        ? reversed ? (((n - 2 - building.frontEdgeIndex) % n) + n) % n : building.frontEdgeIndex
        : -1;
    const holes = building.holes.map((hole) => counterClockwise(pairs(hole)).reverse());
    const landmark = landmarkByBuilding.get(building.id);
    const variation = 0.92 + hashUnit(building.id) * 0.16;
    const wallKey: CityColor = landmark?.key === 'hotel-theresa' ? 'terracotta' : wallTone(building);
    const wall = tint(rgb(wallKey), variation);
    const target = building.class === 'glass' ? glass : masonry;
    const h = building.heightMeters;
    // Surface family per building id, and the wall-base occlusion ramp over
    // this building's shadow reach (surfaces.ts). Cornices written into the
    // same buffer inherit the wall pick — stone trim belongs to the family.
    target.surface(...buildingSurface(building.class, building.id));
    target.facade(...facadePhoto(building));
    const reach = contactReach(h);
    const wallOcclusion: [number, number] = [wallAo(0, reach), wallAo(h, reach)];
    field.add(ring, h);
    // v3 facts: `fh` and `ww` rescale the wall uv so the facade shader's
    // fixed window grid lands on the real floor pitch and bay module
    // (scale 1 on v2 buildings — the emitted bytes are unchanged there).
    const grid = building.class === 'glass' ? WINDOW_GRID.glass : WINDOW_GRID.masonry;
    const uvScale: [number, number] = [
      grid.bay / (building.windowWidthMeters ?? grid.bay),
      grid.floor / (building.floorHeightMeters ?? grid.floor),
    ];
    emitWalls(target, ring, 0, h, wall, 0, wallOcclusion, uvScale);
    for (const hole of holes) emitWalls(target, hole, 0, h, wall, 0, wallOcclusion, uvScale);
    roofs.surface(...SURFACES.tarRoof);
    const roofColor = tint(rgb('roof').map((v, i) => v * 0.8 + wall[i]! * 0.2), variation);
    emitFlat(THREE, roofs, ring, holes, h, roofColor);
    emitShadow(shadows, ring, Math.max(1.2, Math.min(5, h * 0.12)), sunAway, shadowColor);
    if (landmark) { landmarkAccents(accents, landmarkText, landmark, building, ring, dataset.roads); continue; }

    // The near-future layer: a neon roofline, storefront light bands and the odd billboard.
    const neonColor = rgb(neonKeyFor(building.id));
    if (hashUnit(`${building.id}:trim`) < neonTrimShare(h)) {
      emitWalls(neon, ring, h - 0.32, h - 0.06, neonColor, 0.06);
      trims++;
    }
    let stooped = false;
    const measured = storefronts.get(building.id);
    if (measured) {
      for (const front of measured) {
        const counts = emitMeasuredFront(front, neon, detail.buffer, texts);
        shopSigns += counts.signs;
        awnings += counts.awnings;
      }
    }
    let escaped = false;
    let entranced = false;
    // v3 facts: `d` bit-gates each detail feature, `f`/`fh` set the escape's
    // floor count and pitch, `ww` the storefront bays, `sh` the band height.
    // Where the mask is absent (v2 tiles, unmatched records) the hash rules
    // below run exactly as before.
    const mask = building.detailMask;
    const floorPitch = building.floorHeightMeters ?? FLOOR_HEIGHT;
    const escapeFloors = building.floors !== undefined ? Math.max(0, building.floors - 1) : fireEscapeFloors(h);
    const shopTop = building.storefrontHeightMeters !== undefined && building.storefrontHeightMeters > 0 ? building.storefrontHeightMeters : undefined;
    // The wall uv's `u` is metres along the ring, continuous from vertex 0 —
    // the facade shader's column grid (gates, window panes) keys on it, so
    // storefront geometry must sit on the same lattice, not on edge-centred
    // bays: column `c` covers metres [c*pitch, (c+1)*pitch) of `u`.
    let u0 = 0;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]!;
      const [bx, bz] = ring[(i + 1) % ring.length]!;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 1e-6) continue;
      const edgeStart = u0;
      u0 += length;
      if (length < 4) continue;
      const out = normalOf(ax, az, bx, bz);
      const mid: Point = [(ax + bx) / 2, (az + bz) / 2];
      const f = wallFrame([ax, az], [bx, bz], out);
      const along: Point = [f.oz, -f.ox];
      // A street face: a carriageway within about a sidewalk's width of the wall.
      const facesStreet = clearance.kerbGap(mid[0] + out[0] * 3.5, mid[1] + out[1] * 3.5) < 7;
      const onAvenue = length >= 5 && h >= 6 && commercial.nearest(mid[0] + out[0] * 6, mid[1] + out[1] * 6) <= 14;
      // NYCHA facelift (future-layer.ts, PR pack art direction): the modular
      // panel grid, planted balconies and vertical light go on every long
      // edge — the towers stand in campuses, so the kit does not wait for a
      // street face. The upgraded entrance lands on the recorded front.
      if (future && isNychaTower(building) && length >= 8) {
        emitNychaPanels(detail.buffer, f, length, h, floorPitch, rgb('iron'), tint(rgb('civic'), 0.8));
        futureStats.nychaPanels++;
        emitNychaLightStrip(neon, f, length, h, rgb('windowWarm'));
        futureStats.lightStrips++;
        const balconyTop = Math.floor((h * NYCHA_BALCONY_TOP) / floorPitch);
        for (let k = 2; k <= balconyTop; k++) {
          if (!hasNychaBalcony(building.id, i, k)) continue;
          const at = (hashUnit(`${building.id}:${i}:${k}:balcAt`) - 0.5) * Math.max(0, length - 5);
          emitNychaBalcony(detail.buffer, f, at, k * floorPitch, rgb('curb'), rgb('iron'), rgb('leafDark'));
          futureStats.nychaBalconies++;
        }
        const onNychaFront = frontEdge < 0 || i === frontEdge;
        if (onNychaFront && !entranced) {
          const at = (hashUnit(`${building.id}:${i}:doorAt`) - 0.5) * Math.max(0, length - 8);
          emitNychaEntrance(detail.buffer, neon, f, at, rgb('limestone'), rgb('windowWarm'), rgb('cedar'), rgb('leafDark'));
          entranced = true;
          futureStats.nychaEntrances++;
        }
      }
      if (!facesStreet && !onAvenue) continue;
      // The recorded front edge: single-face details land there when the tile says which face is the front.
      const onFront = frontEdge < 0 || i === frontEdge;

      // Cornice along the roof line of masonry street fronts, with the
      // brick parapet lip it crowns — the roofline a New York block reads
      // on. The lip goes to the near-field detail band; at overview range
      // the cornice still carries the line.
      if (mask === undefined ? CORNICE_CLASSES.has(building.class) && h < 45 : (mask & DETAIL.cornice) !== 0) {
        emitCornice(masonry, f, length, h, tint(rgb('cornice').map((v, k) => v * 0.6 + wall[k]! * 0.4), 1));
        emitParapet(detail.buffer, f, length, h, tint(wall, 0.82));
        cornices++;
        parapets++;
      }
      // A brownstone's stoop, off one street face, when the sidewalk has room for it.
      const wantsStoop = mask === undefined ? building.class === 'brownstone' && hasStoop(building.id) : (mask & DETAIL.stoop) !== 0 && onFront;
      if (wantsStoop && !onAvenue && !stooped && length >= 5) {
        const at = (hashUnit(`${building.id}:door`) - 0.5) * Math.max(0, length - STOOP_WIDTH - 1.2);
        const tip: Point = [mid[0] + along[0] * at + out[0] * (STOOP_REACH + 0.2), mid[1] + along[1] * at + out[1] * (STOOP_REACH + 0.2)];
        if (clearance.standable(tip[0], tip[1])) {
          emitStoop(detail.buffer, f, at, tint(wall, 0.9), rgb('iron'));
          stooped = true;
          stoops++;
        }
      }
      // Zig-zag fire escape on a tenement front, one per building on its recorded front, over a central bay.
      const wantsEscape = mask === undefined ? hasFireEscape(building.id, i, h, building.class) : (mask & DETAIL.fireEscape) !== 0 && onFront && !escaped;
      if (length >= 7 && wantsEscape && escapeFloors > 0) {
        const at = (hashUnit(`${building.id}:${i}:bay`) - 0.5) * Math.max(0, length - 4);
        for (let k = 1; k <= escapeFloors; k++) emitFireEscapeFloor(detail.buffer, f, at, k * floorPitch, rgb('iron'), k % 2 === 0);
        escaped = true;
        fireEscapes++;
      }
      if (!onAvenue) continue;

      // Storefronts: awnings over most bays, and either a lit shop sign or the plain fascia band.
      // Canopies sit on the shader's own column lattice — column centres in
      // edge-local metres — so a roll-down gate reads inside its canopy.
      if (measured) { fronts++; continue; }
      if (mask === undefined || (mask & DETAIL.storefront) !== 0) {
        const pitch = building.windowWidthMeters ?? grid.bay;
        const inset = 0.6;
        const c0 = Math.ceil((edgeStart + inset) / pitch - 0.5);
        const c1 = Math.floor((edgeStart + length - inset) / pitch - 0.5);
        for (let cIdx = c0; cIdx <= c1; cIdx++) {
          if (hashUnit(`${building.id}:${i}:${cIdx}:awning`) > 0.55) continue;
          const at = (cIdx + 0.5) * pitch - edgeStart - length / 2;
          const tone = AWNING_TONES[Math.floor(hashUnit(`${building.id}:${i}:${cIdx}:hue`) * AWNING_TONES.length) % AWNING_TONES.length]!;
          emitAwning(detail.buffer, f, at, Math.min(3.8, pitch - 0.2), rgb(tone));
          awnings++;
        }
        if (hasShopSign(building.id, i)) {
          const width = Math.min(length * 0.75, 9);
          const panel = rgb(SHOP_SIGN_TONES[Math.floor(hashUnit(`${building.id}:${i}:panel`) * SHOP_SIGN_TONES.length) % SHOP_SIGN_TONES.length]!);
          const signTop = shopTop ?? 4.05;
          box(neon, f, [-width / 2, signTop - 0.9, 0], [width / 2, signTop, 0.18], panel, { skip: ['back', 'bottom'] });
          const words = shopWords(building.id, i);
          const condense = Math.max(0.5, Math.min(1, (width - 0.4) / textWidth(words, 0.42)));
          if (textWidth(words, 0.42, condense) <= width - 0.2) {
            texts.push({ text: words, x: mid[0] + out[0] * 0.2, y: signTop - 0.45, z: mid[1] + out[1] * 0.2, right: along, height: 0.42, condense, color: rgb('signText') });
          }
          shopSigns++;
        } else {
          // Storefront band: a lit fascia above the shop windows, inset from the corners.
          const bandTop = shopTop ?? 3.45;
          const inset = Math.min(0.8, length * 0.08);
          const ux = (bx - ax) / length; const uz = (bz - az) / length;
          const off = 0.12;
          const [sx, sz] = [ax + ux * inset + out[0] * off, az + uz * inset + out[1] * off];
          const [ex, ez] = [bx - ux * inset + out[0] * off, bz - uz * inset + out[1] * off];
          // One quad facing the street (emitWalls on a two-point ring would add a hidden back face).
          neon.quad([sx, bandTop - 0.3, sz], [ex, bandTop - 0.3, ez], [ex, bandTop, ez], [sx, bandTop, sz], [out[0], 0, out[1]], tint(neonColor, 0.95));
        }
        fronts++;
      }
      if (boards < MAX_BILLBOARDS && h >= 16 && length >= 8 && hashUnit(`${building.id}:${i}:board`) < 0.4) {
        const [top, bottom] = BILLBOARD_PAIRS[Math.floor(hashUnit(`${building.id}:pair`) * BILLBOARD_PAIRS.length) % BILLBOARD_PAIRS.length]!;
        const bw = Math.min(length * 0.55, 9);
        const bh = Math.min(Math.min(h * 0.32, 7), BILLBOARD_TOP - 4.6);
        const btop = Math.min(h - 2.2, BILLBOARD_TOP);
        emitBillboard(billboards, mid, out, bw, bh, btop, rgb(top), rgb(bottom));
        boards++;
        // The addressable AdSurface row the CMS pipeline reads (future-layer.ts):
        // the same numbers the emitter drew, keyed by a stable world-space id.
        adSurfaces.push(adSurface(building, i, mid[0] + out[0] * 0.3, mid[1] + out[1] * 0.3, out, bw, bh, btop, dataset));
      }
    }
    // A wooden water tower on a share of the five-storey-and-up roofs.
    if (mask === undefined ? hasWaterTower(building.id, h, building.class) : (mask & DETAIL.waterTower) !== 0) {
      const scale = 0.85 + hashUnit(`${building.id}:tankScale`) * 0.35;
      const spot = towerSpot(ring, (x, z) => pointInRing(x, z, ring), 1.9 * scale);
      if (spot) {
        emitWaterTower(roofs, spot[0], spot[1], h, scale, rgb('cedar'), rgb('towerSteel'), rgb('towerRoof'));
        waterTowers++;
      }
    }
    if (future) {
      // Roof furniture (future-layer.ts): Valdrada's roofscape kinds —
      // bulkhead, packaged AC, chimney pots, standpipe — on id-hash rules.
      // Into the banded detail buffer, so only the roofs near the Caller pay.
      for (const piece of roofscapePlan(building, ring)) {
        switch (piece.kind) {
          case 'bulkhead':
            emitBulkhead(detail.buffer, piece.x, piece.z, h, piece.dir, 0.9 + hashUnit(`${building.id}:bhScale`) * 0.3, tint(wall, 0.95), rgb('cornice'), rgb('roomDoor'));
            futureStats.bulkheads++;
            break;
          case 'roofAc':
            emitRoofAc(detail.buffer, piece.x, piece.z, h, rgb('carGrey'), rgb('iron'));
            futureStats.acUnits++;
            break;
          case 'chimneyPot':
            emitChimneyPots(detail.buffer, piece.x, piece.z, h, piece.dir, piece.count, rgb('brickRed'), rgb('cornice'));
            futureStats.chimneyPots += piece.count;
            break;
          case 'standpipe':
            emitStandpipe(detail.buffer, piece.x, piece.z, h, rgb('iron'), rgb('gate'));
            futureStats.standpipes++;
            break;
        }
      }
      // The facelift's roof garden: the planted patch and its low planter
      // wall on the tower roof (always drawn — it reads in the aerials).
      if (isNychaTower(building)) {
        futureStats.nychaTowers++;
        const garden = scaledRing(ring, 0.55);
        roofs.surface(...SURFACES.wood);
        emitFlat(THREE, roofs, garden, [], h + 0.06, rgb('garden'));
        emitWalls(roofs, garden, h, h + 0.45, rgb('curb'));
        futureStats.roofGardens++;
      }
    }
  }
  const detailStart = detail.finish(bandCount);
  while (band < bandCount) bandStart[++band] = shadows.vertexCount;

  // Draw order inside one mesh follows array order at equal depth; each kind also sits on its own step.
  const sortedAreas = [...dataset.areas].sort((a, b) => areaLayer(a.kind) - areaLayer(b.kind));
  for (const area of sortedAreas) {
    const ring = counterClockwise(pairs(area.ring));
    const holes = area.holes.map((hole) => pairs(hole));
    areas.surface(...areaSurface(area.kind, hashUnit(`${area.id}:surf`)));
    emitFlat(THREE, areas, ring, holes, areaLayer(area.kind) + CURB_HEIGHT, rgb(AREA_COLOR[area.kind] ?? 'grass'), occlude);
  }

  for (const road of dataset.roads) {
    const points = pairs(road.points);
    if (WALKWAY_CLASSES.has(road.class)) {
      const color = road.class === 'pedestrian' ? rgb('plaza') : rgb('sidewalk');
      sidewalks.surface(...surfacePick('masonry', hashUnit(`${road.id}:walk`)));
      strip(sidewalks, points, road.widthMeters / 2, LAYER.sidewalks + CURB_HEIGHT, color, occlude);
      continue;
    }
    if (road.sidewalkMeters > 0) {
      sidewalks.surface(...surfacePick('masonry', hashUnit(`${road.id}:walk`)));
      strip(sidewalks, points, road.widthMeters / 2 + road.sidewalkMeters, LAYER.sidewalks + CURB_HEIGHT, rgb('sidewalk'), occlude);
    }
    if (CURB_HEIGHT > 0 && road.class !== 'crossing') {
      sidewalks.surface(...SURFACES.stone);
      curbFaces(sidewalks, points, road.widthMeters / 2, LAYER.roads, LAYER.sidewalks + CURB_HEIGHT, rgb('curb'), clearance);
    }
    const zebra = road.class === 'crossing' ? 1 : 0;
    const centre = !zebra && road.widthMeters >= CENTRE_LINE_MIN_WIDTH ? 1 : 0;
    roads.surface(...surfacePick('asphalt', hashUnit(`${road.id}:surf`)));
    strip(roads, points, road.widthMeters / 2, zebra ? LAYER.crossings : LAYER.roads, [centre, zebra, road.widthMeters / 100], occlude);
  }

  const meshes: Mesh[] = [];
  const add = (name: string, buffer: VertexBuffer, material: InstanceType<Three['Material']>, renderOrder = 0) => {
    if (buffer.vertexCount === 0) return null;
    const mesh = new THREE.Mesh(buffer.toGeometry(THREE), material);
    mesh.name = name;
    mesh.renderOrder = renderOrder;
    mesh.matrixAutoUpdate = false;
    meshes.push(mesh);
    return mesh;
  };
  const areaMesh = add('city:areas', areas, materials.areas);
  const walkMesh = add('city:sidewalks', sidewalks, materials.sidewalks);
  if (CURB_HEIGHT > 0) {
    // Raised ground drawn as an underlay: lots and sidewalks sit at curb
    // height but write no depth and draw before the roads, so the
    // carriageway (and the attached-sidewalk ribbons it overlaps) still
    // reads on top, sunk below the curb faces.
    for (const [mesh, order] of [[areaMesh, -3], [walkMesh, -2]] as const) {
      if (!mesh) continue;
      mesh.renderOrder = order;
      (mesh.material as InstanceType<Three['Material']>).depthWrite = false;
    }
  }
  add('city:roads', roads, materials.roads);
  add('city:walls-masonry', masonry, materials.masonry);
  add('city:walls-glass', glass, materials.glass);
  add('city:roofs', roofs, materials.roofs);
  add('city:landmarks', accents, materials.accents);
  add('city:neon', neon, materials.neon);
  add('city:billboards', billboards, materials.billboards);
  // Same cel material as the roofs (vertex colour, no pattern); drawn by band near the Caller.
  const detailMesh = add('city:street-detail', detail.buffer, materials.roofs);
  if (detailMesh) detailMesh.frustumCulled = false;
  add('city:landmark-lettering', landmarkText, materials.lettering);
  // Transparent, after the opaque city.
  const shadowMesh = add('city:contact-shadows', shadows, materials.shadows, 2);
  // The strip spans the tile; its draw range follows the Caller, so culling by bounds would be wrong.
  if (shadowMesh) shadowMesh.frustumCulled = false;

  const triangles = meshes.reduce((sum, m) => sum + m.geometry.getAttribute('position').count / 3, 0);
  const stats: CityMeshStats = {
    buildings: dataset.buildings.length, roads: dataset.roads.length, areas: dataset.areas.length,
    triangles, drawCalls: meshes.length, neonTrims: trims, storefronts: fronts, billboards: boards,
    cornices, stoops, fireEscapes, awnings, shopSigns, waterTowers, parapets,
    future: futureStats,
  };
  const shownBands: [number, number] = [-1, -1];
  const bands: [number, number] = [0, 0];
  return {
    meshes,
    /**
     * The meshes whose draw state changes at run time: setFocus re-ranges
     * both by z band around the Caller. A WebGPU render bundle freezes
     * recorded draw parameters, so these must stay outside one
     * (world/index.ts EXPERIMENTAL_WORLD_BUNDLES).
     */
    mutableMeshes: ([detailMesh, shadowMesh] as (Mesh | null)[]).filter((m): m is Mesh => m !== null),
    stats,
    /** Shop-sign lettering for the banded lettering mesh (street-furniture.ts). */
    texts,
    /** The AdSurface registry rows for the panels this build drew (future-layer.ts). */
    adSurfaces,
    /** Contact shadows only near the focus: a few z bands, one draw range, no allocation. */
    setFocus(_x: number, z: number) {
      shadowBands(z, minZ, bandCount, bands);
      const first = bands[0], last = bands[1];
      if (first === shownBands[0] && last === shownBands[1]) return;
      shownBands[0] = first;
      shownBands[1] = last;
      const start = bandStart[first]!;
      shadowMesh?.geometry.setDrawRange(start, bandStart[last + 1]! - start);
      detailMesh?.geometry.setDrawRange(detailStart[first]!, detailStart[last + 1]! - detailStart[first]!);
    },
    dispose: () => { for (const mesh of meshes) mesh.geometry.dispose(); },
  };
}

/** An LED panel standing off a facade: gradient top to bottom, uv for the scan lines. */
function emitBillboard(buffer: VertexBuffer, mid: Point, out: Point, width: number, height: number, top: number, upper: readonly number[], lower: readonly number[]): void {
  const across: Point = [-out[1], out[0]];
  const off = 0.3;
  const hw = width / 2;
  const cx = mid[0] + out[0] * off; const cz = mid[1] + out[1] * off;
  const l: Point = [cx - across[0] * hw, cz - across[1] * hw];
  const r: Point = [cx + across[0] * hw, cz + across[1] * hw];
  const bottom = top - height;
  // Counter-clockwise seen from the street: l-bottom, r-bottom, r-top, l-top with `across` to the viewer's right.
  const corners: [Point, number, readonly number[], number, number][] = [
    [r, bottom, lower, 0, 0], [l, bottom, lower, 1, 0], [l, top, upper, 1, 1], [r, top, upper, 0, 1],
  ];
  for (const k of [0, 1, 2, 0, 2, 3]) {
    const [[x, z], y, color, u, v] = corners[k]!;
    buffer.vertex(x, y, z, out[0], 0, out[1], color, u * width, v * height);
  }
}

/** Road segments bucketed in 32 m cells, for "how far is the nearest road" from a facade. */
class SegmentGrid {
  private readonly cells = new Map<number, number[]>();
  private static readonly CELL = 32;
  constructor(roads: readonly CityRoad[]) {
    for (const road of roads) {
      const p = road.points;
      for (let k = 2; k < p.length; k += 2) {
        const ax = p[k - 2]!; const az = p[k - 1]!; const bx = p[k]!; const bz = p[k + 1]!;
        const pad = road.widthMeters / 2;
        const x0 = Math.floor((Math.min(ax, bx) - pad) / SegmentGrid.CELL); const x1 = Math.floor((Math.max(ax, bx) + pad) / SegmentGrid.CELL);
        const z0 = Math.floor((Math.min(az, bz) - pad) / SegmentGrid.CELL); const z1 = Math.floor((Math.max(az, bz) + pad) / SegmentGrid.CELL);
        for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
          const key = cx * 65_536 + cz;
          let cell = this.cells.get(key);
          if (!cell) { cell = []; this.cells.set(key, cell); }
          cell.push(ax, az, bx, bz, pad);
        }
      }
    }
  }

  /** Distance from (x, z) to the nearest road edge in its cell and the 8 around it; Infinity if none. */
  nearest(x: number, z: number): number {
    const cx = Math.floor(x / SegmentGrid.CELL); const cz = Math.floor(z / SegmentGrid.CELL);
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
}

const AREA_COLOR: Record<string, CityColor> = {
  park: 'park', garden: 'garden', grass: 'grass', pitch: 'pitch', playground: 'playground',
  plaza: 'plaza', parking: 'parking', water: 'water', school: 'school',
};

/** Surface family per area kind: planted kinds read as foliage, hard ground as masonry, water gets its own flat pick. */
const AREA_FAMILY: Record<string, 'foliage' | 'masonry'> = {
  park: 'foliage', garden: 'foliage', grass: 'foliage', pitch: 'foliage',
};
function areaSurface(kind: string, seed: number): readonly [number, number] {
  if (kind === 'water') return SURFACES.water;
  return surfacePick(AREA_FAMILY[kind] ?? 'masonry', seed);
}

/**
 * One of Valdrada's measured storefronts: per bay, the sign it recorded
 * (a panel or lightbox board in its background colour with the name in its
 * letter colour, or bare channel letters on the wall) and its awning. Bay
 * and sign spans are metres from the face's left end as seen from the
 * street; the frame's local +x runs that way (facade-detail.ts wallFrame).
 */
function emitMeasuredFront(
  front: (typeof VD_STOREFRONTS)[number], boards: VertexBuffer, canopies: VertexBuffer, texts: (TextFace & { text: string })[],
): { signs: number; awnings: number } {
  const a: Point = [front.ax, front.az];
  const b: Point = [front.ax + front.dx * front.len, front.az + front.dz * front.len];
  const f = wallFrame(a, b, [front.nx, front.nz]);
  const along: Point = [front.dx, front.dz];
  const half = front.len / 2;
  let signs = 0; let awnings = 0;
  for (const bay of front.bays) {
    const sign = 'sign' in bay ? bay.sign : undefined;
    if (sign) {
      const x0 = Math.max(0, sign.u0) - half; const x1 = Math.min(front.len, sign.u1) - half;
      const width = x1 - x0;
      if (width > 0.4) {
        const board = sign.bg !== null;
        if (board) boards.surface(...SURFACES.iron);
        if (board) box(boards, f, [x0, sign.y, 0.02], [x1, sign.y + sign.h, sign.k === 'lightbox' ? 0.24 : 0.1], sign.bg, { skip: ['back', 'bottom'] });
        if (board) {
          // Near-future layer: LED strips along the board's top and bottom edges, lit in the sign's letter colour.
          const d = (sign.k === 'lightbox' ? 0.24 : 0.1) + 0.012;
          const led = sign.fg.map((v) => Math.min(1, v * 0.6 + 0.4));
          for (const yy of [sign.y, sign.y + sign.h - 0.045]) box(boards, f, [x0, yy, d - 0.01], [x1, yy + 0.045, d], led, { skip: ['back', 'bottom', 'top'] });
        }
        let height = Math.min(sign.h * 0.62, 0.7);
        let condense = Math.max(0.45, Math.min(1, (width - 0.3) / textWidth(sign.t, height)));
        while (textWidth(sign.t, height, condense) > width - 0.15 && height > 0.12) height *= 0.9;
        if (textWidth(sign.t, height, condense) <= width - 0.1) {
          const centre = (x0 + x1) / 2;
          const lift = board ? (sign.k === 'lightbox' ? 0.26 : 0.12) : 0.06;
          texts.push({
            text: sign.t,
            x: f.x + along[0] * centre + front.nx * lift, y: sign.y + sign.h / 2, z: f.z + along[1] * centre + front.nz * lift,
            right: along, height, condense, color: sign.fg,
          });
        }
        signs++;
      }
    }
    const awning = 'aw' in bay ? bay.aw : undefined;
    if (awning) {
      const u0 = Math.max(0, bay.u0); const u1 = Math.min(front.len, bay.u1);
      if (u1 - u0 > 0.8) {
        emitAwning(canopies, f, (u0 + u1) / 2 - half, u1 - u0 - 0.1, awning.c, awning.top, awning.proj);
        awnings++;
      }
    }
  }
  return { signs, awnings };
}

/**
 * Granite curb faces along both carriageway edges, from road level up to
 * the sidewalk top, facing the road. A face whose outside lands in another
 * carriageway (a junction mouth, a crossing) is left out, as Valdrada's
 * emitter skips faces inside `inCarriageway` (compile.mjs ~L2985).
 */
function curbFaces(buffer: VertexBuffer, points: Point[], half: number, y0: number, y1: number, color: readonly number[], clearance: StreetClearance): void {
  if (points.length < 2) return;
  const { left, right, v } = ribbon(points, half);
  for (const edge of [left, right]) {
    for (let i = 1; i < points.length; i++) {
      const a = edge[i - 1]!; const b = edge[i]!;
      const mx = (a[0] + b[0]) / 2; const mz = (a[1] + b[1]) / 2;
      const cx = (points[i - 1]![0] + points[i]![0]) / 2; const cz = (points[i - 1]![1] + points[i]![1]) / 2;
      const len = Math.hypot(mx - cx, mz - cz);
      if (len < 1e-6) continue;
      // Unit normal toward the road centre.
      const nx = (cx - mx) / len; const nz = (cz - mz) / len;
      if (clearance.inCarriageway(mx - nx * 0.6, mz - nz * 0.6, 0)) continue;
      const u0 = v[i - 1]!; const u1 = v[i]!;
      buffer.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [nx, 0, nz], color,
        [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]);
    }
  }
}

/** A flat ribbon along a polyline; u runs across (0..1), v along in metres. `ao` bakes per-corner occlusion when given. */
function strip(buffer: VertexBuffer, points: Point[], half: number, y: number, color: readonly number[], ao?: (x: number, z: number) => number): void {
  if (points.length < 2) return;
  const { left, right, v } = ribbon(points, half);
  for (let i = 1; i < points.length; i++) {
    const a = left[i - 1]!; const b = left[i]!; const c = right[i]!; const d = right[i - 1]!;
    // Ordered so the face is counter-clockwise on the map (front side up).
    const quad: [Point, Point, Point, Point] = [d, c, b, a];
    const uvs = [[1, v[i - 1]!], [1, v[i]!], [0, v[i]!], [0, v[i - 1]!]];
    const area = mapArea(quad);
    const ordered = area >= 0 ? quad : ([a, b, c, d] as [Point, Point, Point, Point]);
    const orderedUv = area >= 0 ? uvs : [[0, v[i - 1]!], [0, v[i]!], [1, v[i]!], [1, v[i - 1]!]];
    buffer.quad(
      [ordered[0][0], y, ordered[0][1]], [ordered[1][0], y, ordered[1][1]], [ordered[2][0], y, ordered[2][1]], [ordered[3][0], y, ordered[3][1]],
      [0, 1, 0], color, orderedUv,
      ao && ordered.map(([x, z]) => ao(x, z)),
    );
  }
}
