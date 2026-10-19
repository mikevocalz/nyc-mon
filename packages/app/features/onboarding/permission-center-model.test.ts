import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_SELECTED_PERMISSIONS,
  PERMISSION_IDS,
  requestSelectedPermissions,
} from './permission-center-model.ts';

describe('final onboarding permissions', () => {
  it('preselects Notifications and no sensitive optional access', () => {
    assert.deepEqual(DEFAULT_SELECTED_PERMISSIONS, ['notifications']);
    assert.equal(PERMISSION_IDS.length, 6);
    for (const id of PERMISSION_IDS) {
      if (id !== 'notifications') assert.equal(DEFAULT_SELECTED_PERMISSIONS.includes(id), false);
    }
  });

  it('asks only selected permissions, sequentially, keeping each result', async () => {
    const calls: string[] = [];
    const results = await requestSelectedPermissions(
      ['photos', 'notifications', 'location'],
      async (permission) => {
        calls.push(permission);
        return permission === 'location' ? 'denied' : 'granted';
      },
    );
    assert.deepEqual(calls, ['notifications', 'location', 'photos']);
    assert.deepEqual(results, { notifications: 'granted', location: 'denied', photos: 'granted' });
  });

  it('does not request anything if the Caller skips', async () => {
    let calls = 0;
    const results = await requestSelectedPermissions([], async () => {
      calls += 1;
      return 'granted';
    });
    assert.equal(calls, 0);
    assert.deepEqual(results, {});
  });

  it('continues past a denied or failing permission without changing other preferences', async () => {
    const calls: string[] = [];
    const results = await requestSelectedPermissions(
      ['camera', 'microphone', 'motion'],
      async (permission) => {
        calls.push(permission);
        if (permission === 'microphone') throw new Error('native permission unavailable');
        return permission === 'camera' ? 'denied' : 'granted';
      },
    );
    assert.deepEqual(calls, ['camera', 'microphone', 'motion']);
    assert.deepEqual(results, { camera: 'denied', microphone: 'unavailable', motion: 'granted' });
  });
});
