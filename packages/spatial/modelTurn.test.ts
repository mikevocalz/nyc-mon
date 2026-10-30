import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_PITCH } from './modelFraming.ts';
import { dragTurn, KEY_PITCH_STEP, KEY_YAW_STEP, keyTurn, normalizeYaw, presetFor } from './modelTurn.ts';

describe('modelTurn', () => {
  it('wraps yaw into [0, 360)', () => {
    assert.equal(normalizeYaw(370), 10);
    assert.equal(normalizeYaw(-90), 270);
    assert.equal(normalizeYaw(360), 0);
    assert.equal(normalizeYaw(Number.NaN), 0);
  });

  it('turns half way round over a full-width drag and tilts within the limit', () => {
    assert.deepEqual(dragTurn({ yaw: 0, pitch: 0 }, 400, 0, 400, 300), { yaw: 180, pitch: 0 });
    assert.deepEqual(dragTurn({ yaw: 90, pitch: 0 }, -200, 0, 400, 300), { yaw: 0, pitch: 0 });
    assert.equal(dragTurn({ yaw: 0, pitch: 0 }, 0, 75, 400, 300).pitch, MAX_PITCH);
    assert.equal(dragTurn({ yaw: 0, pitch: 0 }, 0, 30, 400, 300).pitch, 6);
    assert.equal(dragTurn({ yaw: 0, pitch: 0 }, 0, -3000, 400, 300).pitch, -MAX_PITCH);
    // A zero-size stage never divides by zero.
    assert.ok(Number.isFinite(dragTurn({ yaw: 0, pitch: 0 }, 5, 5, 0, 0).yaw));
  });

  it('steps with the arrow keys and ignores other keys', () => {
    assert.deepEqual(keyTurn({ yaw: 0, pitch: 0 }, 'ArrowLeft'), { yaw: 360 - KEY_YAW_STEP, pitch: 0 });
    assert.deepEqual(keyTurn({ yaw: 0, pitch: 0 }, 'ArrowRight'), { yaw: KEY_YAW_STEP, pitch: 0 });
    assert.deepEqual(keyTurn({ yaw: 0, pitch: 0 }, 'ArrowDown'), { yaw: 0, pitch: KEY_PITCH_STEP });
    assert.deepEqual(keyTurn({ yaw: 0, pitch: -MAX_PITCH }, 'ArrowUp'), { yaw: 0, pitch: -MAX_PITCH });
    assert.equal(keyTurn({ yaw: 0, pitch: 0 }, 'a'), null);
  });

  it('names the angle button a turn sits on, and none between them', () => {
    assert.equal(presetFor({ yaw: 0, pitch: 0 }), '0');
    assert.equal(presetFor({ yaw: 359.8, pitch: 0 }), '0');
    assert.equal(presetFor({ yaw: 270, pitch: 0 }), '270');
    assert.equal(presetFor({ yaw: 90 + KEY_YAW_STEP * 6, pitch: 0 }), '180');
    assert.equal(presetFor({ yaw: 45, pitch: 0 }), null);
    assert.equal(presetFor({ yaw: 90, pitch: 5 }), null);
  });
});
