import { describe, expect, it } from 'vitest';
import {
  CURRENT_WORLD_SAVE_VERSION,
  type GeoPosition,
  WORLD_CRS,
  type WorldSave,
  WorldSaveCurrentSchema,
} from '../schemas/world-save.ts';
import { createUnavailableLeaderboardSource, validateLeaderboardRows } from '../leaderboard/source.ts';
import { type DatasetMigration, loadWorldSave, migrateWorldSaveBlob, WorldSaveLoadError } from '../world/migrate.ts';
import { type ResumeDataset, type ResumeResult, resolveResume } from '../world/resume.ts';
import { INITIAL_SESSION_STATE, transitionSession } from '../world/session.ts';
import {
  headingRadiansFromYaw,
  projectToScene,
  rebaseCamera,
  unprojectFromScene,
  yawFromHeadingRadians,
} from '../world/transform.ts';
import { forAll, T0 } from './harness.ts';

// Master Directive v2 §14 "Resume fixtures": canonical coordinates compared
// numerically, never by screenshot. Each `it` names its fixture number.

/** The bundled tile's origin (packages/app/features/game/data/harlem-apollo.json). */
const ORIGIN: GeoPosition = { crs: WORLD_CRS, longitude: -73.94975, latitude: 40.81005 };
const DATASET: ResumeDataset = { datasetId: 'harlem-apollo-20261014', datasetVersion: 1, originRef: ORIGIN };
const OWNER = 'caller-1';

function fullSave(overrides: Partial<WorldSave> = {}): WorldSave {
  const position = unprojectFromScene({ x: 412.5, z: -187.25 }, ORIGIN);
  return WorldSaveCurrentSchema.parse({
    version: 1,
    revision: 5,
    savedAt: T0,
    deviceId: 'device-a',
    playerId: OWNER,
    sessionId: 'session-1',
    worldInstanceId: 'world-1',
    districtId: 'harlem',
    position,
    dataset: { datasetId: DATASET.datasetId, datasetVersion: 1, originRef: ORIGIN },
    headingRadians: headingRadiansFromYaw(Math.PI / 3),
    camera: { x: 412.5, z: -187.25, yaw: Math.PI / 3, distance: 160 },
    gameplay: { pill: 'paused' },
    sync: { syncedRevision: 5, pendingSince: null },
    ...overrides,
  });
}

function resumed(result: ResumeResult) {
  if (result.kind !== 'resume') throw new Error(`Expected resume, got ${result.kind}`);
  return result;
}

function failed(result: ResumeResult) {
  if (result.kind !== 'error') throw new Error(`Expected error, got ${result.kind}`);
  return result;
}

describe('world transform (Karney tier: same maths as projectCityPoint, reproducible to the double)', () => {
  it('matches projectCityPoint on the point city-dataset.test.ts checks', () => {
    const origin: GeoPosition = { crs: WORLD_CRS, longitude: -73.95, latitude: 40.81 };
    const scene = projectToScene({ crs: WORLD_CRS, longitude: -73.949, latitude: 40.811 }, origin);
    expect(scene.x).toBeCloseTo(84.1614436019474, 9);
    expect(scene.z).toBeCloseTo(-111.19508023327376, 9);
    expect(projectToScene(origin, origin)).toEqual({ x: 0, z: -0 });
  });

  it('round-trips with sub-centimetre error at the 2000 m camera clamp, in every direction', () => {
    let worst = 0;
    for (const [x, z] of [[2000, 2000], [-2000, 2000], [2000, -2000], [-2000, -2000], [2000, 0], [0, -2000]] as const) {
      const back = projectToScene(unprojectFromScene({ x, z }, ORIGIN), ORIGIN);
      worst = Math.max(worst, Math.hypot(back.x - x, back.z - z));
    }
    forAll(2000, (random) => ({ x: (random() * 2 - 1) * 2000, z: (random() * 2 - 1) * 2000 }), (point) => {
      const back = projectToScene(unprojectFromScene(point, ORIGIN), ORIGIN);
      const error = Math.hypot(back.x - point.x, back.z - point.z);
      worst = Math.max(worst, error);
      expect(error).toBeLessThan(0.01);
    });
    // Measured: double rounding only. The bound the schema comment promises is far looser than this.
    expect(worst).toBeLessThan(1e-6);
  });

  it('heading is the radian twin of headingDegrees (bearing = −yaw) and an involution', () => {
    expect(headingRadiansFromYaw(0)).toBe(0);
    expect(headingRadiansFromYaw(Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect((headingRadiansFromYaw(Math.PI / 2) * 180) / Math.PI).toBeCloseTo(270, 9);
    expect(yawFromHeadingRadians(headingRadiansFromYaw(1.234))).toBeCloseTo(1.234, 12);
  });

  it('rebasing through the canonical position moves the camera by exactly the origin shift', () => {
    const shifted: GeoPosition = { ...ORIGIN, longitude: ORIGIN.longitude + 0.001 };
    const camera = { x: 100, z: 50, yaw: 1, distance: 220 };
    const rebased = rebaseCamera(camera, ORIGIN, shifted);
    const shiftX = projectToScene(ORIGIN, shifted).x;
    expect(rebased.x).toBeCloseTo(100 + shiftX, 6);
    expect(rebased.z).toBeCloseTo(50, 6);
    expect(rebased.yaw).toBe(1);
    expect(rebased.distance).toBe(220);
  });
});

describe('world save schema and migrations', () => {
  it('a current save round-trips through JSON unchanged and reports typed failures', () => {
    const save = fullSave();
    expect(loadWorldSave(JSON.stringify(save))).toEqual(save);
    expect(CURRENT_WORLD_SAVE_VERSION).toBe(1);
    const reason = (raw: string) => {
      try {
        loadWorldSave(raw);
      } catch (error) {
        if (error instanceof WorldSaveLoadError) return error.reason;
        throw error;
      }
      return 'none';
    };
    expect(reason('{nope')).toBe('corrupt');
    expect(reason(JSON.stringify({ hello: 1 }))).toBe('corrupt');
    expect(reason(JSON.stringify({ ...save, version: 9 }))).toBe('future-version');
    expect(reason(JSON.stringify({ ...save, camera: { ...save.camera, x: 2001 } }))).toBe('invalid');
    expect(reason(JSON.stringify({ ...save, position: { ...save.position, crs: 'EPSG:3857' } }))).toBe('invalid');
    expect(reason(JSON.stringify({ ...save, revision: 0 }))).toBe('invalid');
  });

  it('the empty v1 table still walks a supplied chain step by step', () => {
    const table = [{ from: 1, migrate: (b: Record<string, unknown>) => ({ ...b, addedInV2: true }) }];
    expect(migrateWorldSaveBlob(fullSave(), 2, table)).toMatchObject({ version: 2, addedInV2: true });
    expect(() => migrateWorldSaveBlob(fullSave(), 3, table)).toThrow(WorldSaveLoadError);
  });
});

describe('resume fixtures (§14)', () => {
  it('fixture 1: new user, no save → new-game', () => {
    expect(resolveResume({ candidates: [], now: T0, ownerId: OWNER, dataset: DATASET })).toEqual({ kind: 'new-game', rejected: [] });
  });

  it('fixture 2: existing user → resumes at the saved coordinates, heading and camera', () => {
    const save = fullSave();
    const result = resumed(resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0 + 60_000, ownerId: OWNER, dataset: DATASET }));
    expect(result.save).toEqual(save);
    expect(result.camera).toEqual(save.camera);
    expect(result.heading).toBe(save.headingRadians);
    expect(result.scene.x).toBeCloseTo(412.5, 6);
    expect(result.scene.z).toBeCloseTo(-187.25, 6);
    expect(result.savedAgoMs).toBe(60_000);
    expect(result.rejected).toEqual([]);
  });

  it('fixture 3: exit, reopen, resume → no repositioning (bit-identical doubles through storage)', () => {
    const save = fullSave();
    const first = resumed(resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0, ownerId: OWNER, dataset: DATASET }));
    const reopened = JSON.parse(JSON.stringify(first.save)) as unknown;
    const second = resumed(resolveResume({ candidates: [{ source: 'local', blob: reopened }], now: T0 + 1, ownerId: OWNER, dataset: DATASET }));
    expect(second.scene).toEqual(first.scene);
    expect(second.camera).toEqual(first.camera);
    expect(second.heading).toBe(first.heading);
    expect(second.save.position).toEqual(first.save.position);
  });

  it('fixture 4: a save exactly on a chunk boundary restores to the same chunk with no precision loss', () => {
    const CHUNK_M = 250;
    for (const edge of [250, 1000, 1750, 2000, -250, -2000]) {
      const camera = { x: edge, z: -edge, yaw: 0, distance: 100 };
      const save = fullSave({ camera, position: unprojectFromScene(camera, ORIGIN) });
      const stored = JSON.parse(JSON.stringify(save)) as unknown;
      const result = resumed(resolveResume({ candidates: [{ source: 'local', blob: stored }], now: T0, ownerId: OWNER, dataset: DATASET }));
      expect(Math.abs(result.scene.x - edge)).toBeLessThan(1e-6);
      expect(Math.abs(result.scene.z + edge)).toBeLessThan(1e-6);
      expect(result.camera.x).toBe(edge);
      // The chunk index is derived, never stored; the derived index must not flip across the edge.
      expect(Math.floor((result.scene.x + 1e-9) / CHUNK_M)).toBe(Math.floor((edge + 1e-9) / CHUNK_M));
    }
  });

  it('fixture 5: pause/resume via the pill keeps the same session id', () => {
    const started = transitionSession(INITIAL_SESSION_STATE, { type: 'start', sessionId: 'session-1', at: T0 });
    const paused = transitionSession(started.state, { type: 'pillPress', at: T0 + 10 });
    const playing = transitionSession(paused.state, { type: 'pillPress', at: T0 + 20 });
    expect(paused.pill).toBe('paused');
    expect(playing.pill).toBe('playing');
    expect(playing.state).toMatchObject({ kind: 'playing', sessionId: 'session-1', startedAt: T0 });
    const save = fullSave({ sessionId: 'session-1', gameplay: { pill: 'paused' } });
    expect(resumed(resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0, ownerId: OWNER, dataset: DATASET })).save.sessionId).toBe('session-1');
  });

  it('fixture 6: fold/unfold in the lobby is not a session input; the session is intact', () => {
    // A layout change reaches the input router as cancel-all('fold-change'),
    // never the session machine: SessionEvent has no fold variant, so the
    // state before and after a fold is the same object.
    const started = transitionSession(INITIAL_SESSION_STATE, { type: 'start', sessionId: 'session-1', at: T0 });
    const after = transitionSession(started.state, { type: 'cancelStop', at: T0 + 5 });
    expect(after.outcome).toBe('ignored');
    expect(after.state).toBe(started.state);
    expect(after.effects).toEqual([]);
  });

  it('fixture 7: exit unfolded, resume on the outer screen: the save carries no viewport, so the result is identical', () => {
    const save = fullSave();
    expect(Object.keys(save)).not.toContain('viewport');
    const a = resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0, ownerId: OWNER, dataset: DATASET });
    const b = resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0, ownerId: OWNER, dataset: DATASET });
    expect(b).toEqual(a);
  });

  it('fixture 8: a newer save on another device wins; the stale offline snapshot is rejected, never written back', () => {
    const local = fullSave({ revision: 5, deviceId: 'device-a', sync: { syncedRevision: 5, pendingSince: null } });
    const remote = fullSave({ revision: 6, deviceId: 'device-b', savedAt: T0 + 5000, camera: { x: 1, z: 2, yaw: 0, distance: 90 } });
    const result = resumed(resolveResume({ candidates: [{ source: 'local', blob: local }, { source: 'remote', blob: remote }], now: T0 + 9000, ownerId: OWNER, dataset: DATASET }));
    expect(result.save.revision).toBe(6);
    expect(result.camera).toEqual(remote.camera);
    expect(result.rejected).toEqual([{ source: 'local', revision: 5, reason: 'stale-revision' }]);
  });

  it('fixture 8b: two devices that both advanced to the same revision: the later savedAt wins', () => {
    const a = fullSave({ revision: 6, deviceId: 'device-a', savedAt: T0 + 100, sync: { syncedRevision: 5, pendingSince: T0 } });
    const b = fullSave({ revision: 6, deviceId: 'device-b', savedAt: T0 + 200 });
    const result = resumed(resolveResume({ candidates: [{ source: 'local', blob: a }, { source: 'remote', blob: b }], now: T0 + 300, ownerId: OWNER, dataset: DATASET }));
    expect(result.save.deviceId).toBe('device-b');
    expect(result.rejected).toEqual([{ source: 'local', revision: 6, reason: 'older-same-revision' }]);
  });

  it('fixture 9: offline resume from the latest valid local snapshot, ahead of an older synced copy', () => {
    const local = fullSave({ revision: 7, sync: { syncedRevision: 5, pendingSince: T0 - 1000 } });
    const only = resumed(resolveResume({ candidates: [{ source: 'local', blob: local }], now: T0, ownerId: OWNER, dataset: DATASET }));
    expect(only.save.revision).toBe(7);
    const remote = fullSave({ revision: 5, deviceId: 'device-b' });
    const both = resumed(resolveResume({ candidates: [{ source: 'remote', blob: remote }, { source: 'local', blob: local }], now: T0, ownerId: OWNER, dataset: DATASET }));
    expect(both.save.revision).toBe(7);
    expect(both.rejected).toEqual([{ source: 'remote', revision: 5, reason: 'stale-revision' }]);
    // A full tie keeps the local copy.
    const tie = resumed(resolveResume({ candidates: [{ source: 'remote', blob: local }, { source: 'local', blob: local }], now: T0, ownerId: OWNER, dataset: DATASET }));
    expect(tie.rejected).toEqual([{ source: 'remote', revision: 7, reason: 'duplicate' }]);
  });

  it('fixture 10: a missing or incompatible dataset is an explicit error with a recovery, never a silent teleport', () => {
    const save = fullSave();
    const otherTile = failed(resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0, ownerId: OWNER, dataset: { ...DATASET, datasetId: 'midtown-20261101' } }));
    expect(otherTile).toMatchObject({ reason: 'incompatible-dataset', recovery: 'start-new' });
    expect(otherTile.rejected).toEqual([{ source: 'local', revision: 5, reason: 'incompatible-dataset' }]);
    const noMigration = failed(resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0, ownerId: OWNER, dataset: { ...DATASET, datasetVersion: 2 } }));
    expect(noMigration.reason).toBe('incompatible-dataset');
  });

  it('fixture 10b: a dataset migration is a coordinate migration: the canonical position survives an origin move', () => {
    const save = fullSave();
    const movedOrigin: GeoPosition = { ...ORIGIN, longitude: ORIGIN.longitude + 0.002, latitude: ORIGIN.latitude - 0.001 };
    const v2: ResumeDataset = { ...DATASET, datasetVersion: 2, originRef: movedOrigin };
    const identity: DatasetMigration = { datasetId: DATASET.datasetId, fromDatasetVersion: 1, toDatasetVersion: 2, migratePosition: (p) => p };
    const result = resumed(resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0, ownerId: OWNER, dataset: v2, datasetMigrations: [identity] }));
    expect(result.save.position).toEqual(save.position);
    expect(result.save.dataset).toEqual({ datasetId: DATASET.datasetId, datasetVersion: 2, originRef: movedOrigin });
    const expected = projectToScene(save.position, movedOrigin);
    expect(result.scene.x).toBeCloseTo(expected.x, 6);
    expect(result.camera.x).toBeCloseTo(expected.x, 6);
    expect(result.camera.z).toBeCloseTo(expected.z, 6);
    expect(result.camera.yaw).toBe(save.camera.yaw);
    expect(result.save.revision).toBe(save.revision);
    expect(result.save.sessionId).toBe(save.sessionId);
    expect(result.save.worldInstanceId).toBe(save.worldInstanceId);
  });

  it('fixture 11: a leaderboard outage never blocks a valid resume and leaves the save unchanged', async () => {
    const save = fullSave();
    const before = JSON.stringify(save);
    const page = await createUnavailableLeaderboardSource().load();
    expect(page).toEqual({ status: 'error', rows: [], reason: 'no-ranking-authority' });
    const result = resumed(resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0, ownerId: OWNER, dataset: DATASET }));
    expect(JSON.stringify(result.save)).toBe(before);
  });

  it('fixture 12: rank rows reach the panel only with validated values', () => {
    const { rows, droppedCount } = validateLeaderboardRows([
      { rank: 1, playerId: 'p1', displayName: 'Dee', score: 1200, isSelf: false },
      { rank: 2, playerId: 'p2', displayName: '', score: 900, isSelf: false },
      { rank: 3, playerId: 'p3', displayName: 'Nan', score: Number.NaN, isSelf: false },
      { rank: 0, playerId: 'p4', displayName: 'Zero', score: 1, isSelf: false },
      { rank: 4, playerId: 'p1', displayName: 'Dupe', score: 1, isSelf: false },
      { rank: 5, playerId: 'p5', displayName: 'Me', score: 10, isSelf: true },
    ]);
    expect(rows.map((r) => r.playerId)).toEqual(['p1', 'p5']);
    expect(droppedCount).toBe(4);
  });

  it('every failure maps to a reason and a recovery; mixed failures report the most actionable', () => {
    const save = fullSave();
    expect(failed(resolveResume({ candidates: [{ source: 'local', blob: '{' }], now: T0, ownerId: OWNER, dataset: DATASET }))).toMatchObject({ reason: 'corrupt', recovery: 'retry-sync' });
    expect(failed(resolveResume({ candidates: [{ source: 'local', blob: {} }, { source: 'remote', blob: {} }], now: T0, ownerId: OWNER, dataset: DATASET }))).toMatchObject({ reason: 'corrupt', recovery: 'start-new' });
    expect(failed(resolveResume({ candidates: [{ source: 'local', blob: { ...save, version: 2 } }], now: T0, ownerId: OWNER, dataset: DATASET }))).toMatchObject({ reason: 'future-version', recovery: 'keep-waiting' });
    const notOwner = failed(resolveResume({ candidates: [{ source: 'local', blob: save }], now: T0, ownerId: 'caller-2', dataset: DATASET }));
    expect(notOwner).toMatchObject({ reason: 'not-owner', recovery: 'start-new' });
    expect(notOwner.rejected).toEqual([{ source: 'local', revision: 5, reason: 'not-owner' }]);
    const mixed = failed(resolveResume({ candidates: [{ source: 'local', blob: {} }, { source: 'remote', blob: { ...save, version: 2 } }], now: T0, ownerId: OWNER, dataset: DATASET }));
    expect(mixed.reason).toBe('future-version');
  });
});
