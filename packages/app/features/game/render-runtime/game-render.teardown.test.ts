// Teardown of game-render.ts sessions on a recording GPUDevice:
// - a session stopped after its first frame destroys the canvas target's
//   colour and depth buffers (three's dispose leaves them to a GC on the
//   shared device: about 100 MB multisampled at the iPad size; this harness
//   draws without MSAA, so the depth buffer stands in for both);
// - a session stopped while renderer.init() is still pending stops the
//   internal frame loop init starts and disposes the renderer once init lands.
//   It runs first, so no other session's loop is alive while it counts frames.
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
let rafCalls = 0;
g.requestAnimationFrame = (cb: (t: number) => void) => { rafCalls++; return setTimeout(() => cb(performance.now()), 16); };
g.cancelAnimationFrame = (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle);

const { installGpuGlobals, recordingGpuDevice } = await import('./recording-gpu.test-support.ts');
installGpuGlobals();

const synchronizable = <T>(initial: T) => {
  let value = initial;
  return { getDirty: () => value, setBlocking: (next: T) => { value = next; } };
};
const waitFor = async (check: () => boolean, ms: number) => {
  const until = Date.now() + ms;
  while (!check() && Date.now() < until) await new Promise((r) => setTimeout(r, 20));
};

/** A recording device whose textures report destroy(): the canvas target's depth buffer is labelled `depthBuffer`. */
function trackedDevice() {
  const { device, record } = recordingGpuDevice();
  const d = device as { createTexture(desc: { label?: string }): { destroy(): void } };
  const created = { canvasDepth: 0, canvasDepthDestroyed: 0 };
  const createTexture = d.createTexture.bind(d);
  d.createTexture = (desc) => {
    const texture = createTexture(desc);
    if (desc.label === 'depthBuffer') {
      created.canvasDepth++;
      const destroy = texture.destroy.bind(texture);
      texture.destroy = () => { created.canvasDepthDestroyed++; destroy(); };
    }
    return texture;
  };
  return { device, record, created };
}

function args(session: number, device: unknown, events: { kind: string; detail: string }[]) {
  return import('../render-snapshot.ts').then(({ SNAPSHOT_SLOTS, emptySnapshot }) => {
    const snapshot = emptySnapshot();
    snapshot[SNAPSHOT_SLOTS.width] = 256;
    snapshot[SNAPSHOT_SLOTS.height] = 256;
    const canvas = { width: 256, height: 256, clientWidth: 256, clientHeight: 256, style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} };
    const context = {
      canvas, configure() {}, unconfigure() {}, present() {},
      getCurrentTexture: () => ({ width: 256, height: 256, depthOrArrayLayers: 1, format: 'bgra8unorm', createView: () => ({}), destroy() {} }),
    };
    return {
      session,
      context: context as never,
      device: device as never,
      snapshot: synchronizable(snapshot) as never,
      idle: synchronizable(false) as never,
      running: true,
      emit: (kind: string, detail: string) => events.push({ kind, detail }),
    };
  });
}

test('a session stopped before init resolves stops the internal loop once init lands', async () => {
  const { startGameRender, stopGameRender } = await import('./game-render.ts');
  const { device } = trackedDevice();
  const events: { kind: string; detail: string }[] = [];
  startGameRender(await args(12, device, events));
  stopGameRender(12);
  // Let init resolve (slow under a full parallel test run), then measure:
  // a leaked three Animation loop would keep requesting frames.
  await new Promise((r) => setTimeout(r, 4000));
  const before = rafCalls;
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(rafCalls - before, 0, 'no frame loop survives the unmount');
  assert.ok(!events.some((e) => e.kind === 'stage' && e.detail === 'worldBuilt'), 'no world was built for a stopped session');
});

test('stopping a drawn session destroys the canvas target buffers', async () => {
  const { startGameRender, stopGameRender } = await import('./game-render.ts');
  const { device, record, created } = trackedDevice();
  const events: { kind: string; detail: string }[] = [];
  startGameRender(await args(11, device, events));
  await waitFor(() => record.draws > 0 || events.some((e) => e.kind === 'failed'), 30_000);
  assert.ok(record.draws > 0, `no frame drew: ${JSON.stringify(events.filter((e) => e.kind !== 'trace'))}`);
  assert.ok(created.canvasDepth >= 1, 'the frame made the canvas depth buffer');
  stopGameRender(11);
  assert.equal(created.canvasDepthDestroyed, created.canvasDepth, 'the canvas depth buffer is destroyed on stop');
});
