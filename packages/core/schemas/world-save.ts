import { z } from 'zod';
import { EpochMsSchema, IdSchema } from './primitives.ts';

// The world save: where the player stands in the NYC world and how the camera
// looks at it (Master Directive v2 §3 "Exact map-coordinate restoration").
// Separate from the Mon save in ./save.ts: it is written on a cadence while
// the Game tab is open and read once at lobby START, and it must never be
// able to touch eggs, Mons or care (Law 6).
//
// Precision. Every number is a plain IEEE-754 double (JSON number) and is
// never rounded, quantised or stored as float32. A longitude below 180° has a
// unit-in-last-place of about 2.8e-14°, which is 3e-9 m on the ground; a
// scene coordinate inside the camera's ±2000 m clamp has an ulp of about
// 4.5e-13 m. The canonical position is WGS84 (lon, lat), and scene (x, z) is
// re-derived from it with the dataset origin by `world/transform.ts` using
// the same formula as `city-dataset.ts` `projectCityPoint`, so two runs of
// the same transform give bit-identical doubles. A chunk index is never
// stored: it is a floor() of those doubles, so a position saved exactly on a
// chunk edge resolves to the same chunk on restore. Storing scene x,z alone
// would not survive an origin change; storing a chunk index would not survive
// a chunk-size change. Storing the canonical position survives both.

/** Every world save blob starts with this envelope so the migrator can read the version first. */
export const WorldSaveEnvelopeSchema = z.object({ version: z.number().int().positive() });

/**
 * The one coordinate reference system the world save speaks. WGS84 geographic
 * degrees, longitude first, as `city-dataset.ts` stores its tiles. A dataset
 * in any other CRS must be converted to this on import, never saved as is.
 */
export const WORLD_CRS = 'EPSG:4326';
export const WorldCrsSchema = z.literal(WORLD_CRS);

/** A canonical map position: WGS84 degrees with its CRS spelled out. */
export const GeoPositionSchema = z.object({
  crs: WorldCrsSchema,
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});

/**
 * The dataset the scene was projected from when the save was written.
 * `originRef` is the origin `projectCityPoint` subtracts before scaling, so
 * the scene-space transform is reproducible from the save alone.
 */
export const WorldDatasetRefSchema = z.object({
  datasetId: IdSchema,
  datasetVersion: z.number().int().positive(),
  originRef: GeoPositionSchema,
});

/** The camera's clamp in `city-camera.ts` (`moveCityCamera`): ±2000 m target, 8–3000 m distance (MIN_CAMERA_DISTANCE). */
export const SCENE_HALF_EXTENT_M = 2000;
export const CAMERA_MIN_DISTANCE_M = 8;
export const CAMERA_MAX_DISTANCE_M = 3000;
const TAU = Math.PI * 2;

/**
 * The city camera in scene space, as `city-scene.ts` `CityCamera` holds it:
 * `x`/`z` the look-at point in metres from the dataset origin (east = +x,
 * north = −z), `yaw` the orbit angle in radians, `distance` in metres.
 */
export const WorldCameraSchema = z.object({
  x: z.number().min(-SCENE_HALF_EXTENT_M).max(SCENE_HALF_EXTENT_M),
  z: z.number().min(-SCENE_HALF_EXTENT_M).max(SCENE_HALF_EXTENT_M),
  yaw: z.number().min(0).lt(TAU),
  distance: z.number().min(CAMERA_MIN_DISTANCE_M).max(CAMERA_MAX_DISTANCE_M),
});

/**
 * Visual state of the START/STOP pill, mirrored from `PillState` in
 * `packages/ui/game-controls/contract.ts`. Core cannot import the kit, so the
 * app's `save-cadence.ts` carries a compile-time equality check between the two.
 */
export const WORLD_PILL_STATES = ['start', 'playing', 'paused', 'stopConfirm'] as const;
export const WorldPillStateSchema = z.enum(WORLD_PILL_STATES);

/**
 * Gameplay facts worth restoring. Only the pill today: no gameplay spec
 * exists, so there are no scores, abilities or inventories to save (Law 1).
 * Decision: BUILD the pill only; DEFER everything else to a gameplay spec.
 */
export const WorldGameplaySchema = z.object({
  pill: WorldPillStateSchema,
});

/**
 * Sync bookkeeping. `syncedRevision` is the last revision the server
 * acknowledged (0 before the first sync); `pendingSince` is when the first
 * unsynced write happened, `null` when nothing is pending.
 */
export const WorldSyncSchema = z.object({
  syncedRevision: z.number().int().nonnegative(),
  pendingSince: EpochMsSchema.nullable(),
});

/**
 * World save v1. One JSON value under one MMKV key. `revision` rises by one
 * on every durable write and never goes back; `savedAt` is the write time.
 * `headingRadians` is the compass bearing the camera faces, clockwise from
 * north, the radian form of `camera-input.ts` `headingDegrees` (bearing =
 * −yaw). It is stored next to the camera rather than derived at load so a
 * future camera model with pitch or roll can keep the same heading field.
 */
export const WorldSaveV1Schema = z.object({
  version: z.literal(1),
  revision: z.number().int().positive(),
  savedAt: EpochMsSchema,
  /** The device that wrote this revision. */
  deviceId: IdSchema,
  /** The Caller who owns the world. A save for another Caller is never resumed. */
  playerId: IdSchema,
  /** The play session this revision belongs to. Pause and resume keep it; stop ends it. */
  sessionId: IdSchema,
  /** The world the player is in. Resume never mints a new one. */
  worldInstanceId: IdSchema,
  /** District or region id when the dataset knows one; `null` when it does not. */
  districtId: IdSchema.nullable(),
  position: GeoPositionSchema,
  dataset: WorldDatasetRefSchema,
  headingRadians: z.number().min(0).lt(TAU),
  camera: WorldCameraSchema,
  gameplay: WorldGameplaySchema,
  sync: WorldSyncSchema,
});

export const CURRENT_WORLD_SAVE_VERSION = 1;
export const WorldSaveCurrentSchema = WorldSaveV1Schema;

export type GeoPosition = z.infer<typeof GeoPositionSchema>;
export type WorldDatasetRef = z.infer<typeof WorldDatasetRefSchema>;
export type WorldCamera = z.infer<typeof WorldCameraSchema>;
export type WorldPillState = z.infer<typeof WorldPillStateSchema>;
export type WorldGameplay = z.infer<typeof WorldGameplaySchema>;
export type WorldSync = z.infer<typeof WorldSyncSchema>;
export type WorldSaveV1 = z.infer<typeof WorldSaveV1Schema>;
export type WorldSave = z.infer<typeof WorldSaveCurrentSchema>;
