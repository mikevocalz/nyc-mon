// Import-time check for the worklet render runtime.
//
// In worklets Bundle Mode a worklet runtime evaluates the whole bundle with
// Metro's entry points intercepted (ScriptLoader.h, interceptEntryPoints): the
// app entry never runs there, and a module is evaluated only when a worklet
// requires it. worklet-host.ts forwards its relative imports, so the render
// runtime evaluates game-render.ts and everything it imports at module scope.
// None of that may load react-native (worklets docs: a second React Native
// instance on a worklet runtime is unsupported) or a library that wraps it.
//
// This harness approximates that runtime in node: __RUNTIME_KIND is a worker
// runtime (3), the dev Turbo Module guard from bundleMode/shims/reactNativeShim.js
// is installed, react-native-worklets is a stub, and react-native, uniwind,
// React, Expo and the React Native libraries listed in FORBIDDEN resolve to a
// module that throws on evaluation.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';

const FORBIDDEN = ['react-native', 'uniwind', 'react-native-reanimated', 'react-native-gesture-handler', 'react-native-webgpu', 'expo', 'expo-router', 'react'];

const hooks = `
const FORBIDDEN = ${JSON.stringify(FORBIDDEN)};
const forbidden = (s) => FORBIDDEN.some((name) => s === name || s.startsWith(name + '/'));
export async function resolve(specifier, context, next) {
  if (specifier === 'react-native-worklets') {
    return { url: 'data:text/javascript,' + encodeURIComponent('export const scheduleOnRN = (fn, ...args) => fn(...args);'), shortCircuit: true };
  }
  if (forbidden(specifier)) {
    const message = specifier + ' evaluated on a worklet runtime (imported from ' + (context.parentURL ?? '?') + ')';
    return { url: 'data:text/javascript,' + encodeURIComponent('throw new Error(' + JSON.stringify(message) + ');'), shortCircuit: true };
  }
  return next(specifier, context);
}
// Metro bundles JSON as a module; node wants an import attribute for it.
export async function load(url, context, next) {
  if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { ...context.importAttributes, type: 'json' } });
  return next(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(hooks)}`);

const g = globalThis as Record<string, unknown>;
g.__RUNTIME_KIND = 3;
g.__fbBatchedBridgeConfig = new Proxy({}, {
  get() {
    throw new Error('[Worklets] Accessing __fbBatchedBridgeConfig is not allowed on Worklet Runtimes. Perhaps you tried to access a Turbo Module?');
  },
});

test('the harness rejects a module that imports react-native', async () => {
  const probe = `data:text/javascript,${encodeURIComponent("import 'react-native';")}`;
  await assert.rejects(import(probe), /react-native evaluated on a worklet runtime/);
});

test('game-render.ts and its module graph load on a worklet runtime without react-native', async () => {
  const mod = await import('./game-render.ts');
  for (const name of ['startGameRender', 'wakeGameRender', 'setGameRenderRunning', 'stopGameRender']) {
    assert.equal(typeof (mod as Record<string, unknown>)[name], 'function', name);
  }
});
