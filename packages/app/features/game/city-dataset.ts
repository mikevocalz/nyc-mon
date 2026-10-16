// Offline city data boundary. Every tile is validated here before any GPU
// buffer is allocated, and the parser returns owned copies, never the
// caller's arrays.
//
// Versions
//   v1 (PR #30): WGS84 [lon, lat] points per feature, buildings and roads only.
//   v2 (this file): local metres around the origin (x east, z south, 0.1 m
//       precision), flat coordinate arrays, building material classes, road
//       classes with sidewalks, land-use areas, trees and landmarks. Baked by
//       tooling/city/build.mjs.
// Migration note: a v1 tile still parses. It is projected into v2 shape once
// (buildings become class "plain" with an estimated class, roads become
// "residential" with no sidewalk) so old fixtures and tiles keep rendering.
// World saves key on (id, version): `CITY_DATASET_MIGRATIONS` carries the
// identity position migration from v1 to v2, because the origin and the
// projection did not change. The lobby has to pass it to `resolveResume`
// (`datasetMigrations`) or v1 saves resume as "incompatible-dataset".
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
  /** No height or levels tag: the height is a type fallback, not a measurement. */
  readonly heightEstimated: boolean;
  /** The material class is a styling estimate, not an OSM fact. */
  readonly classEstimated: boolean;
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
  readonly retrievedAt: string;
  readonly query?: string;
}

/** A parsed tile, always in v2 shape. */
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
  /** `osm`: natural=tree nodes. `fill`: generated street and park trees (decoration, not data). */
  readonly trees: { readonly osm: FlatPoints; readonly fill: FlatPoints };
  readonly landmarks: readonly CityLandmark[];
  /**
   * OSM street furniture: `subway` = railway=subway_entrance nodes, `shelters`
   * = highway=bus_stop nodes tagged shelter=yes. Flat [x, z, ...]. Empty on
   * tiles baked before 2026-10-16.
   */
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
 * Either version, for code that only reads identity and provenance (id,
 * version, origin, source), such as the world save. Renderers take
 * `CityDatasetV2`, which is what `parseCityDataset` returns.
 */
export type CityDataset = CityDatasetV1 | CityDatasetV2;

// A coarse NYC envelope, not a borough boundary or location-permission check.
const ENVELOPE = [-74.26, 40.49, -73.69, 40.92] as const;
const MAX_TILE_RADIUS_METERS = 2000;
const MAX_BUILDINGS = 20_000;
const MAX_ROADS = 10_000;
const MAX_AREAS = 4_000;
const MAX_TREES = 25_000;
const MAX_COORDINATES = 1_200_000;
const MAX_POINTS_PER_RING = 4096;
const MAX_V1_FEATURES = 10_000;
const MAX_V1_POINTS = 100_000;

const label = z.string().trim().min(1).max(2048);
const name = z.string().max(240).optional();
const flat = z.array(z.number()).max(MAX_POINTS_PER_RING * 2);
const geoPoint = z.tuple([z.number(), z.number()]);
const source = z.object({
  url: label.regex(/^https:\/\/\S+$/, 'City source must be HTTPS'),
  attribution: label,
  license: label,
  retrievedAt: label.refine((v) => /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)), 'Invalid retrieval date'),
  query: z.string().max(4096).optional(),
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

function parseV2(input: unknown): CityDatasetV2 {
  const result = v2Schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid city dataset: ${result.error.issues[0]?.path.join('.') ?? ''} ${result.error.issues[0]?.message ?? ''}`.trim());
  const data = result.data;
  const origin = checkOrigin(data.origin);
  // Ids are unique per collection: one OSM way can be both a school building and its school-yard area.
  const seen = { buildings: new Set<string>(), roads: new Set<string>(), areas: new Set<string>() };
  const claim = (kind: keyof typeof seen, id: string) => {
    if (seen[kind].has(id)) throw new Error('Duplicate city feature ID');
    seen[kind].add(id);
  };
  let coordinates = 0;
  const budget = (n: number) => {
    coordinates += n;
    if (coordinates > MAX_COORDINATES / 2) throw new Error('City point budget exceeded');
  };
  const buildings = data.buildings.map((b): CityBuilding => {
    claim('buildings', b.id);
    budget(checkRing(b.p, 'Building'));
    const holes = (b.i ?? []).map((hole) => { budget(checkRing(hole, 'Building hole')); return hole; });
    return {
      id: b.id, ring: b.p, holes, heightMeters: b.h, class: b.c,
      heightEstimated: (b.e & 1) !== 0, classEstimated: (b.e & 2) !== 0,
      ...(b.n ? { name: b.n } : {}),
    };
  });
  const roads = data.roads.map((r): CityRoad => {
    claim('roads', r.id);
    budget(checkPoints(r.p, 2, 'Road'));
    let length = 0;
    for (let i = 2; i < r.p.length; i += 2) length += Math.hypot(r.p[i]! - r.p[i - 2]!, r.p[i + 1]! - r.p[i - 1]!);
    if (length <= 0) throw new Error('Road needs distinct points');
    return {
      id: r.id, class: r.c, widthMeters: r.w, sidewalkMeters: r.s, points: r.p, widthEstimated: r.e === 1,
      ...(r.n ? { name: r.n } : {}),
    };
  });
  const areas = data.areas.map((a): CityArea => {
    claim('areas', a.id);
    budget(checkRing(a.p, 'Area'));
    const holes = (a.i ?? []).map((hole) => { budget(checkRing(hole, 'Area hole')); return hole; });
    return { id: a.id, kind: a.k, ring: a.p, holes, ...(a.n ? { name: a.n } : {}) };
  });
  for (const list of [data.trees.osm, data.trees.fill]) if (list.length > 0) budget(checkPoints(list, 1, 'Tree list'));
  if ((data.trees.osm.length + data.trees.fill.length) / 2 > MAX_TREES) throw new Error('City tree budget exceeded');
  for (const list of [data.transit?.subway ?? [], data.transit?.shelters ?? []]) if (list.length > 0) budget(checkPoints(list, 1, 'Transit list'));
  const buildingIds = new Set(buildings.map((b) => b.id));
  const landmarks = data.landmarks.map((l): CityLandmark => {
    if (!buildingIds.has(l.buildingId)) throw new Error(`Landmark ${l.key} points at a missing building`);
    if (!Number.isFinite(l.x) || !Number.isFinite(l.z) || Math.hypot(l.x, l.z) > MAX_TILE_RADIUS_METERS) throw new Error('City tile radius exceeded');
    return { ...l };
  });
  if (buildings.length + roads.length + areas.length === 0) throw new Error('City feature budget exceeded or empty');
  return {
    version: 2, id: data.id, origin, extentMeters: data.extentMeters,
    source: { ...data.source }, notes: [...data.notes],
    buildings, roads, areas, trees: { osm: data.trees.osm, fill: data.trees.fill }, landmarks,
    transit: { subway: data.transit?.subway ?? [], shelters: data.transit?.shelters ?? [] },
  };
}

/** v1 → v2. Same origin and projection, so positions do not move. */
function migrateV1(input: unknown): CityDatasetV2 {
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
    buildings.push({ id: feature.id, ring, holes: [], heightMeters: feature.heightMeters, class: 'plain', heightEstimated: false, classEstimated: true });
  }
  return {
    version: 2, id: data.id, origin, extentMeters: Math.max(1, Math.ceil(extent)),
    source: { ...data.source }, notes: ['Migrated from a v1 tile: no classes, sidewalks, areas or trees.'],
    buildings, roads, areas: [], trees: { osm: [], fill: [] }, landmarks: [], transit: { subway: [], shelters: [] },
  };
}

/** Validate before allocating GPU buffers. Returns owned data in v2 shape. */
export function parseCityDataset(value: unknown): CityDatasetV2 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected city data object');
  const version = (value as { version?: unknown }).version;
  if (version === 2) return parseV2(value);
  if (version === 1) return migrateV1(value);
  throw new Error('Unsupported city dataset version');
}

/** Position migrations for world saves made against older versions of a tile. */
export const CITY_DATASET_MIGRATIONS: readonly DatasetMigration[] = [
  { datasetId: 'harlem-apollo-20261014', fromDatasetVersion: 1, toDatasetVersion: 2, migratePosition: (position) => position },
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
