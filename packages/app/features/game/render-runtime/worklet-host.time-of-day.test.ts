// The worklet path carries the time-of-day pick: worklet-host packs the
// timeOfDayStore preset into every snapshot and writes a fresh one when the
// pick changes, so the render runtime's next draw re-lights the city.
// react-native-worklets, @acme/ui/three and @acme/ui/gpu are stubs here (node
// has no worklet runtime); game-render.ts loads as it does in the other
// render-runtime tests and is never started.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';

const worklets = `
export const createSynchronizable = (initial) => {
  let value = initial;
  return { getDirty: () => value, setBlocking: (next) => { value = next; } };
};
export const createWorkletRuntime = () => ({ runtimeId: 1 });
export const isBundleModeEnabled = () => true;
export const scheduleOnRN = (fn, ...args) => fn(...args);
export const scheduled = [];
export const scheduleOnRuntime = (_runtime, fn, ...args) => { scheduled.push(args); };
export const scheduleOnRuntimeWithId = () => {};
export const scheduleOnUI = () => {};
`;
const hooks = `
const stubs = {
  'react-native-worklets': ${JSON.stringify(worklets)},
  '@acme/ui/three': 'export const installWebGPUOnRuntime = () => {};',
  '@acme/ui/gpu': 'export const readGpuDevice = () => null;',
  '@acme/ui/three/internals': 'export const advanceNodeFrame = () => {}; export const stopInternalLoop = () => {}; export const releaseCanvasBuffers = () => 0;',
};
export async function resolve(specifier, context, next) {
  if (specifier in stubs) return { url: 'data:text/javascript,' + encodeURIComponent(stubs[specifier]), shortCircuit: true };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { ...context.importAttributes, type: 'json' } });
  return next(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(hooks)}`);

test('the snapshot carries the time-of-day preset and a pick writes a new frame', async () => {
  const worklets = (await import('react-native-worklets')) as unknown as { scheduled: unknown[][] };
  const { gameWorkletHost } = await import('./worklet-host.ts');
  const { timeOfDayStore } = await import('../world/time-of-day.store.ts');
  const { readPreset, snapshotVersion } = await import('../render-snapshot.ts');

  timeOfDayStore.getState().setPreset('golden');
  const session = gameWorkletHost.start({
    width: 64, height: 64, pixelRatio: 1, reducedMotion: false, context: {} as never, device: null, onEvent: () => {},
  } as never);
  const start = worklets.scheduled.find((args) => (args[0] as { snapshot?: unknown })?.snapshot) as [{ snapshot: { getDirty(): number[] } }];
  assert.ok(start, 'the start args reach the runtime');
  const channel = start[0].snapshot;
  assert.equal(readPreset(channel.getDirty()), 'golden', 'the first snapshot carries the current pick');

  const before = snapshotVersion(channel.getDirty());
  timeOfDayStore.getState().setPreset('midnight');
  assert.equal(readPreset(channel.getDirty()), 'midnight');
  assert.equal(snapshotVersion(channel.getDirty()), before + 1, 'a new version, so a parked loop draws it');

  const after = snapshotVersion(channel.getDirty());
  timeOfDayStore.getState().setPreset('midnight');
  assert.equal(snapshotVersion(channel.getDirty()), after, 'the same pick again writes nothing');

  session.dispose();
  timeOfDayStore.getState().setPreset('golden');
  assert.equal(readPreset(channel.getDirty()), 'midnight', 'a disposed session stops mirroring');
});
