/** Offline city data boundary. Coordinates are WGS84 [longitude, latitude]. */
export type GeoPoint = readonly [longitude: number, latitude: number];
export type CityFeature =
  | { id: string; kind: 'building'; points: GeoPoint[]; heightMeters: number }
  | { id: string; kind: 'road'; points: GeoPoint[]; widthMeters: number };
export interface CityDataset {
  version: 1;
  id: string;
  origin: GeoPoint;
  source: { url: string; attribution: string; license: string; retrievedAt: string };
  features: CityFeature[];
}
// A coarse NYC envelope, not a borough boundary or location-permission check.
const ENVELOPE = [-74.26, 40.49, -73.69, 40.92] as const;
const MAX_FEATURES = 10_000;
const MAX_POINTS = 100_000;
const MAX_POINTS_PER_FEATURE = 2048;
const MAX_TILE_RADIUS_METERS = 2000;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected city data object');
  return value as Record<string, unknown>;
}
function label(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error(`Invalid ${name}`);
  return value;
}
function point(value: unknown): GeoPoint {
  if (!Array.isArray(value) || value.length !== 2) throw new Error('Invalid city coordinate');
  const [lon, lat] = value;
  if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)
    || lon < ENVELOPE[0] || lon > ENVELOPE[2] || lat < ENVELOPE[1] || lat > ENVELOPE[3]) {
    throw new Error('City coordinate outside NYC envelope');
  }
  return [lon, lat];
}
function dimension(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) throw new Error('Invalid city dimension');
  return value;
}
/** Validate before allocating GPU buffers. Returns owned data, never the caller's mutable arrays. */
export function parseCityDataset(value: unknown): CityDataset {
  const data = record(value);
  if (data.version !== 1) throw new Error('Unsupported city dataset version');
  const origin = point(data.origin);
  const source = record(data.source);
  const url = label(source.url, 'source URL');
  if (!/^https:\/\/[^\s]+$/.test(url)) throw new Error('City source must be HTTPS');
  const retrievedAt = label(source.retrievedAt, 'retrieval date');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(retrievedAt) || !Number.isFinite(Date.parse(retrievedAt))) throw new Error('Invalid retrieval date');
  if (!Array.isArray(data.features) || data.features.length === 0 || data.features.length > MAX_FEATURES) throw new Error('City feature budget exceeded or empty');
  let count = 0;
  const ids = new Set<string>();
  const features = data.features.map((value): CityFeature => {
    const feature = record(value);
    const id = label(feature.id, 'feature ID');
    if (ids.has(id)) throw new Error('Duplicate city feature ID');
    ids.add(id);
    if (feature.kind !== 'building' && feature.kind !== 'road') throw new Error('Unsupported city feature');
    if (!Array.isArray(feature.points)) throw new Error('Missing city points');
    if (feature.points.length > MAX_POINTS_PER_FEATURE) throw new Error('City feature point budget exceeded');
    count += feature.points.length;
    if (count > MAX_POINTS) throw new Error('City point budget exceeded');
    const points = feature.points.map(point);
    for (const coordinate of points) {
      const [x, z] = projectCityPoint(coordinate, origin);
      if (Math.hypot(x, z) > MAX_TILE_RADIUS_METERS) throw new Error('City tile radius exceeded');
    }
    const unique = new Set(points.map(([x, y]) => `${x},${y}`));
    if (feature.kind === 'road') {
      if (points.length < 2 || unique.size < 2) throw new Error('Road needs distinct points');
      return { id, kind: 'road', points, widthMeters: dimension(feature.widthMeters, 100) };
    }
    if (points.length < 4 || unique.size < 3) throw new Error('Building needs a closed polygon');
    const first = points[0]!;
    const last = points[points.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('Building polygon must be closed');
    // Reject collinear footprints before extrusion; holes/multipolygons need a separate compiler stage.
    const area = points.slice(1).reduce((sum, b, i) => {
      const a = points[i]!;
      return sum + (a[0] - first[0]) * (b[1] - first[1]) - (b[0] - first[0]) * (a[1] - first[1]);
    }, 0);
    if (Math.abs(area) < 1e-12) throw new Error('Building footprint has no area');
    return { id, kind: 'building', points, heightMeters: dimension(feature.heightMeters, 1000) };
  });
  return {
    version: 1, id: label(data.id, 'dataset ID'), origin,
    source: { url, retrievedAt, attribution: label(source.attribution, 'attribution'), license: label(source.license, 'license') },
    features,
  };
}
/** Local metres: east = +x, north = -z, leaving +y for building height. Small offline tiles only. */
export function projectCityPoint(coordinate: GeoPoint, origin: GeoPoint): readonly [x: number, z: number] {
  const [lon, lat] = point(coordinate);
  const [originLon, originLat] = point(origin);
  const radians = Math.PI / 180;
  const radius = 6_371_008.8;
  return [(lon - originLon) * radians * radius * Math.cos(originLat * radians), -(lat - originLat) * radians * radius];
}
