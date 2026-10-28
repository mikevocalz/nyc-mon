import assert from 'node:assert/strict';
import test from 'node:test';
import { HUD_SIZE } from './hud.ts';
import type { DeviceScreen } from './screen.ts';
import { createSwitchScreen } from './switch-screen.ts';

function screen(reaction: { key: number; clips: readonly string[] }, padPans = false): DeviceScreen {
  return {
    size: HUD_SIZE, draw: () => undefined, hitTest: () => null, select: () => undefined, subscribe: () => () => undefined,
    monReaction: () => reaction,
    ...(padPans ? { padPans: () => true } : {}),
  };
}

test('monReaction: a key change within one screen plays once; a new screen with its own count plays nothing', () => {
  const a = { key: 0, clips: ['up_look_listen'] as readonly string[] };
  const b = { key: 5, clips: ['wave'] as readonly string[] };
  const sa = screen(a);
  const sb = screen(b);
  let current: DeviceScreen = sa;
  const sw = createSwitchScreen({ models: [], current: () => current, watch: () => () => undefined });
  const k0 = sw.monReaction!().key;
  a.key = 1;
  const r1 = sw.monReaction!();
  assert.equal(r1.key, k0 + 1);
  assert.deepEqual(r1.clips, ['up_look_listen']);
  current = sb;
  assert.equal(sw.monReaction!().key, r1.key, 'switching screens is not a reaction');
  b.key = 6;
  const r2 = sw.monReaction!();
  assert.equal(r2.key, r1.key + 1);
  assert.deepEqual(r2.clips, ['wave']);
});

test('padPans follows the screen showing now', () => {
  let current = screen({ key: 0, clips: [] }, true);
  const sw = createSwitchScreen({ models: [], current: () => current, watch: () => () => undefined });
  assert.equal(sw.padPans!(), true);
  current = screen({ key: 0, clips: [] });
  assert.equal(sw.padPans!(), false);
});
