// M21: the Android manifest plugin merges the gamepad feature by name.
// The plugin lives in apps/mobile/plugins; this test drives its pure half.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { it } from 'node:test';

const require = createRequire(import.meta.url);
const plugin = require('../../../../../apps/mobile/plugins/with-optional-gamepad.js') as {
  applyOptionalGamepad: (manifest: Record<string, unknown>) => { 'uses-feature': { $: Record<string, string> }[] };
};

const gamepad = (required: string) => ({ $: { 'android:name': 'android.hardware.gamepad', 'android:required': required } });
const camera = { $: { 'android:name': 'android.hardware.camera', 'android:required': 'true' } };

it('adds one optional gamepad entry and keeps the others', () => {
  const out = plugin.applyOptionalGamepad({ 'uses-feature': [camera] });
  assert.deepEqual(out['uses-feature'], [camera, gamepad('false')]);
});

it('rewrites an existing gamepad entry in place instead of duplicating it', () => {
  const out = plugin.applyOptionalGamepad({ 'uses-feature': [gamepad('true'), camera, gamepad('true')] });
  assert.deepEqual(out['uses-feature'], [gamepad('false'), camera]);
});

it('is idempotent across repeated prebuilds', () => {
  const once = plugin.applyOptionalGamepad({});
  const twice = plugin.applyOptionalGamepad(once);
  assert.deepEqual(twice, once);
  assert.equal(twice['uses-feature'].length, 1);
});
