import type { ResumeFailure, ResumeResult, WorldCamera } from '@acme/core';
import { assertNever } from '@acme/core';
import type { CityCamera } from '../city-scene.ts';
import { INITIAL_CITY_CAMERA } from '../city-camera.ts';

// START → the first visible gameplay frame, as an ordered plan (Master
// Directive v2 §3 "Resume sequence"; §14 fixtures 2, 3, 10). Pure: given a
// ResumeResult it returns the steps in the order the app must run them and
// the camera to set, so the "no visible teleport" rule has a unit test. The
// camera is restored BEFORE the cover reveals; the reveal is always the last
// step. A `new-game` plan sets the initial view and mints no world: the world
// instance is minted by the first save (`world-snapshot.ts` `buildWorldSave`
// with `previous === null`). An `error` plan has no steps: the lobby shows the
// recovery copy instead.
//
// The session starts after the first frame, right before the reveal (the
// directive's order: restore camera, confirm the scene is ready, then
// initialize controls). Until then the session is idle, so nothing under the
// cover accepts gameplay input and a load that never finishes leaves no
// half-started session behind (review findings C1, H1).
//
// Session id (review finding L5): a resume reuses the id stored in the
// eligible save; only a new game mints one. Recorded in ADR 0020.

export type ResumeStep =
  /**
   * Dispatch `start` to the session store. `sessionId` is the eligible save's
   * id on a resume; `null` on a new game, where the screen mints one.
   */
  | { readonly kind: 'start-session'; readonly sessionId: string | null }
  /** `gameCameraStore.setState({ camera })` with the saved camera, bit for bit. */
  | { readonly kind: 'restore-camera'; readonly camera: CityCamera }
  /** Write `transition/phase = hold` while the world builds. */
  | { readonly kind: 'hold' }
  /** Write `transition/phase = reveal`: the frame under the cover is already the resumed one. */
  | { readonly kind: 'reveal' };

export type ResumeSequence =
  | { readonly kind: 'resume'; readonly steps: readonly ResumeStep[]; readonly camera: CityCamera; readonly revision: number }
  | { readonly kind: 'new-game'; readonly steps: readonly ResumeStep[]; readonly camera: null }
  | { readonly kind: 'error'; readonly steps: readonly []; readonly reason: ResumeFailure };

/** The saved camera as the renderer's camera. Same four doubles, no rounding (fixture 3). */
export function cameraFromSave(camera: WorldCamera): CityCamera {
  return { x: camera.x, z: camera.z, yaw: camera.yaw, distance: camera.distance };
}

/**
 * Plans what START runs. The step order is the contract: camera, then hold
 * (which waits for the first frame), then session, then reveal; a test pins it.
 */
export function planResumeSequence(result: ResumeResult): ResumeSequence {
  switch (result.kind) {
    case 'resume': {
      const camera = cameraFromSave(result.camera);
      return {
        kind: 'resume',
        camera,
        revision: result.save.revision,
        steps: [{ kind: 'restore-camera', camera }, { kind: 'hold' }, { kind: 'start-session', sessionId: result.save.sessionId }, { kind: 'reveal' }],
      };
    }
    case 'new-game':
      return {
        kind: 'new-game',
        camera: null,
        steps: [{ kind: 'restore-camera', camera: { ...INITIAL_CITY_CAMERA } }, { kind: 'hold' }, { kind: 'start-session', sessionId: null }, { kind: 'reveal' }],
      };
    case 'error':
      return { kind: 'error', steps: [], reason: result.reason };
    default:
      return assertNever(result);
  }
}

/** The effects a plan runs through. The screen binds these to the real stores; tests record them. */
export interface ResumeSequenceEffects {
  /** Starts the session with `reuseSessionId`, or a freshly minted id when it is `null`. */
  readonly startSession: (reuseSessionId: string | null) => void;
  readonly setCamera: (camera: CityCamera) => void;
  readonly hold: () => void;
  /** Resolves once the world reports its first frame, so the reveal never shows an unbuilt scene. */
  readonly awaitFirstFrame: () => Promise<void>;
  readonly reveal: () => void;
}

/**
 * Runs a plan's steps in order. Awaits the first frame after `hold`; the
 * camera is set before the wait, so the first frame is the resumed one. A
 * rejected wait stops the run before the session starts.
 */
export async function runResumeSequence(plan: ResumeSequence, effects: ResumeSequenceEffects): Promise<void> {
  for (const step of plan.steps) {
    switch (step.kind) {
      case 'start-session':
        effects.startSession(step.sessionId);
        break;
      case 'restore-camera':
        effects.setCamera(step.camera);
        break;
      case 'hold':
        effects.hold();
        await effects.awaitFirstFrame();
        break;
      case 'reveal':
        effects.reveal();
        break;
      default:
        assertNever(step);
    }
  }
}
