// ADR 0026: the iOS config plugin that keeps Skia's Dawn instance symbol linked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { it } from 'node:test';

const require = createRequire(import.meta.url);
const plugin = require('../../../../../apps/mobile/plugins/with-skia-wgpu-instance.js') as { addForcedSymbol: (flags?: string | string[]) => string[] };

it('starts from $(inherited) when the target has no linker flags', () => {
  assert.deepEqual(plugin.addForcedSymbol(undefined), ['"$(inherited)"', '"-Wl,-u,_rnskia_getWGPUInstance"']);
});

it('keeps existing flags, string or list', () => {
  assert.deepEqual(plugin.addForcedSymbol('"-ObjC"'), ['"-ObjC"', '"-Wl,-u,_rnskia_getWGPUInstance"']);
  assert.deepEqual(plugin.addForcedSymbol(['"$(inherited)"', '-lc++']), ['"$(inherited)"', '-lc++', '"-Wl,-u,_rnskia_getWGPUInstance"']);
});

it('is idempotent across repeated prebuilds', () => {
  const once = plugin.addForcedSymbol(['"$(inherited)"']);
  assert.deepEqual(plugin.addForcedSymbol(once), once);
});
