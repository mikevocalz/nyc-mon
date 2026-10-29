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
import type { ThreeSetup } from '@acme/ui/three';
import type { CitySceneParams } from './city-scene.ts';
import { gameScreenActions } from './game-session.ts';
import { preloadVdBlocks } from './world/vd-port/blocks/load.ts';
import { compileForFrames } from './compile-pass.ts';

export interface GameSceneParams extends CitySceneParams {
  onFirstFrame: () => void;
}

/** Where load milestones go. The JS path writes the screen store; the worklet render runtime relays to it. */
export type LoadStageReporter = (stage: 'worldBuilt' | 'firstRender') => void;

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
    const built = setup(context, initial);
    report('worldBuilt');
    let compiled = false;
    const ready = () => {
      compiled = true;
      context.invalidate();
    };
    if (trace) {
      trace('compileAsync started');
      compileForFrames(context.renderer, built.scene, built.camera).then(
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
      compileForFrames(context.renderer, built.scene, built.camera).then(ready, ready);
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
  // The vd port's block packs are read while the scene module loads: the world is built synchronously and needs them there.
  return Promise.all([import('./city-scene.ts'), preloadVdBlocks()]).then(([m]) => {
    gameScreenActions.loadStage('moduleLoaded');
    return withFirstFrameSignal(m.createCityScene);
  });
};
