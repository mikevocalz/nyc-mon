import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STAGE_LOADING, stageLoaderUp } from './stage-loading.ts';

describe('stageLoaderUp (persistent stage)', () => {
  it('is up from the first frame', () => {
    assert.equal(stageLoaderUp(STAGE_LOADING), true);
  });

  it('stays up when the device is ready but the Baby has not landed (the 8 s model wait gave up)', () => {
    assert.equal(stageLoaderUp({ ...STAGE_LOADING, deviceReady: true }), true);
  });

  it('stays up when the Baby landed before the device drew', () => {
    assert.equal(stageLoaderUp({ ...STAGE_LOADING, modelsSettled: true }), true);
  });

  it('comes down once both are ready', () => {
    assert.equal(stageLoaderUp({ deviceReady: true, modelsSettled: true, failed: false }), false);
  });

  it('comes down at once when the stage cannot run', () => {
    assert.equal(stageLoaderUp({ ...STAGE_LOADING, failed: true }), false);
  });
});
