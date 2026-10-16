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

export interface GameSceneParams extends CitySceneParams {
  onFirstFrame: () => void;
}

/** Where load milestones go. The JS path writes the screen store; the worklet render runtime relays to it. */
export type LoadStageReporter = (stage: 'worldBuilt' | 'firstRender') => void;

export function withFirstFrameSignal(
  setup: ThreeSetup<CitySceneParams>,
  report: LoadStageReporter = gameScreenActions.loadStage,
): ThreeSetup<GameSceneParams> {
  return (context, initial) => {
    const built = setup(context, initial);
    report('worldBuilt');
    let compiled = false;
    const ready = () => {
      compiled = true;
      context.invalidate();
    };
    context.renderer.compileAsync(built.scene, built.camera).then(ready, ready);
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
