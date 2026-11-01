// EXPO_PUBLIC_GAME_SURFACE parsing: the surface vote is opt-in — only the
// spelled-out names select a backing view, everything else is 'auto'
// (TextureView for the non-opaque canvas).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_SURFACE_TYPE, parseGameSurfaceFlag } from './surface-type.ts';

test('the flag names a backing view only on an explicit match', () => {
  assert.equal(parseGameSurfaceFlag('ahb'), 'HardwareBufferView');
  assert.equal(parseGameSurfaceFlag('HardwareBufferView'), 'HardwareBufferView');
  assert.equal(parseGameSurfaceFlag(' hardwarebuffer '), 'HardwareBufferView');
  assert.equal(parseGameSurfaceFlag('surface'), 'SurfaceView');
  assert.equal(parseGameSurfaceFlag('SurfaceView'), 'SurfaceView');
  assert.equal(parseGameSurfaceFlag('textureview'), 'TextureView');
  assert.equal(parseGameSurfaceFlag('TextureView'), 'TextureView');
});

test('anything else keeps the default TextureView (undefined → auto)', () => {
  for (const value of [undefined, null, '', '0', '1', 'true', 'off', 'metal']) {
    assert.equal(parseGameSurfaceFlag(value), undefined, String(value));
  }
});

test('the exported constant mirrors the env flag', () => {
  assert.equal(GAME_SURFACE_TYPE, parseGameSurfaceFlag(process.env.EXPO_PUBLIC_GAME_SURFACE));
});
