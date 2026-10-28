// M19 device preferences: storage round trip, defaults per field, and the
// Notifications switch's action for each OS permission.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { KeyValueStorage } from '../onboarding/storage.types.ts';
import {
  DEFAULT_DEVICE_PREFS, DEVICE_PREFS_KEY, notificationsOn, notifyToggleAction, readDevicePrefs, writeDevicePrefs,
} from './device-prefs-model.ts';

function memory(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getString: (k) => map.get(k), set: (k, v) => void map.set(k, v), remove: (k) => void map.delete(k) };
}

test('defaults: haptics and sound on, motion follows the OS, alerts wanted', () => {
  assert.deepEqual(readDevicePrefs(memory()), { haptics: true, sound: true, forceReducedMotion: false, notifications: true });
});

test('round trip through storage', () => {
  const store = memory();
  const prefs = { haptics: false, sound: false, forceReducedMotion: true, notifications: false };
  writeDevicePrefs(store, prefs);
  assert.deepEqual(readDevicePrefs(store), prefs);
});

test('a broken or partial value falls back field by field', () => {
  const store = memory();
  store.set(DEVICE_PREFS_KEY, '{nope');
  assert.deepEqual(readDevicePrefs(store), DEFAULT_DEVICE_PREFS);
  store.set(DEVICE_PREFS_KEY, JSON.stringify({ sound: false, haptics: 'yes' }));
  assert.deepEqual(readDevicePrefs(store), { ...DEFAULT_DEVICE_PREFS, sound: false });
});

test('the Notifications switch: off disables, on depends on the OS', () => {
  assert.equal(notifyToggleAction(false, 'granted'), 'disable');
  assert.equal(notifyToggleAction(true, 'granted'), 'enable');
  assert.equal(notifyToggleAction(true, 'undetermined'), 'request');
  assert.equal(notifyToggleAction(true, 'denied'), 'open-settings');
});

test('the switch reads on only when wanted and allowed', () => {
  assert.equal(notificationsOn(DEFAULT_DEVICE_PREFS, 'granted'), true);
  assert.equal(notificationsOn(DEFAULT_DEVICE_PREFS, 'denied'), false);
  assert.equal(notificationsOn({ ...DEFAULT_DEVICE_PREFS, notifications: false }, 'granted'), false);
});
