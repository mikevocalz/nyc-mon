import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ResumeResult, WorldSave } from '@acme/core';
import { INITIAL_CITY_CAMERA } from '../city-camera.ts';
import { planResumeSequence, runResumeSequence, type ResumeSequenceEffects } from './resume-sequence.ts';

const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);

const save: WorldSave = {
  version: 1,
  revision: 7,
  savedAt: T0 - 60_000,
  deviceId: 'device-a',
  playerId: 'caller-1',
  sessionId: 'session-1',
  worldInstanceId: 'world-1',
  districtId: 'harlem',
  position: { crs: 'EPSG:4326', longitude: -73.9497512345678, latitude: 40.8100598765432 },
  dataset: { datasetId: 'harlem-apollo-20261014', datasetVersion: 1, originRef: { crs: 'EPSG:4326', longitude: -73.94975, latitude: 40.81005 } },
  headingRadians: 1.2345678901234567,
  // Doubles chosen so a float32 round trip would change them (fixture 3).
  camera: { x: 123.456789012345, z: -456.789012345678, yaw: 1.2345678901234567, distance: 220.00000000000003 },
  gameplay: { pill: 'playing' },
  sync: { syncedRevision: 0, pendingSince: T0 - 60_000 },
};

const resumed: ResumeResult = {
  kind: 'resume',
  save,
  camera: save.camera,
  heading: save.headingRadians,
  scene: { x: save.camera.x, z: save.camera.z },
  savedAgoMs: 60_000,
  rejected: [],
};

function recorder() {
  const log: string[] = [];
  let release: () => void = () => undefined;
  const effects: ResumeSequenceEffects = {
    startSession: (reuse) => { log.push(`start-session ${reuse ?? 'mint'}`); },
    setCamera: (camera) => { log.push(`camera ${camera.x},${camera.z},${camera.yaw},${camera.distance}`); },
    hold: () => { log.push('hold'); },
    awaitFirstFrame: () =>
      new Promise((resolve) => {
        log.push('await-first-frame');
        release = resolve;
      }),
    reveal: () => { log.push('reveal'); },
  };
  return { log, effects, firstFrame: () => release() };
}

describe('planResumeSequence', () => {
  it('restores the saved camera bit for bit, starts the session after the first frame, reveals last (fixtures 2, 3; findings C1, H1)', () => {
    const plan = planResumeSequence(resumed);
    assert.equal(plan.kind, 'resume');
    if (plan.kind !== 'resume') return;
    assert.deepEqual(plan.camera, { x: 123.456789012345, z: -456.789012345678, yaw: 1.2345678901234567, distance: 220.00000000000003 });
    assert.equal(plan.revision, 7);
    assert.deepEqual(plan.steps.map((s) => s.kind), ['restore-camera', 'hold', 'start-session', 'reveal']);
    assert.ok(plan.steps.findIndex((s) => s.kind === 'restore-camera') < plan.steps.findIndex((s) => s.kind === 'reveal'));
  });

  it('a resume reuses the saved session id; a new game asks for a minted one (finding L5)', () => {
    const resume = planResumeSequence(resumed).steps.find((s) => s.kind === 'start-session');
    assert.ok(resume && resume.kind === 'start-session');
    assert.equal(resume.sessionId, 'session-1');
    const fresh = planResumeSequence({ kind: 'new-game', rejected: [] }).steps.find((s) => s.kind === 'start-session');
    assert.ok(fresh && fresh.kind === 'start-session');
    assert.equal(fresh.sessionId, null);
  });

  it('new game sets the initial view and mints nothing (fixture 1)', () => {
    const plan = planResumeSequence({ kind: 'new-game', rejected: [] });
    assert.equal(plan.kind, 'new-game');
    assert.equal(plan.camera, null);
    const camera = plan.steps.find((s) => s.kind === 'restore-camera');
    assert.ok(camera && camera.kind === 'restore-camera');
    assert.deepEqual(camera.camera, INITIAL_CITY_CAMERA);
    assert.ok(!JSON.stringify(plan).includes('world_'), 'a plan never carries a minted world id');
  });

  it('an error has no steps: the lobby shows recovery, never a silent spawn (fixture 10)', () => {
    const plan = planResumeSequence({ kind: 'error', reason: 'incompatible-dataset', recovery: 'start-new', rejected: [] });
    assert.equal(plan.kind, 'error');
    assert.deepEqual(plan.steps, []);
    if (plan.kind === 'error') assert.equal(plan.reason, 'incompatible-dataset');
  });
});

describe('runResumeSequence', () => {
  it('sets the camera before the wait, starts the session only after the first frame, then reveals', async () => {
    const { log, effects, firstFrame } = recorder();
    const run = runResumeSequence(planResumeSequence(resumed), effects);
    // Everything up to the wait happened in the same tick: no frame can show spawn, and no session is live under the cover.
    assert.deepEqual(log, ['camera 123.456789012345,-456.789012345678,1.2345678901234567,220.00000000000003', 'hold', 'await-first-frame']);
    firstFrame();
    await run;
    assert.deepEqual(log.slice(-2), ['start-session session-1', 'reveal']);
    assert.equal(log.filter((l) => l === 'reveal').length, 1);
  });

  it('a failed wait stops the run before the session starts (finding C1)', async () => {
    const log: string[] = [];
    await assert.rejects(
      runResumeSequence(planResumeSequence(resumed), {
        startSession: () => { log.push('start-session'); },
        setCamera: () => { log.push('camera'); },
        hold: () => { log.push('hold'); },
        awaitFirstFrame: () => Promise.reject(new Error('world failed')),
        reveal: () => { log.push('reveal'); },
      }),
      /world failed/,
    );
    assert.deepEqual(log, ['camera', 'hold']);
  });

  it('runs nothing for an error plan', async () => {
    const { log, effects } = recorder();
    await runResumeSequence(planResumeSequence({ kind: 'error', reason: 'corrupt', recovery: 'retry-sync', rejected: [] }), effects);
    assert.deepEqual(log, []);
  });
});
