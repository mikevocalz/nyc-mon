import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameScreenActions, gameScreenStore, LOAD_STAGES, loadProgressAt } from './game-session.ts';

test('load progress only moves forward and lands on 100 with the first frame', () => {
  gameScreenActions.resetForMount();
  assert.equal(gameScreenStore.getState().loadProgress, 0);
  gameScreenActions.loadStage('moduleLoaded');
  gameScreenActions.loadStage('requested');
  assert.equal(gameScreenStore.getState().loadProgress, LOAD_STAGES.moduleLoaded);
  gameScreenActions.loadStage('worldBuilt');
  gameScreenActions.firstFrame();
  assert.equal(gameScreenStore.getState().loadProgress, 100);
});

test('a new mount and Retry start the bar again from zero', () => {
  gameScreenActions.loadStage('worldBuilt');
  gameScreenActions.retry();
  assert.equal(gameScreenStore.getState().loadProgress, 0);
  gameScreenActions.loadStage('firstRender');
  gameScreenActions.resetForMount();
  assert.equal(gameScreenStore.getState().loadProgress, 0);
});

test('stage bands: fractions fill the band behind each stage, monotonically, and only firstFrame reaches 100', () => {
  gameScreenActions.resetForMount();
  const seen: number[] = [];
  const read = () => seen.push(gameScreenStore.getState().loadProgress);
  gameScreenActions.loadStage('requested'); read();
  gameScreenActions.loadStage('moduleLoaded'); read();
  for (const f of [0.1, 0.2, 0.55, 0.9]) { gameScreenActions.loadStage('worldBuilt', f); read(); }
  gameScreenActions.loadStage('worldBuilt'); read();
  for (let k = 1; k <= 115; k++) { gameScreenActions.loadStage('compile', k / 115); read(); }
  // A late partial report of an earlier stage never pulls the bar back.
  gameScreenActions.loadStage('worldBuilt', 0.5); read();
  gameScreenActions.loadStage('firstRender'); read();
  assert.ok(seen.every((v, i) => i === 0 || v >= seen[i - 1]!), 'never backwards');
  assert.equal(new Set(seen.slice(0, -2)).size, seen.length - 2, 'every real report moves the bar');
  assert.equal(loadProgressAt('worldBuilt', 0.5), (LOAD_STAGES.moduleLoaded + LOAD_STAGES.worldBuilt) / 2);
  assert.equal(gameScreenStore.getState().loadProgress, LOAD_STAGES.firstRender);
  assert.ok(gameScreenStore.getState().loadProgress < 100, 'not 100 before the world is ready');
  gameScreenActions.firstFrame();
  assert.equal(gameScreenStore.getState().loadProgress, 100);
  gameScreenActions.loadStage('compile', 0.5);
  assert.equal(gameScreenStore.getState().loadProgress, 100);
});

test('a slow compile reporting per object keeps START waiting; a silent one still times out', async () => {
  const { awaitWorldReady, WorldNotReadyError } = await import('./lobby/await-world-ready.ts');
  // Fake clock: setTimeout handles fire when `advance` passes their deadline.
  let now = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let next = 1;
  const fake = {
    setTimeout: (fn: () => void, ms: number) => { const id = next++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (id: unknown) => { timers.delete(id as number); },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); }
  };
  gameScreenActions.resetForMount();
  gameScreenActions.loadStage('worldBuilt');
  const wait = awaitWorldReady(gameScreenStore, 20_000, fake);
  // 60 s of compile on a slow GPU, one object every 4 s: never 20 s without progress.
  for (let k = 1; k <= 15; k++) { advance(4_000); gameScreenActions.loadStage('compile', k / 15); }
  gameScreenActions.loadStage('firstRender');
  gameScreenActions.firstFrame();
  await wait;

  gameScreenActions.resetForMount();
  gameScreenActions.loadStage('worldBuilt');
  const stalled = awaitWorldReady(gameScreenStore, 20_000, fake);
  advance(19_000); gameScreenActions.loadStage('compile', 0.1);
  advance(20_001);
  await assert.rejects(stalled, WorldNotReadyError);
});

test('withFirstFrameSignal reports world-build checkpoints and per-object compile progress, with no ProgressEvent global', async () => {
  const { ensureProgressEvent, withFirstFrameSignal } = await import('./load-game-scene.ts');
  const g = globalThis as { ProgressEvent?: unknown };
  const saved = g.ProgressEvent;
  delete g.ProgressEvent;
  try {
    const reports: string[] = [];
    let finish!: () => void;
    const renderer = {
      // three r186's loop: one ProgressEvent per built render object, then resolve.
      compileAsync: (_s: unknown, _c: unknown, _t: unknown, onProgress: ((e: { loaded: number; total: number }) => void) | null) =>
        new Promise<void>((resolve) => {
          const Event = (globalThis as unknown as { ProgressEvent: new (t: string, i: object) => { loaded: number; total: number } }).ProgressEvent;
          for (let loaded = 1; loaded <= 200; loaded++) onProgress?.(new Event('progress', { lengthComputable: true, loaded, total: 200 }));
          finish = resolve;
        }),
    };
    const setup = withFirstFrameSignal(
      (_ctx, initial) => {
        for (const f of [0.1, 0.2, 0.55]) (initial as { onBuildProgress?: (f: number) => void }).onBuildProgress?.(f);
        return { scene: {} as never, camera: {} as never };
      },
      (stage, fraction) => reports.push(fraction === undefined ? stage : `${stage}:${fraction}`),
    );
    const camera = { x: 1, z: 2, yaw: 0, pitch: 0, distance: 3 };
    const params = { dataset: {} as never, get camera() { return camera as never; }, onFirstFrame: () => {} };
    setup({ renderer, invalidate: () => {} } as never, params);
    finish();
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(reports.slice(0, 4), ['worldBuilt:0.1', 'worldBuilt:0.2', 'worldBuilt:0.55', 'worldBuilt']);
    const compile = reports.filter((r) => r.startsWith('compile:'));
    // Throttled to whole percents: 200 objects report once per percent (0 through 100), not 200 times.
    assert.equal(compile.length, 101);
    assert.equal(reports.at(-1), 'compile');
    assert.equal(typeof g.ProgressEvent, 'function', 'the shim stays for three to use');
    ensureProgressEvent();
  } finally {
    if (saved === undefined) delete g.ProgressEvent; else g.ProgressEvent = saved;
  }
});

test('the render runtime carries a stage fraction across as `stage:fraction`', async () => {
  const { formatRuntimeStage, routeRenderEvent } = await import('./render-runtime/runtime-report.ts');
  const got: [string, number | undefined][] = [];
  const sinks = { log: () => {}, error: (m: string) => { throw new Error(m); }, loadStage: (s: string, f?: number) => { got.push([s, f]); } };
  routeRenderEvent('stage', formatRuntimeStage('compile', 0.4567), sinks);
  routeRenderEvent('stage', formatRuntimeStage('worldBuilt'), sinks);
  assert.deepEqual(got, [['compile', 0.457], ['worldBuilt', undefined]]);
});
