import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isLobbyCovered, shouldPlayArtboard } from './lobby-playback.ts';

// Review finding M15: no lobby artboard was ever paused.

describe('lobby artboard playback', () => {
  it('plays only when not paused and the app is in the foreground', () => {
    assert.equal(shouldPlayArtboard(false, 'active'), true);
    assert.equal(shouldPlayArtboard(true, 'active'), false);
    assert.equal(shouldPlayArtboard(false, 'background'), false);
    assert.equal(shouldPlayArtboard(false, 'inactive'), false);
  });

  it('the lobby counts as covered for every phase but done', () => {
    assert.deepEqual((['enter', 'hold', 'reveal', 'done'] as const).map(isLobbyCovered), [true, true, true, false]);
  });
});
