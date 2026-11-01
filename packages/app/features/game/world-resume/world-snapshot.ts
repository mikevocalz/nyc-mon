import {
  type GeoPosition,
  hash128,
  toHex32,
  headingRadiansFromYaw,
  unprojectFromScene,
  WORLD_CRS,
  type WorldPillState,
  type WorldSave,
} from '@acme/core';
import type { CityCamera } from '../city-scene.ts';
import type { CityDataset } from '../city-dataset.ts';

// Builds the save the cadence commits. Pure: the camera, dataset and clock
// come in as arguments, so `node --test` covers it without MMKV or React.
//
// The player's canonical position is the camera's look-at point, unprojected
// through the dataset origin with the inverse of `projectCityPoint`
// (`unprojectFromScene` in @acme/core). The camera x,z are stored as well so
// a resume needs no re-projection when the origin has not moved (fixture 3:
// bit-identical doubles through storage).

export interface WorldIdentity {
  /** The signed-in Caller. */
  readonly playerId: string;
  readonly deviceId: string;
}

export interface WorldSnapshotInput {
  /** The last committed save, or `null` on a new game. */
  readonly previous: WorldSave | null;
  readonly identity: WorldIdentity;
  readonly sessionId: string;
  readonly camera: CityCamera;
  readonly dataset: CityDataset;
  readonly pill: WorldPillState;
  /** Epoch ms of the write. */
  readonly now: number;
}

/**
 * The device id a world identity carries (review finding M2): the Mon save's
 * queue id when it has one, otherwise the persisted world id from `persisted`.
 */
export function pickDeviceId(queueDeviceId: string | undefined, persisted: () => string): string {
  if (queueDeviceId !== undefined && queueDeviceId !== '') return queueDeviceId;
  return persisted();
}

/** The bundled tile's id carries its date; the version is the parsed dataset's `version`. */
export function datasetOriginOf(dataset: CityDataset): GeoPosition {
  return { crs: WORLD_CRS, longitude: dataset.origin[0], latitude: dataset.origin[1] };
}

/** A stable id from its parts; cyrb128 through `hash128`, same as the sim core's seeds. */
function stableId(prefix: string, ...parts: readonly string[]): string {
  const [a, b] = hash128(parts.join(':'));
  return `${prefix}_${toHex32(a)}${toHex32(b)}`;
}

/** Minted once per world, on the first save of a new game. Resume never calls this. */
export function mintWorldInstanceId(identity: WorldIdentity, dataset: CityDataset, startedAt: number): string {
  return stableId('world', identity.playerId, dataset.id, String(startedAt));
}

/** Minted by `start` from idle on a new game. Pause, resume and background keep it. */
export function mintSessionId(identity: WorldIdentity, startedAt: number): string {
  return stableId('session', identity.playerId, identity.deviceId, String(startedAt));
}

/**
 * The session id a `start` uses (review finding L5, ADR 0020). A stored save
 * owned by this Caller is continued, so its id is reused; with no save, or a
 * save another Caller owns, the start is a new game and a fresh id is minted.
 */
export function sessionIdForStart(previous: WorldSave | null, identity: WorldIdentity, now: number): string {
  if (previous !== null && previous.playerId === identity.playerId) return previous.sessionId;
  return mintSessionId(identity, now);
}

/**
 * The save `buildWorldSave` may continue from (review finding M1). A save
 * another Caller owns is never "previous": continuing it would copy that
 * Caller's world instance and revision into a write under this identity.
 * `'foreign'` means the caller must not write until the Caller chooses a new
 * game; `null` means there is no save yet, so the write starts a new world.
 */
export function ownedPrevious(previous: WorldSave | null, identity: WorldIdentity): WorldSave | null | 'foreign' {
  if (previous === null) return null;
  return previous.playerId === identity.playerId ? previous : 'foreign';
}

/**
 * The next revision of the world save. `previous === null` starts at 1 with a
 * freshly minted `worldInstanceId`; otherwise the world instance is kept and
 * the revision rises by one. `pendingSince` is set on the first unsynced
 * write and kept until sync clears it.
 */
export function buildWorldSave(input: WorldSnapshotInput): WorldSave {
  const { previous, identity, camera, dataset, pill, now } = input;
  const origin = datasetOriginOf(dataset);
  return {
    version: 1,
    revision: previous === null ? 1 : previous.revision + 1,
    savedAt: now,
    deviceId: identity.deviceId,
    playerId: identity.playerId,
    sessionId: input.sessionId,
    worldInstanceId: previous === null ? mintWorldInstanceId(identity, dataset, now) : previous.worldInstanceId,
    districtId: previous?.districtId ?? null,
    position: unprojectFromScene({ x: camera.x, z: camera.z }, origin),
    dataset: { datasetId: dataset.id, datasetVersion: dataset.version, originRef: origin },
    headingRadians: headingRadiansFromYaw(camera.yaw),
    camera: { x: camera.x, z: camera.z, yaw: camera.yaw, distance: camera.distance },
    gameplay: { pill },
    sync: {
      syncedRevision: previous?.sync.syncedRevision ?? 0,
      pendingSince: previous?.sync.pendingSince ?? now,
    },
  };
}

/** True when a new save would differ from `previous` in anything the player can see. */
export function cameraChangedSince(previous: WorldSave | null, camera: CityCamera, pill: WorldPillState): boolean {
  if (previous === null) return true;
  const p = previous.camera;
  return p.x !== camera.x || p.z !== camera.z || p.yaw !== camera.yaw || p.distance !== camera.distance || previous.gameplay.pill !== pill;
}
