// N10 end to end on the worklet start path, flag on: game-render constructs
// WebGPURenderer on the shared device. node has no navigator.gpu, so
// `renderer init resolved` is reached only when a device was passed in.
// The no-device case (mock importDevice throws) is covered in
// shared-device.test.ts: here three would fall back to WebGL2 and throw
// inside its own init executor. Same fake runtime as game-render.start.test.ts.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import { webgpuMock } from './webgpu-mock.test-support.ts';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
delete process.env.EXPO_PUBLIC_WORLD_PROBE;

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
g.GPUTextureUsage = webgpuMock.GPUTextureUsage;
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

const gpuDevice = () => ({ features: new Set(['core-features-and-limits']), limits: {}, lost: new Promise(() => {}), queue: {} });

async function start(session: number, device: GPUDevice | null, deviceSource?: 'shared' | 'own') {
  const { startGameRender, stopGameRender } = await import('./game-render.ts');
  const { SNAPSHOT_SLOTS, emptySnapshot } = await import('../render-snapshot.ts');
  const snapshot = emptySnapshot();
  snapshot[SNAPSHOT_SLOTS.width] = 64;
  snapshot[SNAPSHOT_SLOTS.height] = 64;
  const events: { kind: string; detail: string }[] = [];
  const canvas = { width: 1, height: 1, clientWidth: 64, clientHeight: 64, style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} };
  const context = { canvas, configure() {}, present() {}, getCurrentTexture() { throw new Error('no texture in node'); } };
  startGameRender({
    session,
    context: context as never,
    device,
    deviceSource,
    snapshot: synchronizable(snapshot) as never,
    idle: synchronizable(false) as never,
    running: false,
    emit: (kind, detail) => events.push({ kind, detail }),
  });
  const traces = () => events.filter((e) => e.kind === 'trace').map((e) => e.detail);
  await waitFor(() => traces().includes('renderer init resolved') || events.some((e) => e.kind === 'failed'), 15_000);
  stopGameRender(session);
  return { traces: traces() };
}

test('flag on: the handed gpu-store device goes to WebGPURenderer, labelled with its source', async () => {
  const run = await start(11, gpuDevice() as never, 'shared');
  assert.ok(run.traces.includes('renderer device: shared; handed by the RN runtime (gpu-store root.device, shared)'), run.traces.join(' | '));
  assert.ok(run.traces.includes('renderer init resolved'), run.traces.join(' | '));
});

test('flag on, nothing handed: the runtime imports Skia\'s device and three initialises on it', async () => {
  const imported = gpuDevice();
  g.SkiaApi = { getNativeDevice: () => 42n };
  g.RNWebGPU = { importDevice: (pointer: bigint) => { assert.equal(pointer, 42n); return imported; } };
  try {
    const run = await start(12, null);
    assert.ok(run.traces.some((t) => t.startsWith('renderer device: shared; imported on this runtime')), run.traces.join(' | '));
    assert.ok(run.traces.includes('renderer init resolved'), run.traces.join(' | '));
  } finally {
    delete g.SkiaApi;
    delete g.RNWebGPU;
  }
});
