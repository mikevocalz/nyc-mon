// The start path of game-render.ts under a fake worker runtime: no `self`
// (node has none, like a worklet runtime), a 16 ms setTimeout rAF (the
// worklets polyfill), scheduleOnRN as a direct call, and a fake GPU device
// that supports init but not buffer creation. Checks that every milestone up
// to the compile is reported, and that a failure later on reaches the JS side
// as an `error` with a stack plus `failed`, instead of vanishing.
import '../classic-flags.test-support.ts';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';

const hooks = `
export async function resolve(specifier, context, next) {
  if (specifier === 'react-native-worklets') {
    return { url: 'data:text/javascript,' + encodeURIComponent('export const scheduleOnRN = (fn, ...args) => fn(...args);'), shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { ...context.importAttributes, type: 'json' } });
  return next(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(hooks)}`);

const g = globalThis as Record<string, unknown>;
g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16);
g.cancelAnimationFrame = (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle);
// What installWebGPU puts on the runtime (react-native-webgpu src/constants).
g.GPUTextureUsage = { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 };
g.GPUBufferUsage = { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 };
g.GPUShaderStage = { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };

const synchronizable = <T>(initial: T) => {
  let value = initial;
  return { getDirty: () => value, setBlocking: (next: T) => { value = next; } };
};

const waitFor = async (check: () => boolean, ms: number) => {
  const until = Date.now() + ms;
  while (!check() && Date.now() < until) await new Promise((r) => setTimeout(r, 20));
};

test('startGameRender reports each stage, then surfaces the first GPU failure with a stack', async () => {
  assert.equal(typeof g.self, 'undefined', 'the harness must start without self, like a worklet runtime');
  const { startGameRender, stopGameRender } = await import('./game-render.ts');
  const { SNAPSHOT_SLOTS, emptySnapshot } = await import('../render-snapshot.ts');

  const snapshot = emptySnapshot();
  snapshot[SNAPSHOT_SLOTS.width] = 64;
  snapshot[SNAPSHOT_SLOTS.height] = 64;
  const events: { kind: string; detail: string }[] = [];
  const canvas = { width: 1, height: 1, clientWidth: 64, clientHeight: 64, style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} };
  const device = { features: new Set(['core-features-and-limits']), limits: {}, lost: new Promise(() => {}), queue: {} };
  const context = { canvas, configure() {}, present() {}, getCurrentTexture() { throw new Error('no texture in node'); } };

  startGameRender({
    session: 7,
    context: context as never,
    device: device as never,
    snapshot: synchronizable(snapshot) as never,
    idle: synchronizable(false) as never,
    running: false,
    emit: (kind, detail) => events.push({ kind, detail }),
  });
  await waitFor(() => events.some((e) => e.kind === 'failed'), 15_000);
  stopGameRender(7);

  const traces = events.filter((e) => e.kind === 'trace').map((e) => e.detail);
  const stages = events.filter((e) => e.kind === 'stage').map((e) => e.detail);
  assert.deepEqual(traces.slice(0, 5), [
    'startGameRender (session 7, device shared)',
    'self aliased to the runtime global',
    'city parsed',
    'three loaded, renderer constructed; init pending',
    'renderer init resolved',
  ]);
  assert.ok(traces.includes('scene built'), traces.join(' | '));
  // EXPO_PUBLIC_WORLD_PHYSICAL is unset here: no shared-device resolution and no probe ran.
  assert.ok(!traces.some((t) => t.startsWith('renderer device:') || t.startsWith('probe ')), traces.join(' | '));
  assert.ok(traces.includes('compileAsync started'), traces.join(' | '));
  assert.deepEqual(stages.slice(0, 2), ['moduleLoaded', 'worldBuilt']);
  assert.ok(events.some((e) => e.kind === 'backend' && e.detail === 'webgpu'));

  const error = events.find((e) => e.kind === 'error');
  assert.ok(error, `no error event: ${JSON.stringify(events)}`);
  assert.match(error.detail, /^(draw|frame tick): \w*Error: /);
  assert.match(error.detail, /\n\s+at /, 'the stack crosses with the message');
  assert.equal(g.self, globalThis);
});
