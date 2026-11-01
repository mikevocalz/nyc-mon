// Which of the Game screen's states shows, from facts the screen already has.
// Pure, so every combination is a node test.
//
// States (PR #29 "stable loading/error states"; product-decisions six states
// plus unsupported GPU):
//   loading      dataset parsed, renderer starting or no frame submitted yet
//   ready        default: a frame has been submitted and the target is over mapped geometry
//   empty        a frame is up but the camera has wandered off the bundled tile
//   data-error   the bundled tile failed parseCityDataset (a build defect, never user error)
//   render-error WebGPU exists but the renderer or scene failed; retry rebuilds the canvas
//   unsupported  no WebGPU on this device; native has no WebGL2 path (ThreeCanvas)
// "success" is the loading -> ready transition: announced once, not a separate screen.
// "offline" renders as ready: the tile is bundled and nothing on this screen
// touches the network. Tile streaming (PR #29 stage 3) must add a real offline
// state; that PR owns the network check (DEFER, see PLAN.md).
import type { GpuSupport } from '@acme/ui/gpu';

export type GameViewState = 'loading' | 'ready' | 'empty' | 'data-error' | 'render-error' | 'unsupported';

export interface GameStatusInput {
  dataset: 'ok' | 'error';
  gpu: GpuSupport;
  /** ThreeCanvas reported null from onBackendChange (no backend, or a failed one). */
  canvasFailed: boolean;
  /** A frame was submitted after the scene's first update. */
  firstFrame: boolean;
  overMappedArea: boolean;
}

export function resolveGameViewState(input: GameStatusInput): GameViewState {
  if (input.dataset === 'error') return 'data-error';
  if (input.gpu === 'unsupported') return 'unsupported';
  if (input.canvasFailed) return 'render-error';
  if (input.gpu === 'pending' || !input.firstFrame) return 'loading';
  return input.overMappedArea ? 'ready' : 'empty';
}

/** Whether the canvas mounts. It stays mounted through empty, so the world never remounts when the player wanders off. */
export function shouldMountCanvas(state: GameViewState): boolean {
  return state === 'loading' || state === 'ready' || state === 'empty';
}
