import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRenderThreadFlag, resolveRenderThread } from './render-thread.ts';

test('the env flag asks for the worklet runtime only on an explicit yes', () => {
  for (const yes of ['1', 'true', 'TRUE', ' worklet ']) assert.equal(parseRenderThreadFlag(yes), 'worklet', yes);
  for (const no of [undefined, null, '', '0', 'false', 'js', 'yes']) assert.equal(parseRenderThreadFlag(no), 'js', String(no));
});

test('js stays js whatever else holds', () => {
  assert.deepEqual(resolveRenderThread({ requested: undefined, platform: 'android', hasHost: true, hostAvailable: true }), { thread: 'js', reason: null });
  assert.deepEqual(resolveRenderThread({ requested: 'js', platform: 'android', hasHost: true, hostAvailable: true }), { thread: 'js', reason: null });
});

test('a worklet request falls back to js with the reason', () => {
  assert.deepEqual(resolveRenderThread({ requested: 'worklet', platform: 'web', hasHost: true, hostAvailable: true }), { thread: 'js', reason: 'web' });
  assert.deepEqual(resolveRenderThread({ requested: 'worklet', platform: 'android', hasHost: false, hostAvailable: false }), { thread: 'js', reason: 'no-host' });
  assert.deepEqual(resolveRenderThread({ requested: 'worklet', platform: 'android', hasHost: true, hostAvailable: false }), { thread: 'js', reason: 'host-unavailable' });
});

test('a worklet request with a working host on native gets the worklet runtime', () => {
  assert.deepEqual(resolveRenderThread({ requested: 'worklet', platform: 'android', hasHost: true, hostAvailable: true }), { thread: 'worklet', reason: null });
  assert.deepEqual(resolveRenderThread({ requested: 'worklet', platform: 'ios', hasHost: true, hostAvailable: true }), { thread: 'worklet', reason: null });
});
