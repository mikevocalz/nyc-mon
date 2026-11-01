import {
  type GeoPosition,
  SCENE_HALF_EXTENT_M,
  WORLD_CRS,
  type WorldCamera,
} from '../schemas/world-save.ts';

// Canonical (lon, lat) ↔ scene (x, z). The forward formula is a copy of
// `projectCityPoint` in packages/app/features/game/city-dataset.ts; core
// cannot import it (Law 3: no app or renderer imports in core), so the maths
// is duplicated here and `packages/core/test/world-resume.test.ts` pins both
// to the same numbers. If one changes, change the other and the test.
//
// The projection is equirectangular about the dataset origin on a sphere of
// mean radius 6 371 008.8 m: x = Δlon · R · cos(lat₀), z = −Δlat · R. It is
// exact for the inverse (the two functions are algebraic inverses, so a
// round trip is limited by double rounding, not by the model) and accurate
// against the ellipsoid to about 0.1 % of the offset, which the dataset's
// 2000 m tile radius keeps under 2 m. That 2 m is a model error shared by the
// renderer and the save, so it never shows as a jump; what the save must
// never introduce is a difference between two runs of the same transform,
// and the round-trip test holds that below a centimetre at the clamp.

/** Mean Earth radius in metres (IUGG), the constant `projectCityPoint` uses. */
export const EARTH_MEAN_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** A point in scene space: metres east (+x) and south (+z) of the dataset origin. */
export interface ScenePoint {
  readonly x: number;
  readonly z: number;
}

/** Canonical → scene. The same arithmetic as `projectCityPoint`, without its NYC envelope check. */
export function projectToScene(position: GeoPosition, origin: GeoPosition): ScenePoint {
  return {
    x: (position.longitude - origin.longitude) * DEG * EARTH_MEAN_RADIUS_M * Math.cos(origin.latitude * DEG),
    z: -(position.latitude - origin.latitude) * DEG * EARTH_MEAN_RADIUS_M,
  };
}

/** Scene → canonical. The algebraic inverse of {@linkcode projectToScene} for the same origin. */
export function unprojectFromScene(point: ScenePoint, origin: GeoPosition): GeoPosition {
  return {
    crs: WORLD_CRS,
    longitude: origin.longitude + point.x / (DEG * EARTH_MEAN_RADIUS_M * Math.cos(origin.latitude * DEG)),
    latitude: origin.latitude - point.z / (DEG * EARTH_MEAN_RADIUS_M),
  };
}

/**
 * Moves a scene point from one dataset origin to another through the
 * canonical position. Used when a dataset update moves its origin: the
 * player's canonical position is unchanged, the scene number is not.
 */
export function rebaseScenePoint(point: ScenePoint, fromOrigin: GeoPosition, toOrigin: GeoPosition): ScenePoint {
  return projectToScene(unprojectFromScene(point, fromOrigin), toOrigin);
}

/** Same for the camera's look-at point; yaw and distance do not depend on the origin. */
export function rebaseCamera(camera: WorldCamera, fromOrigin: GeoPosition, toOrigin: GeoPosition): WorldCamera {
  const target = rebaseScenePoint({ x: camera.x, z: camera.z }, fromOrigin, toOrigin);
  return { x: target.x, z: target.z, yaw: camera.yaw, distance: camera.distance };
}

/** True when a scene point is inside the camera clamp, so the save can hold it. */
export function isInsideSceneExtent(point: ScenePoint): boolean {
  return Math.abs(point.x) <= SCENE_HALF_EXTENT_M && Math.abs(point.z) <= SCENE_HALF_EXTENT_M;
}

/**
 * Compass bearing the camera faces, radians clockwise from north, in [0, 2π).
 * `city-scene.ts` places the camera at target + (sin yaw, cos yaw) · distance
 * with north = −z, so it looks along (−sin yaw, −cos yaw) and bearing = −yaw.
 * The radian twin of `camera-input.ts` `headingDegrees`.
 */
export function headingRadiansFromYaw(yaw: number): number {
  return (((-yaw) % TAU) + TAU) % TAU;
}

/** Inverse of {@linkcode headingRadiansFromYaw}; the same involution. */
export function yawFromHeadingRadians(headingRadians: number): number {
  return headingRadiansFromYaw(headingRadians);
}
