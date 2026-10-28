// Offline city data boundary. Every tile is validated here before any GPU
// buffer is allocated, and the parser returns owned copies, never the
// caller's arrays.
//
// Versions
//   v1 (PR #30): WGS84 [lon, lat] points per feature, buildings and roads only.
//   v2: local metres around the origin (x east, z south, 0.1 m precision),
//       flat coordinate arrays, building material classes, road classes with
//       sidewalks, land-use areas, trees and landmarks.
//   v3 (this file, docs/plans/harlem-v3-valdrada-prompt.md §5.2): `sources`
//       replaces `source`; buildings gain optional record fields (f, fh, vs,
//       sh, ww, fi, d) baked from Valdrada v0.4.0; roads gain l, ow, sp, sid;
//       trees.osm becomes trees.census; a furniture object holds record-placed
//       props; transit.subway and transit.shelters come from MTA/DOT records.
//       Baked by tooling/city/build.mjs.
// Provenance bits. The wire `e` field keeps per-version meaning. v2: a set bit
// marks an estimate (bit 0 height, bit 1 class). v3: a set bit marks a FACT —
// a named public record supplied the field (docs/design/handoff/harlem-v3.md):
// bit 0 height, 1 class, 2 floors, 3 style, 4 detail. Typology (vs, class) and
// the detail bitset are compiler rules, so bits 1, 3 and 4 stay clear on every
// v3 building; fields that no record backs are always parsed as estimated.
// Migration note: v1 and v2 tiles still parse, projected into v3 shape once
// (v2's estimate flags become the same booleans; the new collections come out
// empty). World saves key on (id, version): `CITY_DATASET_MIGRATIONS` carries
// the identity position migrations, including the v3 id rename — v2 saves
// resume on v3 without "incompatible-dataset" only when the lobby passes the
// table to `resolveResume` (`datasetMigrations`).
import { z } from 'zod';
import type { DatasetMigration } from '@acme/core';

/** WGS84 [longitude, latitude]. */
export type GeoPoint = readonly [longitude: number, latitude: number];

export const BUILDING_CLASSES = ['brownstone', 'brick', 'glass', 'nycha', 'church', 'civic', 'plain'] as const;
export type BuildingClass = (typeof BUILDING_CLASSES)[number];
export const ROAD_CLASSES = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'living', 'service',
  'pedestrian', 'footway', 'sidewalk', 'crossing', 'cycleway',
] as const;
export type RoadClass = (typeof ROAD_CLASSES)[number];
export const AREA_KINDS = ['park', 'garden', 'grass', 'pitch', 'playground', 'plaza', 'parking', 'water', 'school'] as const;
export type AreaKind = (typeof AREA_KINDS)[number];
export const LANDMARK_KEYS = ['apollo-theater', 'hotel-theresa', 'acp-state-office'] as const;
export type LandmarkKey = (typeof LANDMARK_KEYS)[number];

/** Flat [x0, z0, x1, z1, ...] in local metres. Rings are open (first point not repeated). */
export type FlatPoints = readonly number[];

export interface CityBuilding {
  readonly id: string;
  readonly ring: FlatPoints;
  readonly holes: readonly FlatPoints[];
  readonly heightMeters: number;
  readonly class: BuildingClass;
  /** No height record: the height is a fallback or a rule, not a measurement. */
  readonly heightEstimated: boolean;
  /** The material class is a styling estimate, never a record. */
  readonly classEstimated: boolean;
  /** v3: no PLUTO floor count backed `floors` (absent on v1/v2 data, always true there). */
  readonly floorsEstimated: boolean;
  /** v3: `styleId` is a compiler typology, never a record (always true). */
  readonly styleEstimated: boolean;
  /** v3: `detailMask` is a compiler rule, never a record (always true). */
  readonly detailEstimated: boolean;
  /** v3 fields, present only where the bake carried Valdrada record values. */
  readonly floors?: number;
  readonly floorHeightMeters?: number;
  /** Valdrada STYLE id 0–15, kept verbatim; `class` is derived from it. */
  readonly styleId?: number;
  readonly storefrontHeightMeters?: number;
  readonly windowWidthMeters?: number;
  /** Ring edge index that faces the street, or -1 when unknown. */
  readonly frontEdgeIndex?: number;
  /** Detail bits: cornice, fire escape, stoop, water tower, storefront, setbacks, gable. */
  readonly detailMask?: number;
  readonly name?: string;
}
export interface CityRoad {
  readonly id: string;
  readonly class: RoadClass;
  /** Carriageway width, metres. */
  readonly widthMeters: number;
  /** Sidewalk width on each side, metres (0 for none). */
  readonly sidewalkMeters: number;
  readonly points: FlatPoints;
  readonly widthEstimated: boolean;
  /** v3: CSCL travel lanes. */
  readonly lanes?: number;
  /** v3: CSCL direction of travel: 1 = with the geometry, -1 = against, 0 = two-way. */
  readonly oneway?: number;
  /** v3: CSCL posted speed, mph. */
  readonly speedMph?: number;
  /** v3: CSCL segment id (`physicalid`), a stable record key. */
  readonly segmentId?: number;
  readonly name?: string;
}
export interface CityArea {
  readonly id: string;
  readonly kind: AreaKind;
  readonly ring: FlatPoints;
  readonly holes: readonly FlatPoints[];
  readonly name?: string;
}
export interface CityLandmark {
  readonly key: LandmarkKey;
  readonly name: string;
  readonly buildingId: string;
  readonly x: number;
  readonly z: number;
}
export interface CitySource {
  readonly url: string;
  readonly attribution: string;
  readonly license: string;
  /** Page for the licence itself, when it differs from `url` (v3). */
  readonly licenseUrl?: string;
  readonly retrievedAt: string;
  readonly query?: string;
}

/** Record-placed street props: flat [x, z, rot radians, ...] triplets. */
export interface CityFurniture {
  readonly hydrant: FlatPoints;
  readonly linknyc: FlatPoints;
  readonly bikeRack: FlatPoints;
}

/** A parsed tile, always in v3 shape. */
export interface CityDatasetV3 {
  readonly version: 3;
  readonly id: string;
  readonly origin: GeoPoint;
  readonly extentMeters: number;
  readonly sources: readonly CitySource[];
  /** ODbL §4.4(a): the derived database's own licence grant. Absent on tiles baked before the declaration. */
  readonly license?: string;
  readonly licenseUrl?: string;
  readonly licenseNotice?: string;
  readonly notes: readonly string[];
  readonly buildings: readonly CityBuilding[];
  readonly roads: readonly CityRoad[];
  readonly areas: readonly CityArea[];
  /** `census`: record trees (2015 Street Tree Census via Valdrada; OSM nodes on v2 tiles). `fill`: generated decoration. */
  readonly trees: { readonly census: FlatPoints; readonly fill: FlatPoints };
  readonly landmarks: readonly CityLandmark[];
  /** `subway` = MTA entrance records, `shelters` = DOT shelter records (OSM nodes on v2 tiles). Flat [x, z, ...]. */
  readonly transit: { readonly subway: FlatPoints; readonly shelters: FlatPoints };
  readonly furniture: CityFurniture;
}

/** The v2 wire shape, kept so old tiles, fixtures and saves still type-check and migrate. */
export interface CityDatasetV2 {
  readonly version: 2;
  readonly id: string;
  readonly origin: GeoPoint;
  readonly extentMeters: number;
  readonly source: CitySource;
  readonly notes: readonly string[];
  readonly buildings: readonly CityBuilding[];
  readonly roads: readonly CityRoad[];
  readonly areas: readonly CityArea[];
  readonly trees: { readonly osm: FlatPoints; readonly fill: FlatPoints };
  readonly landmarks: readonly CityLandmark[];
  readonly transit: { readonly subway: FlatPoints; readonly shelters: FlatPoints };
}

/** The PR #30 shape, kept so v1 tiles, fixtures and saves still type-check and migrate. */
export type CityFeatureV1 =
  | { id: string; kind: 'building'; points: GeoPoint[]; heightMeters: number }
  | { id: string; kind: 'road'; points: GeoPoint[]; widthMeters: number };
export interface CityDatasetV1 {
  version: 1;
  id: string;
  origin: GeoPoint;
  source: { url: string; attribution: string; license: string; retrievedAt: string };
  features: CityFeatureV1[];
}

/**
 * Any wire version, for code that only reads identity fields (id, version,
 * origin), such as the world save. Renderers take `CityDatasetV3`, which is
 * what `parseCityDataset` returns.
 */
export type CityDataset = CityDatasetV1 | CityDatasetV2 | CityDatasetV3;

// A coarse NYC envelope, not a borough boundary or location-permission check.
const ENVELOPE = [-74.26, 40.49, -73.69, 40.92] as const;
const MAX_TILE_RADIUS_METERS = 2000;
const MAX_BUILDINGS = 20_000;
const MAX_ROADS = 10_000;
const MAX_AREAS = 4_000;
const MAX_TREES = 25_000;
const MAX_FURNITURE = 5_000;
const MAX_COORDINATES = 1_200_000;
const MAX_POINTS_PER_RING = 4096;
const MAX_V1_FEATURES = 10_000;
const MAX_V1_POINTS = 100_000;

// v3 `e` provenance bits: a SET bit names a public record behind the field.
export const RECORD_HEIGHT = 1;
export const RECORD_CLASS = 2;
export const RECORD_FLOORS = 4;
export const RECORD_STYLE = 8;
export const RECORD_DETAIL = 16;

const label = z.string().trim().min(1).max(2048);
const name = z.string().max(240).optional();
const flat = z.array(z.number()).max(MAX_POINTS_PER_RING * 2);
const geoPoint = z.tuple([z.number(), z.number()]);
const https = label.regex(/^https:\/\/\S+$/, 'City source must be HTTPS');
const source = z.object({
  url: https,
  attribution: label,
  license: label,
  licenseUrl: https.optional(),
  retrievedAt: label.refine((v) => /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)), 'Invalid retrieval date'),
  query: z.string().max(4096).optional(),
});

const v3Schema = z.object({
  version: z.literal(3),
  id: label,
  origin: geoPoint,
  extentMeters: z.number().positive().max(MAX_TILE_RADIUS_METERS),
  sources: z.array(source).min(1).max(16),
  license: label.optional(),
  licenseUrl: https.optional(),
  licenseNotice: z.string().max(1000).optional(),
  notes: z.array(z.string().max(1000)).max(64).default([]),
  buildings: z.array(z.object({
    id: label, p: flat, i: z.array(flat).max(64).optional(),
    h: z.number().positive().max(1000),
    c: z.enum(BUILDING_CLASSES),
    e: z.number().int().min(0).max(31).default(0),
    n: name,
    f: z.number().int().min(1).max(255).optional(),
    fh: z.number().positive().max(20).optional(),
    vs: z.number().int().min(0).max(15).optional(),
    sh: z.number().min(0).max(20).optional(),
    ww: z.number().positive().max(20).optional(),
    fi: z.number().int().min(-1).max(MAX_POINTS_PER_RING).optional(),
    d: z.number().int().min(0).max(127).optional(),
  })).max(MAX_BUILDINGS),
  roads: z.array(z.object({
    id: label, c: z.enum(ROAD_CLASSES), w: z.number().positive().max(100), s: z.number().min(0).max(20),
    p: flat, e: z.number().int().min(0).max(1).optional(), n: name,
    l: z.number().int().min(0).max(60).optional(),
    ow: z.number().int().min(-1).max(1).optional(),
    sp: z.number().int().min(0).max(200).optional(),
    sid: z.number().int().min(0).max(4_294_967_295).optional(),
  })).max(MAX_ROADS),
  areas: z.array(z.object({ id: label, k: z.enum(AREA_KINDS), p: flat, i: z.array(flat).max(256).optional(), n: name })).max(MAX_AREAS),
  trees: z.object({ census: z.array(z.number()).max(MAX_TREES * 2), fill: z.array(z.number()).max(MAX_TREES * 2) }),
  landmarks: z.array(z.object({ key: z.enum(LANDMARK_KEYS), name: label, buildingId: label, x: z.number(), z: z.number() })).max(16),
  transit: z.object({ subway: z.array(z.number()).max(4000), shelters: z.array(z.number()).max(4000) }),
  furniture: z.object({
    hydrant: z.array(z.number()).max(MAX_FURNITURE * 3),
    linknyc: z.array(z.number()).max(MAX_FURNITURE * 3),
    bikeRack: z.array(z.number()).max(MAX_FURNITURE * 3),
  }),
});

const v2Schema = z.object({
  version: z.literal(2),
  id: label,
  origin: geoPoint,
  extentMeters: z.number().positive().max(MAX_TILE_RADIUS_METERS),
  source,
  notes: z.array(z.string().max(1000)).max(64).default([]),
  buildings: z.array(z.object({
    id: label, p: flat, i: z.array(flat).max(64).optional(),
    h: z.number().positive().max(1000),
    c: z.enum(BUILDING_CLASSES),
    e: z.number().int().min(0).max(3).default(0),
    n: name,
  })).max(MAX_BUILDINGS),
  roads: z.array(z.object({
    id: label, c: z.enum(ROAD_CLASSES), w: z.number().positive().max(100), s: z.number().min(0).max(20),
    p: flat, e: z.number().int().min(0).max(1).optional(), n: name,
  })).max(MAX_ROADS),
  areas: z.array(z.object({ id: label, k: z.enum(AREA_KINDS), p: flat, i: z.array(flat).max(256).optional(), n: name })).max(MAX_AREAS),
  trees: z.object({ osm: z.array(z.number()).max(MAX_TREES * 2), fill: z.array(z.number()).max(MAX_TREES * 2) }),
  landmarks: z.array(z.object({ key: z.enum(LANDMARK_KEYS), name: label, buildingId: label, x: z.number(), z: z.number() })).max(16),
  transit: z.object({ subway: z.array(z.number()).max(4000), shelters: z.array(z.number()).max(4000) }).optional(),
});

const v1Schema = z.object({
  version: z.literal(1),
  id: label,
  origin: geoPoint,
  source,
  features: z.array(z.discriminatedUnion('kind', [
    z.object({ id: label, kind: z.literal('building'), points: z.array(geoPoint).max(2048), heightMeters: z.number() }),
    z.object({ id: label, kind: z.literal('road'), points: z.array(geoPoint).max(2048), widthMeters: z.number() }),
  ])).min(1).max(MAX_V1_FEATURES),
});

function checkOrigin(origin: readonly [number, number]): GeoPoint {
  const [lon, lat] = origin;
  if (!(lon >= ENVELOPE[0] && lon <= ENVELOPE[2] && lat >= ENVELOPE[1] && lat <= ENVELOPE[3])) throw new Error('City coordinate outside NYC envelope');
  return [lon, lat];
}

/** Coordinates finite and inside the tile radius; returns the point count. */
function checkPoints(points: FlatPoints, minPoints: number, what: string): number {
  if (points.length % 2 !== 0) throw new Error(`Odd coordinate count in ${what}`);
  const count = points.length / 2;
  if (count < minPoints) throw new Error(`${what} needs at least ${minPoints} points`);
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]!; const z = points[i + 1]!;
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error(`Non-finite coordinate in ${what}`);
    if (Math.hypot(x, z) > MAX_TILE_RADIUS_METERS) throw new Error('City tile radius exceeded');
  }
  return count;
}

/** Furniture [x, z, rot] triplets: x/z inside the tile radius, rot finite. */
function checkTriplets(triplets: FlatPoints, what: string): number {
  if (triplets.length % 3 !== 0) throw new Error(`Triplet count expected in ${what}`);
  const count = triplets.length / 3;
  for (let i = 0; i < triplets.length; i += 3) {
    const x = triplets[i]!; const z = triplets[i + 1]!; const rot = triplets[i + 2]!;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(rot)) throw new Error(`Non-finite coordinate in ${what}`);
    if (Math.hypot(x, z) > MAX_TILE_RADIUS_METERS) throw new Error('City tile radius exceeded');
  }
  return count;
}

/** Shoelace area of a flat ring, signed. */
export function ringArea(ring: FlatPoints): number {
  let sum = 0;
  const n = ring.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += ring[i * 2]! * ring[j * 2 + 1]! - ring[j * 2]! * ring[i * 2 + 1]!;
  }
  return sum / 2;
}

function checkRing(ring: FlatPoints, what: string): number {
  const count = checkPoints(ring, 3, what);
  // Collinear or degenerate footprints break extrusion and walkability.
  if (Math.abs(ringArea(ring)) < 0.5) throw new Error(`${what} footprint has no area`);
  return count;
}

interface Checked {
  readonly origin: GeoPoint;
  readonly seen: { buildings: Set<string>; roads: Set<string>; areas: Set<string> };
  readonly claim: (kind: 'buildings' | 'roads' | 'areas', id: string) => void;
  readonly budget: (n: number) => void;
}

function makeChecker(origin: GeoPoint): Checked {
  const seen = { buildings: new Set<string>(), roads: new Set<string>(), areas: new Set<string>() };
  let coordinates = 0;
  return {
    origin,
    seen,
    claim: (kind, id) => {
      if (seen[kind].has(id)) throw new Error('Duplicate city feature ID');
      seen[kind].add(id);
    },
    budget: (n) => {
      coordinates += n;
      if (coordinates > MAX_COORDINATES / 2) throw new Error('City point budget exceeded');
    },
  };
}

type RoadWire = { id: string; c: RoadClass; w: number; s: number; p: number[]; e?: number | undefined; n?: string | undefined };
type AreaWire = { id: string; k: AreaKind; p: number[]; i?: number[][] | undefined; n?: string | undefined };
type LandmarkWire = { key: LandmarkKey; name: string; buildingId: string; x: number; z: number };

function parseRoads(roads: readonly RoadWire[], c: Checked): CityRoad[] {
  return roads.map((r): CityRoad => {
    c.claim('roads', r.id);
    c.budget(checkPoints(r.p, 2, 'Road'));
    let length = 0;
    for (let i = 2; i < r.p.length; i += 2) length += Math.hypot(r.p[i]! - r.p[i - 2]!, r.p[i + 1]! - r.p[i - 1]!);
    if (length <= 0) throw new Error('Road needs distinct points');
    return {
      id: r.id, class: r.c, widthMeters: r.w, sidewalkMeters: r.s, points: r.p, widthEstimated: r.e === 1,
      ...(r.n ? { name: r.n } : {}),
    };
  });
}

function parseAreas(areas: readonly AreaWire[], c: Checked): CityArea[] {
  return areas.map((a): CityArea => {
    c.claim('areas', a.id);
    c.budget(checkRing(a.p, 'Area'));
    const holes = (a.i ?? []).map((hole) => { c.budget(checkRing(hole, 'Area hole')); return hole; });
    return { id: a.id, kind: a.k, ring: a.p, holes, ...(a.n ? { name: a.n } : {}) };
  });
}

function parseLandmarks(landmarks: readonly LandmarkWire[], buildings: readonly CityBuilding[]): CityLandmark[] {
  const buildingIds = new Set(buildings.map((b) => b.id));
  return landmarks.map((l): CityLandmark => {
    if (!buildingIds.has(l.buildingId)) throw new Error(`Landmark ${l.key} points at a missing building`);
    if (!Number.isFinite(l.x) || !Number.isFinite(l.z) || Math.hypot(l.x, l.z) > MAX_TILE_RADIUS_METERS) throw new Error('City tile radius exceeded');
    return { ...l };
  });
}

function parseV3(input: unknown): CityDatasetV3 {
  const result = v3Schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid city dataset: ${result.error.issues[0]?.path.join('.') ?? ''} ${result.error.issues[0]?.message ?? ''}`.trim());
  const data = result.data;
  const origin = checkOrigin(data.origin);
  const c = makeChecker(origin);
  const buildings = data.buildings.map((b): CityBuilding => {
    c.claim('buildings', b.id);
    c.budget(checkRing(b.p, 'Building'));
    const holes = (b.i ?? []).map((hole) => { c.budget(checkRing(hole, 'Building hole')); return hole; });
    if (b.fi !== undefined && b.fi >= b.p.length / 2) throw new Error('Building front edge outside the ring');
    return {
      id: b.id, ring: b.p, holes, heightMeters: b.h, class: b.c,
      heightEstimated: (b.e & RECORD_HEIGHT) === 0,
      classEstimated: (b.e & RECORD_CLASS) === 0,
      floorsEstimated: (b.e & RECORD_FLOORS) === 0,
      styleEstimated: (b.e & RECORD_STYLE) === 0,
      detailEstimated: (b.e & RECORD_DETAIL) === 0,
      ...(b.f !== undefined ? { floors: b.f } : {}),
      ...(b.fh !== undefined ? { floorHeightMeters: b.fh } : {}),
      ...(b.vs !== undefined ? { styleId: b.vs } : {}),
      ...(b.sh !== undefined ? { storefrontHeightMeters: b.sh } : {}),
      ...(b.ww !== undefined ? { windowWidthMeters: b.ww } : {}),
      ...(b.fi !== undefined ? { frontEdgeIndex: b.fi } : {}),
      ...(b.d !== undefined ? { detailMask: b.d } : {}),
      ...(b.n ? { name: b.n } : {}),
    };
  });
  const roads = parseRoads(data.roads, c).map((road, i): CityRoad => {
    const r = data.roads[i]!;
    return {
      ...road,
      ...(r.l !== undefined ? { lanes: r.l } : {}),
      ...(r.ow !== undefined ? { oneway: r.ow } : {}),
      ...(r.sp !== undefined ? { speedMph: r.sp } : {}),
      ...(r.sid !== undefined ? { segmentId: r.sid } : {}),
    };
  });
  const areas = parseAreas(data.areas, c);
  for (const list of [data.trees.census, data.trees.fill]) if (list.length > 0) c.budget(checkPoints(list, 1, 'Tree list'));
  if ((data.trees.census.length + data.trees.fill.length) / 2 > MAX_TREES) throw new Error('City tree budget exceeded');
  for (const list of [data.transit.subway, data.transit.shelters]) if (list.length > 0) c.budget(checkPoints(list, 1, 'Transit list'));
  const furniture = {
    hydrant: data.furniture.hydrant,
    linknyc: data.furniture.linknyc,
    bikeRack: data.furniture.bikeRack,
  };
  for (const [key, list] of Object.entries(furniture)) if (list.length > 0) c.budget(checkTriplets(list, `Furniture ${key}`));
  const landmarks = parseLandmarks(data.landmarks, buildings);
  if (buildings.length + roads.length + areas.length === 0) throw new Error('City feature budget exceeded or empty');
  return {
    version: 3, id: data.id, origin, extentMeters: data.extentMeters,
    sources: data.sources.map((s) => ({ ...s })), notes: [...data.notes],
    buildings, roads, areas, trees: { census: data.trees.census, fill: data.trees.fill }, landmarks,
    transit: { subway: data.transit.subway, shelters: data.transit.shelters },
    furniture,
  };
}

/** v2 → v3. Same geometry; the single source becomes a one-entry list and new fields stay absent. */
function parseV2(input: unknown): CityDatasetV3 {
  const result = v2Schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid city dataset: ${result.error.issues[0]?.path.join('.') ?? ''} ${result.error.issues[0]?.message ?? ''}`.trim());
  const data = result.data;
  const origin = checkOrigin(data.origin);
  const c = makeChecker(origin);
  const buildings = data.buildings.map((b): CityBuilding => {
    c.claim('buildings', b.id);
    c.budget(checkRing(b.p, 'Building'));
    const holes = (b.i ?? []).map((hole) => { c.budget(checkRing(hole, 'Building hole')); return hole; });
    return {
      id: b.id, ring: b.p, holes, heightMeters: b.h, class: b.c,
      // v2 `e` bits are estimate flags (set = estimated), the inverse of v3's.
      heightEstimated: (b.e & 1) !== 0, classEstimated: (b.e & 2) !== 0,
      floorsEstimated: true, styleEstimated: true, detailEstimated: true,
      ...(b.n ? { name: b.n } : {}),
    };
  });
  const roads = parseRoads(data.roads, c);
  const areas = parseAreas(data.areas, c);
  for (const list of [data.trees.osm, data.trees.fill]) if (list.length > 0) c.budget(checkPoints(list, 1, 'Tree list'));
  if ((data.trees.osm.length + data.trees.fill.length) / 2 > MAX_TREES) throw new Error('City tree budget exceeded');
  for (const list of [data.transit?.subway ?? [], data.transit?.shelters ?? []]) if (list.length > 0) c.budget(checkPoints(list, 1, 'Transit list'));
  const landmarks = parseLandmarks(data.landmarks, buildings);
  if (buildings.length + roads.length + areas.length === 0) throw new Error('City feature budget exceeded or empty');
  return {
    version: 3, id: data.id, origin, extentMeters: data.extentMeters,
    sources: [{ ...data.source }], notes: [...data.notes],
    buildings, roads, areas, trees: { census: data.trees.osm, fill: data.trees.fill }, landmarks,
    transit: { subway: data.transit?.subway ?? [], shelters: data.transit?.shelters ?? [] },
    furniture: { hydrant: [], linknyc: [], bikeRack: [] },
  };
}

/** v1 → v3. Same origin and projection, so positions do not move. */
function migrateV1(input: unknown): CityDatasetV3 {
  const result = v1Schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    if (issue?.path[0] === 'features' && issue.path.length <= 1) throw new Error('City feature budget exceeded or empty');
    throw new Error(`Invalid city dataset: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim());
  }
  const data = result.data;
  const origin = checkOrigin(data.origin);
  const ids = new Set<string>();
  let count = 0;
  let extent = 0;
  const buildings: CityBuilding[] = [];
  const roads: CityRoad[] = [];
  for (const feature of data.features) {
    if (ids.has(feature.id)) throw new Error('Duplicate city feature ID');
    ids.add(feature.id);
    count += feature.points.length;
    if (count > MAX_V1_POINTS) throw new Error('City point budget exceeded');
    const local: number[] = [];
    for (const point of feature.points) {
      const [x, z] = projectCityPoint(point, origin);
      if (Math.hypot(x, z) > MAX_TILE_RADIUS_METERS) throw new Error('City tile radius exceeded');
      extent = Math.max(extent, Math.abs(x), Math.abs(z));
      local.push(x, z);
    }
    if (feature.kind === 'road') {
      const unique = new Set(feature.points.map(([x, y]) => `${x},${y}`));
      if (feature.points.length < 2 || unique.size < 2) throw new Error('Road needs distinct points');
      if (!(feature.widthMeters > 0 && feature.widthMeters <= 100)) throw new Error('Invalid city dimension');
      roads.push({ id: feature.id, class: 'residential', widthMeters: feature.widthMeters, sidewalkMeters: 0, points: local, widthEstimated: false });
      continue;
    }
    if (!(Number.isFinite(feature.heightMeters) && feature.heightMeters > 0 && feature.heightMeters <= 1000)) throw new Error('Invalid city dimension');
    const first = feature.points[0];
    const last = feature.points[feature.points.length - 1];
    if (feature.points.length < 4 || !first || !last || first[0] !== last[0] || first[1] !== last[1]) throw new Error('Building polygon must be closed');
    const ring = local.slice(0, -2);
    if (Math.abs(ringArea(ring)) < 0.5) throw new Error('Building footprint has no area');
    buildings.push({
      id: feature.id, ring, holes: [], heightMeters: feature.heightMeters, class: 'plain',
      heightEstimated: false, classEstimated: true, floorsEstimated: true, styleEstimated: true, detailEstimated: true,
    });
  }
  return {
    version: 3, id: data.id, origin, extentMeters: Math.max(1, Math.ceil(extent)),
    sources: [{ ...data.source }], notes: ['Migrated from a v1 tile: no classes, sidewalks, areas or trees.'],
    buildings, roads, areas: [], trees: { census: [], fill: [] }, landmarks: [],
    transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
  };
}

/** Validate before allocating GPU buffers. Returns owned data in v3 shape. */
export function parseCityDataset(value: unknown): CityDatasetV3 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected city data object');
  const version = (value as { version?: unknown }).version;
  if (version === 3) return parseV3(value);
  if (version === 2) return parseV2(value);
  if (version === 1) return migrateV1(value);
  throw new Error('Unsupported city dataset version');
}

/** Position migrations for world saves made against older versions of a tile. */
export const CITY_DATASET_MIGRATIONS: readonly DatasetMigration[] = [
  { datasetId: 'harlem-apollo-20261014', fromDatasetVersion: 1, toDatasetVersion: 2, migratePosition: (position) => position },
  // v3 bakes under a new dated id (G6) with the same origin and projection, so
  // positions move by identity. `fromDatasetIds` is what lets saves written
  // against the v1/v2 tile cross the rename (packages/core world/resume.ts).
  { datasetId: 'harlem-apollo-20261017', fromDatasetIds: ['harlem-apollo-20261014'], fromDatasetVersion: 1, toDatasetVersion: 2, migratePosition: (position) => position },
  { datasetId: 'harlem-apollo-20261017', fromDatasetIds: ['harlem-apollo-20261014'], fromDatasetVersion: 2, toDatasetVersion: 3, migratePosition: (position) => position },
];

/** Local metres: east = +x, north = -z, leaving +y for height. Small offline tiles only. */
export function projectCityPoint(coordinate: GeoPoint, origin: GeoPoint): readonly [x: number, z: number] {
  const [lon, lat] = coordinate;
  const [originLon, originLat] = origin;
  for (const [a, b] of [coordinate, origin]) {
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)
      || a < ENVELOPE[0] || a > ENVELOPE[2] || b < ENVELOPE[1] || b > ENVELOPE[3]) throw new Error('City coordinate outside NYC envelope');
  }
  const radians = Math.PI / 180;
  const radius = 6_371_008.8;
  return [(lon - originLon) * radians * radius * Math.cos(originLat * radians), -(lat - originLat) * radians * radius];
}
