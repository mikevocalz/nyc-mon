// The vsync-paced loop of game-render.ts under the same fake worker runtime
// as game-render.start.test.ts: `pacing: 'vsync'` must not self-schedule on
// the runtime's rAF polyfill — nothing draws until the UI-side driver calls
// vsyncTickGameRender for the session.
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

test('vsync pacing: the loop waits for vsyncTickGameRender instead of self-scheduling', async () => {
  const { startGameRender, stopGameRender, vsyncTickGameRender } = await import('./game-render.ts');
  const { SNAPSHOT_SLOTS, emptySnapshot } = await import('../render-snapshot.ts');

  let rafCalls = 0;
  const stacks: string[] = [];
  const baseRaf = g.requestAnimationFrame as (cb: (t: number) => void) => unknown;
  g.requestAnimationFrame = (cb: (t: number) => void) => {
    rafCalls++;
    if (stacks.length < 4) stacks.push(new Error('raf caller').stack ?? '');
    return baseRaf(cb);
  };

  const snapshot = emptySnapshot();
  snapshot[SNAPSHOT_SLOTS.width] = 64;
  snapshot[SNAPSHOT_SLOTS.height] = 64;
  const events: { kind: string; detail: string }[] = [];
  const canvas = { width: 1, height: 1, clientWidth: 64, clientHeight: 64, style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} };
  const device = { features: new Set(['core-features-and-limits']), limits: {}, lost: new Promise(() => {}), queue: {} };
  const context = { canvas, configure() {}, present() {}, getCurrentTexture() { throw new Error('no texture in node'); } };

  startGameRender({
    session: 11,
    context: context as never,
    device: device as never,
    snapshot: synchronizable(snapshot) as never,
    idle: synchronizable(false) as never,
    running: true,
    pacing: 'vsync',
    emit: (kind, detail) => events.push({ kind, detail }),
  });
  await waitFor(() => events.some((e) => e.kind === 'trace' && e.detail === 'scene built'), 15_000);

  // The scene asks for a frame, but in vsync mode schedule() does not touch
  // the runtime rAF. compileAsync's own yieldToMain rAF hops are warm-up, not
  // the loop: wait for compile to settle and rAF to go quiet, then give a poll
  // loop several 16 ms windows to betray itself.
  await waitFor(
    () => events.some((e) => e.kind === 'trace' && e.detail.startsWith('compileAsync ')),
    15_000,
  );
  let quiet = rafCalls;
  let stable = 0;
  for (let i = 0; i < 250 && stable < 3; i++) {
    await new Promise((r) => setTimeout(r, 20));
    stable = rafCalls === quiet ? stable + 1 : 0;
    quiet = rafCalls;
  }
  const rafAfterBuild = rafCalls;
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(rafCalls, rafAfterBuild, `vsync mode must not self-schedule on the rAF polyfill\n${stacks.join('\n---\n')}`);
  assert.ok(!events.some((e) => e.kind === 'error'), `nothing drew before the vsync tick: ${JSON.stringify(events)}`);

  // The driver tick executes the draw: it fails on the fake context exactly
  // like the start test's poll-mode draw, proving the tick ran the loop.
  vsyncTickGameRender(11);
  await waitFor(() => events.some((e) => e.kind === 'error'), 5_000);
  const error = events.find((e) => e.kind === 'error');
  assert.match(error!.detail, /^(draw|frame tick): \w*Error: /);
  stopGameRender(11);
});
