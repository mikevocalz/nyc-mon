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

test('withFirstFrameSignal: build checkpoints, per-object compile steps with no ProgressEvent global, then warm-up frames, then 100', async () => {
  const { withFirstFrameSignal, WARM_NEW_MATERIALS } = await import('./load-game-scene.ts');
  const g = globalThis as { ProgressEvent?: unknown };
  const saved = g.ProgressEvent;
  delete g.ProgressEvent;
  try {
    const reports: string[] = [];
    const lines: string[] = [];
    let finish!: () => void;
    let sawShim = false;
    const renderer = {
      // three r186's loop: the render list is taken synchronously, then one ProgressEvent per built object.
      compileAsync: (_s: unknown, _c: unknown, _t: unknown, onProgress: ((e: { loaded: number; total: number }) => void) | null) => {
        const visible = meshes.filter((m) => m.layers.mask === 1).length;
        assert.equal(visible, meshes.length, 'compileAsync sees every object');
        return new Promise<void>((resolve) => {
          const Event = (globalThis as unknown as { ProgressEvent?: new (t: string, i: object) => { loaded: number; total: number } }).ProgressEvent;
          sawShim = typeof Event === 'function';
          for (let loaded = 1; loaded <= 200; loaded++) onProgress?.(new Event!('progress', { lengthComputable: true, loaded, total: 200 }));
          finish = resolve;
        });
      },
    };
    // 15 meshes, a material each: 5 warm-up chunks of 3 new materials.
    const materials = Array.from({ length: 15 }, (_, i) => ({ id: i }));
    const meshes = materials.map((material) => ({ isMesh: true, material, layers: { mask: 1 } }));
    const scene = { traverse: (fn: (o: unknown) => void) => meshes.forEach(fn) };
    const setup = withFirstFrameSignal(
      (_ctx, initial) => {
        for (const f of [0.1, 0.2, 0.55]) (initial as { onBuildProgress?: (f: number) => void }).onBuildProgress?.(f);
        return { scene: scene as never, camera: {} as never };
      },
      (stage, fraction) => reports.push(fraction === undefined ? stage : `${stage}:${fraction}`),
      undefined,
      (line) => lines.push(line),
    );
    let firstFrames = 0;
    let invalidations = 0;
    const camera = { x: 1, z: 2, yaw: 0, pitch: 0, distance: 3 };
    const params = { dataset: {} as never, get camera() { return camera as never; }, onFirstFrame: () => { firstFrames++; } };
    const built = setup({ renderer, invalidate: () => { invalidations++; } } as never, params);
    assert.ok(meshes.every((m) => m.layers.mask === 1 << 30), 'after the list is taken, every object waits hidden');
    finish();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(sawShim, true, 'three found a ProgressEvent to build');
    assert.equal(g.ProgressEvent, undefined, 'and the global is put back after the compile');
    assert.deepEqual(reports.slice(0, 4), ['worldBuilt:0.1', 'worldBuilt:0.2', 'worldBuilt:0.55', 'worldBuilt']);
    assert.equal(reports.filter((r) => r.startsWith('compile:')).length, 101, 'throttled to whole percents');
    assert.equal(reports.at(-1), 'compile');
    // Each frame's update reveals one chunk and asks for the next frame.
    const chunks = materials.length / WARM_NEW_MATERIALS;
    for (let i = 0; i < chunks; i++) {
      const before = invalidations;
      built.update!({} as never, params);
      assert.equal(invalidations, before + 1);
      assert.equal(meshes.filter((m) => m.layers.mask === 1).length, Math.min(meshes.length, (i + 1) * WARM_NEW_MATERIALS));
    }
    assert.ok(meshes.every((m) => m.layers.mask === 1), 'all revealed, masks restored');
    assert.equal(reports.filter((r) => r.startsWith('firstRender:')).length, chunks);
    built.update!({} as never, params);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(firstFrames, 1);
    assert.equal(reports.at(-1), 'firstRender');
    assert.ok(lines.some((l) => /^\[NYC-Mon\/load\] compile 1\/200 \d+ \+\d+ /.test(l)), lines.slice(0, 6).join(' | '));
    assert.ok(lines.some((l) => l.startsWith('[NYC-Mon/load] warm 1/5 ')));
    assert.ok(lines.at(-1)!.startsWith('[NYC-Mon/load] firstFrame '));
  } finally {
    if (saved === undefined) delete g.ProgressEvent; else g.ProgressEvent = saved;
  }
});

test('GAME_PERF watchdog lines carry the time since the last progress', async () => {
  const { awaitWorldReady } = await import('./lobby/await-world-ready.ts');
  let now = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let next = 1;
  const fake = {
    setTimeout: (fn: () => void, ms: number) => { const id = next++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (id: unknown) => { timers.delete(id as number); },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = end;
  };
  const lines: string[] = [];
  gameScreenActions.resetForMount();
  gameScreenActions.loadStage('worldBuilt');
  const wait = awaitWorldReady(gameScreenStore, 20_000, fake, (l) => lines.push(l), () => now);
  advance(3_000);
  gameScreenActions.loadStage('compile', 0.5);
  advance(2_000);
  gameScreenActions.firstFrame();
  await wait;
  assert.deepEqual(lines, [
    '[NYC-Mon/load] watchdog 1000 sinceProgress=1000 progress=40.0',
    '[NYC-Mon/load] watchdog 2000 sinceProgress=2000 progress=40.0',
    '[NYC-Mon/load] watchdog 3000 sinceProgress=3000 progress=40.0',
    '[NYC-Mon/load] watchdog 4000 sinceProgress=1000 progress=55.0',
    '[NYC-Mon/load] watchdog 5000 sinceProgress=2000 progress=55.0',
  ]);
  assert.equal(timers.size, 0, 'no timer left behind');
});

test('the render runtime carries a stage fraction across as `stage:fraction`', async () => {
  const { formatRuntimeStage, routeRenderEvent } = await import('./render-runtime/runtime-report.ts');
  const got: [string, number | undefined][] = [];
  const sinks = { log: () => {}, error: (m: string) => { throw new Error(m); }, loadStage: (s: string, f?: number) => { got.push([s, f]); } };
  routeRenderEvent('stage', formatRuntimeStage('compile', 0.4567), sinks);
  routeRenderEvent('stage', formatRuntimeStage('worldBuilt'), sinks);
  assert.deepEqual(got, [['compile', 0.457], ['worldBuilt', undefined]]);
});

test('cancelled asynchronous setup disposes its result before compile can start', async () => {
  const { withFirstFrameSignal } = await import('./load-game-scene.ts');
  const abort = new AbortController();
  let disposed = 0, compiled = 0;
  let finish!: (value: unknown) => void;
  const setup = withFirstFrameSignal(() => new Promise<unknown>((resolve) => { finish = resolve; }) as Promise<never>);
  const pending = setup({ signal: abort.signal, renderer: { compileAsync() { compiled++; } }, invalidate() {} } as never, {} as never);
  abort.abort();
  finish({ dispose() { disposed++; } });
  await assert.rejects(Promise.resolve(pending), /abort/i);
  assert.equal(disposed, 1);
  assert.equal(compiled, 0);
});

test('compile ProgressEvent leases survive overlapping scenes and late old callbacks', async () => {
  const { withCompileProgressEvent, CompileProgressEvent } = await import('./load-game-scene.ts');
  const g = globalThis as { ProgressEvent?: unknown };
  const original = Object.getOwnPropertyDescriptor(g, 'ProgressEvent');
  class PriorEvent {}
  class ForeignEvent {}
  try {
    Object.defineProperty(g, 'ProgressEvent', { value: PriorEvent, configurable: true, writable: true });
    const oldDispose = withCompileProgressEvent();
    const newReady = withCompileProgressEvent();
    oldDispose();
    assert.equal(g.ProgressEvent, CompileProgressEvent, 'new scene still owns a lease');
    newReady();
    assert.equal(g.ProgressEvent, PriorEvent, 'last scene restores first original');
    const nextDispose = withCompileProgressEvent();
    oldDispose(); newReady();
    assert.equal(g.ProgressEvent, CompileProgressEvent, 'late callbacks cannot clobber new generation');
    g.ProgressEvent = ForeignEvent;
    nextDispose();
    assert.equal(g.ProgressEvent, ForeignEvent, 'foreign replacement remains owned externally');
    const displaced = withCompileProgressEvent();
    g.ProgressEvent = PriorEvent;
    const replacement = withCompileProgressEvent();
    displaced();
    assert.equal(g.ProgressEvent, CompileProgressEvent, 'displaced generation cannot restore over new lease');
    replacement();
    assert.equal(g.ProgressEvent, PriorEvent);
    delete g.ProgressEvent;
    const noGlobal = withCompileProgressEvent();
    noGlobal(); noGlobal();
    assert.equal(Object.hasOwn(g, 'ProgressEvent'), false);
  } finally {
    if (original) Object.defineProperty(g, 'ProgressEvent', original);
    else delete g.ProgressEvent;
  }
});

test('fine-grained geometry checkpoints emit at most one timing beacon per build percent', async () => {
  const { withFirstFrameSignal } = await import('./load-game-scene.ts');
  const lines: string[] = [];
  const setup = withFirstFrameSignal((_context, params) => {
    for (let i = 0; i <= 10_000; i++) params.onBuildProgress?.(i / 10_000);
    return { scene: { traverse() {} }, camera: {} } as never;
  }, () => {}, undefined, (line) => lines.push(line));
  const built = setup({ renderer: { compileAsync: async () => {} }, invalidate() {} } as never, {} as never);
  assert.ok(lines.filter((line) => /\] build /.test(line)).length <= 101);
  await Promise.resolve();
  built.dispose?.();
});

test('disposing an active initial compile drains it and suppresses late frame/invalidate callbacks',async()=>{
 const {withFirstFrameSignal}=await import('./load-game-scene.ts');
 let finish!:()=>void,disposed=0,invalidated=0,first=0,reports=0;
 let progress!:(event:{loaded:number;total:number})=>void;
 const setup=withFirstFrameSignal(()=>({scene:{traverse() {}} as never,camera:{} as never,dispose(){disposed++;}}),()=>{reports++;});
 const built=setup({renderer:{compileAsync:(_s:unknown,_c:unknown,_t:unknown,callback:typeof progress)=>{progress=callback;return new Promise<void>(resolve=>{finish=resolve;});}},invalidate(){invalidated++;}} as never,{} as never);
 const drain=built.dispose?.();assert.ok(drain instanceof Promise);assert.equal(disposed,0);
 const priorReports=reports;progress({loaded:1,total:1});assert.equal(reports,priorReports);
 built.update?.({} as never,{onFirstFrame(){first++;}} as never);finish();await drain;
 assert.equal(disposed,1);assert.equal(invalidated,0);assert.equal(first,0);
 await built.dispose?.();assert.equal(disposed,1);
});

test('cancelled setup retains its asynchronous scene cleanup barrier before rejecting',async()=>{
 const {withFirstFrameSignal}=await import('./load-game-scene.ts');const abort=new AbortController();
 let finish!:(value:unknown)=>void,release!:()=>void,closed=false,settled=false;
 const cleanup=new Promise<void>(resolve=>{release=resolve;});
 const setup=withFirstFrameSignal(()=>new Promise<never>(resolve=>{finish=resolve as (value:unknown)=>void;}));
 const pending=Promise.resolve(setup({signal:abort.signal,renderer:{compileAsync(){assert.fail('cancelled compile');}},invalidate(){assert.fail('late invalidate');}} as never,{} as never));
 void pending.catch(()=>{settled=true;});abort.abort();finish({dispose(){closed=true;return cleanup;}});
 await Promise.resolve();await Promise.resolve();assert.equal(closed,true);assert.equal(settled,false);
 release();await assert.rejects(pending,{name:'AbortError'});
});

test('real build fractions keep the 20-second watchdog alive even while rounded UI remains at 37%; duplicates do not', async t => {
  const { withFirstFrameSignal } = await import('./load-game-scene.ts');
  const { awaitWorldReady, WorldNotReadyError } = await import('./lobby/await-world-ready.ts');
  let now = 0, id = 0;
  t.mock.method(Date, 'now', () => now);
  const timers = new Map<number, { at: number; fn(): void }>();
  const fake = { setTimeout(fn: () => void, ms: number) { const key = ++id; timers.set(key, { at: now + ms, fn }); return key; },
    clearTimeout(key: unknown) { timers.delete(key as number); } };
  const advance = (ms: number) => { now += ms; for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.fn(); } };
  let emit!: (f: number) => void, finish!: () => void;
  const setup = withFirstFrameSignal((_context, params) => {
    emit = params.onBuildProgress!;
    return new Promise<import('@acme/ui/three').ThreeScene<import('./city-scene.ts').CitySceneParams>>(resolve => {
      finish = () => resolve({ scene: { traverse() {} }, camera: {} } as never);
    });
  }, gameScreenActions.loadStage, undefined, null);
  const prepared = setup({ invalidate() {}, renderer: { compileAsync: () => Promise.resolve() } } as never, {} as never);
  gameScreenActions.resetForMount(); emit(0.9);
  const wait = awaitWorldReady(gameScreenStore, 20_000, fake, null, () => now);
  for (const fraction of [0.9001, 0.9002, 0.9003]) {
    advance(19_000); emit(fraction);
    assert.equal(Math.round(gameScreenStore.getState().loadProgress), 37);
    assert.ok(gameScreenStore.getState().loadProgress > loadProgressAt('worldBuilt', fraction - 0.00005));
  }
  gameScreenActions.firstFrame(); await wait;
  gameScreenActions.resetForMount(); gameScreenActions.loadStage('worldBuilt', 0.9);
  const stalled = awaitWorldReady(gameScreenStore, 20_000, fake, null, () => now);
  advance(19_000); emit(0.9003); emit(0.899); emit(NaN);
  advance(1_001); await assert.rejects(stalled, WorldNotReadyError);
  finish(); const built = await prepared; await built.dispose?.();
});

test('an aborted old scene cannot advance the next attempt with late build work', async () => {
  const { withFirstFrameSignal } = await import('./load-game-scene.ts');
  const controller = new AbortController();
  let emit!: (fraction: number) => void;
  const setup = withFirstFrameSignal((_context, initial) => {
    emit = initial.onBuildProgress!;
    return { scene: { traverse() {} }, camera: {} } as never;
  }, gameScreenActions.loadStage, undefined, null);
  const built = setup({ signal: controller.signal, invalidate() {}, renderer: { compileAsync: () => Promise.resolve() } } as never, {} as never);
  controller.abort(); gameScreenActions.resetForMount();
  emit(0.901); assert.equal(gameScreenStore.getState().loadProgress, 0);
  await built.dispose?.();
});
