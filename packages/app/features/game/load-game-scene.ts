// The ThreeCanvas `load` for the Game world. Module-level with a stable
// identity (ThreeCanvas rebuilds the renderer whenever `load` changes), and a
// dynamic import so three.js and the scene stay out of the first chunk.
//
// createCityScene (the Harlem world plus any actors in params) is used as
// is. This wrapper only adds a first-frame signal: ThreeCanvas calls
// update() and then renders in the same synchronous draw, so a macrotask
// queued from the first update runs after that render either succeeded or
// flipped the canvas to its failed state.
// That is "frame submitted", NOT "nonblack pixels on glass"; PR #29's device
// gate still needs a capture from physical hardware.
import type { ThreeSetup } from '@acme/ui/three';
import type { CitySceneParams } from './city-scene.ts';

export interface GameSceneParams extends CitySceneParams {
  onFirstFrame: () => void;
}

export function withFirstFrameSignal(setup: ThreeSetup<CitySceneParams>): ThreeSetup<GameSceneParams> {
  return (context, initial) => {
    const built = setup(context, initial);
    let signalled = false;
    return {
      ...built,
      update: (frame, params) => {
        built.update?.(frame, params);
        if (signalled) return;
        signalled = true;
        setTimeout(params.onFirstFrame, 0);
      },
    };
  };
}

export const loadGameScene = (): Promise<ThreeSetup<GameSceneParams>> =>
  import('./city-scene.ts').then((m) => withFirstFrameSignal(m.createCityScene));
