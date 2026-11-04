// The ThreeCanvas `load` for the Game world. Module-level with a stable
// identity (ThreeCanvas rebuilds the renderer whenever `load` changes), and a
// dynamic import so three.js and the scene stay out of the first chunk.
//
// createCityScene (the Harlem world plus any actors in params) is used as
// is. This wrapper adds the load milestones and a first-frame signal.
//
// The canvas is `paused`: it draws only when something invalidates it. On
// Dawn the first draw of a new scene spends itself compiling pipelines and
// shows nothing, and with no second draw the loader used to lift onto an
// empty frame (measured on the Surface Duo, 2026-10-16). So the scene's
// pipelines compile first (renderer.compileAsync), then one more frame is
// asked for, and only a frame drawn after that signals. A failed compile
// still lets the draw run, so the canvas's own error path decides.
//
// Progress (game-session.ts LOAD_STAGES): the world build reports its
// checkpoints and compileAsync one step per render object it builds, so the
// bar follows the real work and START's 20 s no-progress watchdog
// (lobby/await-world-ready.ts) sees a slow A12X compile moving instead of
// one silent stretch between "built" and "drawn".
import type { ThreeSetup, ThreePreparation, ThreeScene } from '@acme/ui/three';
import type { CitySceneParams } from './city-scene.ts';
import { gameScreenActions, loadProgressAt, type LoadStage } from './game-session.ts';
import { preloadVdBlocks } from './world/vd-port/blocks/load.ts';
import { preloadVdFar } from './world/vd-port/far-tier/load.ts';
import { preloadVdStorefrontPlan } from './world/vd-port/storefronts/load.ts';
import { compileForFrames } from './compile-pass.ts';
import { withCompileProgressEvent } from './compile-progress-event.ts';
export { CompileProgressEvent, withCompileProgressEvent } from './compile-progress-event.ts';

export interface GameSceneParams extends CitySceneParams {
  onFirstFrame: () => void;
}

/** The stages the scene wrapper reports; `requested` and `moduleLoaded` come from whoever loads the module. */
export type SceneLoadStage = Extract<LoadStage, 'worldBuilt' | 'compile' | 'firstRender'>;

/**
 * Where load progress goes: a stage, and how far through it (0..1; the whole stage when omitted). The JS path
 * writes the screen store; the worklet render runtime relays to it.
 */
export type LoadStageReporter = (stage: SceneLoadStage, fraction?: number) => void;

/** Reports `fraction` of `stage` only when it moves the bar a whole percent: the worklet path crosses a bridge per call. */
function throttled(report: LoadStageReporter): (stage: SceneLoadStage, fraction: number) => void {
  let last = '', lastWorldFraction = -1, lastWorldAt = -Infinity;
  return (stage, fraction) => {
    if (!Number.isFinite(fraction)) return;
    const key = `${stage}:${Math.floor(fraction * 100)}`;
    if (stage === 'worldBuilt') {
      if (fraction <= lastWorldFraction) return;
      const now = Date.now();
      // Real sub-percent work must reach the watchdog; keep its UI/store
      // notifications bounded while retaining immediate whole-percent steps.
      if (key === last && now - lastWorldAt < 100) return;
      lastWorldFraction = fraction; lastWorldAt = now;
    } else if (key === last) return;
    last = key;
    report(stage, fraction);
  };
}

/**
 * Breadcrumbs around the pipeline compile, for the worklet render runtime,
 * where a compile failure is otherwise invisible. The JS path passes none.
 */
export type CompileTracer = (event: string) => void;

/** EXPO_PUBLIC_GAME_PERF=1 (inlined at bundle time on both runtimes): the `[NYC-Mon/load]` timing lines. */
export const LOAD_TIMING = process.env.EXPO_PUBLIC_GAME_PERF === '1';

/** Where a `[NYC-Mon/load]` line goes: console.info on the JS thread; the render runtime relays it (game-render.ts). */
export type LoadTimingSink = (line: string) => void;

/** Objects the warm-up stages: anything three draws with a material. */
type Drawable = { layers: { mask: number }; material?: unknown; isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean };

/**
 * Warm-up chunk: reveal objects until this many materials the frames have not drawn yet are in (each one brings its
 * main, MRT and shadow pipelines), or WARM_MAX_OBJECTS objects, whichever comes first.
 */
export const WARM_NEW_MATERIALS = 3;
export const WARM_MAX_OBJECTS = 12;
/** The layer warm-up objects wait on: no camera or shadow camera enables it. */
const WARM_HIDDEN_LAYER = 30;

/**
 * Hides every drawable under `root` (its layer mask moved to WARM_HIDDEN_LAYER, the mask kept) and returns the
 * chunks to reveal, in scene order.
 */
export function planWarmUp(root: { traverse?(fn: (o: unknown) => void): void }): { chunks: (() => void)[]; objects: number } {
  const objects: { o: Drawable; mask: number }[] = [];
  root.traverse?.((x) => {
    const o = x as Drawable;
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
    objects.push({ o, mask: o.layers.mask });
  });
  for (const { o } of objects) o.layers.mask = 1 << WARM_HIDDEN_LAYER;
  const chunks: (() => void)[] = [];
  const seen = new Set<unknown>();
  let chunk: typeof objects = [];
  let fresh = 0;
  const close = () => {
    const these = chunk;
    chunks.push(() => { for (const { o, mask } of these) o.layers.mask = mask; });
    chunk = [];
    fresh = 0;
  };
  for (const entry of objects) {
    chunk.push(entry);
    for (const m of Array.isArray(entry.o.material) ? entry.o.material : [entry.o.material]) {
      if (!seen.has(m)) { seen.add(m); fresh++; }
    }
    if (fresh >= WARM_NEW_MATERIALS || chunk.length >= WARM_MAX_OBJECTS) close();
  }
  if (chunk.length > 0) close();
  return { chunks, objects: objects.length };
}

export function withFirstFrameSignal(setup: ThreeSetup<CitySceneParams>, report?: LoadStageReporter, trace?: CompileTracer, timing?: LoadTimingSink | null): ThreeSetup<GameSceneParams>;
export function withFirstFrameSignal(setup: ThreePreparation<CitySceneParams>, report?: LoadStageReporter, trace?: CompileTracer, timing?: LoadTimingSink | null): ThreePreparation<GameSceneParams>;
export function withFirstFrameSignal(
  setup: ThreePreparation<CitySceneParams>,
  report: LoadStageReporter = gameScreenActions.loadStage,
  trace?: CompileTracer,
  timing: LoadTimingSink | null = LOAD_TIMING ? (line) => console.info(line) : null,
): ThreePreparation<GameSceneParams> {
  return (context, initial) => {
    const t0 = Date.now();
    let tLast = t0;
    const time = (stage: SceneLoadStage, fraction: number | undefined, what: string) => {
      if (!timing) return;
      const now = Date.now();
      timing(`[NYC-Mon/load] ${what} ${now - t0} +${now - tLast} ${loadProgressAt(stage, fraction ?? 1).toFixed(1)}`);
      tLast = now;
    };
    const step = throttled(report);
    // Layered over `initial`, not spread: the worklet path's params are getters (camera, preset) read live.
    let lastBuildPercent = -1, lastBuildFraction = -1;
    const withProgress = Object.create(initial, {
      onBuildProgress: { value: (f: number) => {
        if (context.signal?.aborted || !Number.isFinite(f) || f <= lastBuildFraction) return;
        lastBuildFraction = f;
        step('worldBuilt', f);
        const percent = Math.floor(f * 100);
        if (percent !== lastBuildPercent) {
          lastBuildPercent = percent;
          time('worldBuilt', f, `build ${f}`);
        }
      } },
    }) as typeof initial;
    const result = setup(context, withProgress);
    const finish = (built: ThreeScene<CitySceneParams>): ThreeScene<GameSceneParams> | Promise<ThreeScene<GameSceneParams>> => {
      if (context.signal?.aborted) {
        const error=Object.assign(new Error('Scene preparation aborted'),{name:'AbortError'});
        const drain=built.dispose?.();
        if(drain)return drain.then(()=>{throw error;});
        throw error;
      }
      report('worldBuilt');
      time('worldBuilt', 1, 'worldBuilt');
      let disposed = false;
      let firstFrameTimer: ReturnType<typeof setTimeout> | undefined;
      let compiled = false;
      let compileSettled=false;
      let disposal:void|Promise<void>;
      let compileSteps = 0;
      const restore = withCompileProgressEvent();
      const ready = () => {
        compileSettled=true;
        restore();
        if (disposed || context.signal?.aborted) return;
        compiled = true;
        report('compile');
        time('compile', 1, `compiled ${compileSteps}`);
        context.invalidate();
      };
      const onProgress = (event: { loaded?: number; total?: number }) => {
        if (disposed || context.signal?.aborted) return;
        compileSteps++;
        const total = Number(event?.total);
        const fraction = total > 0 ? Number(event?.loaded) / total : compileSteps / (compileSteps + 8);
        step('compile', fraction);
        time('compile', fraction, `compile ${compileSteps}/${total || '?'}`);
      };
      // compileAsync collects its render list synchronously (the renderer is initialised), then builds one object per
      // yield. compileForFrames runs it in the post pipeline's scene pass (its target and MRT), so the frames reuse those
      // pipelines; the first real frame still has the post chain and the shadow cascades to build, in one synchronous draw
      // with no progress report (the likeliest 20 s stall on the A12X). So once the list is taken, every drawable waits on
      // a hidden layer and the frames after the compile reveal a few materials each (planWarmUp), reporting between them.
      const compile = compileForFrames(context.renderer as never, built.scene, built.camera, onProgress);
      const warm = planWarmUp(built.scene as never);
      if (trace) {
        trace('compileAsync started');
        compile.then(
          () => {
            trace('compileAsync resolved');
            ready();
          },
          (error: unknown) => {
            trace(`compileAsync rejected: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
            ready();
          },
        );
      } else {
        compile.then(ready, ready);
      }
      let next = 0;
      let signalled = false;
      return {
        ...built,
        dispose: () => {
          if (disposed) return disposal;
          disposed = true;
          if (firstFrameTimer !== undefined) clearTimeout(firstFrameTimer);
          const release=()=>{restore();return built.dispose?.();};
          disposal=compileSettled ? release() : compile.catch(()=>{}).then(release);
          return disposal;
        },
        update: (frame, params) => {
          if (disposed || context.signal?.aborted) return;
          built.update?.(frame, params);
          if (signalled || !compiled) return;
          if (next < warm.chunks.length) {
            warm.chunks[next++]!();
            const f = next / warm.chunks.length;
            step('firstRender', f);
            time('firstRender', f, `warm ${next}/${warm.chunks.length}`);
            // The frame this update belongs to draws the chunk; ask for the next one.
            context.invalidate();
            return;
          }
          signalled = true;
          report('firstRender');
          time('firstRender', 1, 'firstRender');
          firstFrameTimer = setTimeout(() => {
            time('firstRender', 1, 'firstFrame');
            params.onFirstFrame();
          }, 0);
        },
      };
    };
    return result instanceof Promise ? result.then(finish) : finish(result);
  };
}

export const loadGameScene = (): Promise<ThreePreparation<GameSceneParams>> => {
  gameScreenActions.loadStage('requested');
  // The vd port's block packs, storefront plan and the far tier's bundled home chunks are read while the scene module
  // loads: the world is built synchronously and needs them there (the rest of the far tier streams through the cell
  // source on demand).
  const mark = (f: number) => <T>(v: T): T => (gameScreenActions.loadStage('moduleLoaded', f), v);
  return Promise.all([
    import('./city-scene.ts').then(mark(0.3)),
    preloadVdBlocks().then(mark(0.5)),
    preloadVdStorefrontPlan().then(mark(0.7)),
    preloadVdFar().then(mark(0.9)),
  ]).then(([m]) => {
    gameScreenActions.loadStage('moduleLoaded');
    return withFirstFrameSignal(m.createCitySceneAsync);
  });
};
