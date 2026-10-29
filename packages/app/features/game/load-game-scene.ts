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
import type { ThreeSetup } from '@acme/ui/three';
import type { CitySceneParams } from './city-scene.ts';
import { gameScreenActions, type LoadStage } from './game-session.ts';

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

/**
 * three r186's compileAsync builds its progress report with `new ProgressEvent(...)`. Hermes has no such global
 * (React Native imports its own only inside XMLHttpRequest), and neither has the render runtime nor node; without
 * one the first report throws and the compile rejects. A minimal stand-in carries what the callback reads.
 */
export function ensureProgressEvent(): void {
  const g = globalThis as { ProgressEvent?: unknown };
  if (typeof g.ProgressEvent === 'function') return;
  g.ProgressEvent = class ProgressEvent {
    readonly type: string;
    readonly lengthComputable: boolean;
    readonly loaded: number;
    readonly total: number;
    constructor(type: string, init: { lengthComputable?: boolean; loaded?: number; total?: number } = {}) {
      this.type = type;
      this.lengthComputable = init.lengthComputable ?? false;
      this.loaded = init.loaded ?? 0;
      this.total = init.total ?? 0;
    }
  };
}

/** Reports `fraction` of `stage` only when it moves the bar a whole percent: the worklet path crosses a bridge per call. */
function throttled(report: LoadStageReporter): (stage: SceneLoadStage, fraction: number) => void {
  let last = '';
  return (stage, fraction) => {
    const key = `${stage}:${Math.floor(fraction * 100)}`;
    if (key === last) return;
    last = key;
    report(stage, fraction);
  };
}

/**
 * Breadcrumbs around the pipeline compile, for the worklet render runtime,
 * where a compile failure is otherwise invisible. The JS path passes none.
 */
export type CompileTracer = (event: string) => void;

export function withFirstFrameSignal(
  setup: ThreeSetup<CitySceneParams>,
  report: LoadStageReporter = gameScreenActions.loadStage,
  trace?: CompileTracer,
): ThreeSetup<GameSceneParams> {
  return (context, initial) => {
    const step = throttled(report);
    // Layered over `initial`, not spread: the worklet path's params are getters (camera, preset) read live.
    const withProgress = Object.create(initial, {
      onBuildProgress: { value: (f: number) => step('worldBuilt', f) },
    }) as typeof initial;
    const built = setup(context, withProgress);
    report('worldBuilt');
    let compiled = false;
    const ready = () => {
      compiled = true;
      report('compile');
      context.invalidate();
    };
    ensureProgressEvent();
    const onProgress = (event: { loaded: number; total: number }) => {
      if (event.total > 0) step('compile', event.loaded / event.total);
    };
    if (trace) {
      trace('compileAsync started');
      context.renderer.compileAsync(built.scene, built.camera, null, onProgress as never).then(
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
      context.renderer.compileAsync(built.scene, built.camera, null, onProgress as never).then(ready, ready);
    }
    let signalled = false;
    return {
      ...built,
      update: (frame, params) => {
        built.update?.(frame, params);
        if (signalled || !compiled) return;
        signalled = true;
        report('firstRender');
        setTimeout(params.onFirstFrame, 0);
      },
    };
  };
}

export const loadGameScene = (): Promise<ThreeSetup<GameSceneParams>> => {
  gameScreenActions.loadStage('requested');
  return import('./city-scene.ts').then((m) => {
    gameScreenActions.loadStage('moduleLoaded');
    return withFirstFrameSignal(m.createCityScene);
  });
};
