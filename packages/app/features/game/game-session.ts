// Game shell state. Module scope on purpose: the camera and screen status
// outlive the GameScreen component, so leaving the Game tab, rotating,
// folding or unfolding never resets where the player was looking
// (foldable skill section 6: own game state above replaceable presentation).
//
// The camera is session-only. It is not the player's persisted Mon save
// (city-camera.ts says so); persisting it to MMKV is DEFERRED until there is a
// player position worth restoring (PR #29 stage 2, the Caller proxy).
import { createStore } from 'zustand/vanilla';
import { createCityCameraStore } from './city-camera.ts';
import type { GameViewState } from './game-status.ts';

export const gameCameraStore = createCityCameraStore();

export interface GameScreenState {
  /** ThreeCanvas reported no backend (null) for the current attempt. */
  canvasFailed: boolean;
  /** The first frame of the current attempt was submitted. */
  firstFrame: boolean;
  /** Bumped by Retry; keys the ThreeCanvas so a failed backend gets a fresh instance. */
  attempt: number;
  /** Set once the ready announcement has been spoken this session. */
  announcedReady: boolean;
  /**
   * What GameScreen last resolved (`resolveGameViewState`), or `null` before
   * it mounts. The lobby's START waits on it so a world that can never draw
   * fails the start instead of holding the cover forever (review finding C1).
   */
  viewState: GameViewState | null;
  /**
   * World load, 0..100, from the measured work of the current attempt
   * (LOAD_STAGES): never estimated from time. Fractional inside a stage (the
   * world build's checkpoints, one step per compiled pipeline object); the
   * labels round it. 100 once the first frame lands, never before.
   */
  loadProgress: number;
}

/**
 * Where each load stage ends on the bar. Ordered; a stage's fractional reports fill the band from the previous
 * stage's end to its own, and progress never moves backwards. The bands follow where the time goes on the A12X
 * iPad: the import and renderer init are short, the synchronous world build is long, and compiling the scene's
 * pipelines (renderer.compileAsync, one step per render object) is the longest; the first draw after it is short.
 */
export const LOAD_STAGES = {
  /** The scene module import has started. */
  requested: 3,
  /** three.js and the scene module are loaded and the renderer is initialised. */
  moduleLoaded: 10,
  /** The city meshes, materials and actors are built (world/index.ts reports its checkpoints on the way). */
  worldBuilt: 40,
  /** Every pipeline compileAsync found is built (it reports loaded / total objects on the way). */
  compile: 95,
  /** The first frame after the compile is being drawn. */
  firstRender: 97,
  /** The first frame landed: the world is ready. Only firstFrame() sets it. */
  done: 100,
} as const;

export type LoadStage = Exclude<keyof typeof LOAD_STAGES, 'done'>;
const STAGE_ORDER = Object.keys(LOAD_STAGES) as (keyof typeof LOAD_STAGES)[];

/** Bar value for `fraction` (0..1) of the way through `stage`. */
export function loadProgressAt(stage: LoadStage, fraction = 1): number {
  const i = STAGE_ORDER.indexOf(stage);
  const start = i === 0 ? 0 : LOAD_STAGES[STAGE_ORDER[i - 1]!];
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 1;
  return start + (LOAD_STAGES[stage] - start) * f;
}

export const gameScreenStore = createStore<GameScreenState>(() => ({
  canvasFailed: false,
  firstFrame: false,
  attempt: 0,
  announcedReady: false,
  viewState: null,
  loadProgress: 0,
}));

export const gameScreenActions = {
  backendChanged(backend: string | null) {
    gameScreenStore.setState({ canvasFailed: backend === null });
  },
  firstFrame() {
    if (!gameScreenStore.getState().firstFrame) gameScreenStore.setState({ firstFrame: true, loadProgress: LOAD_STAGES.done });
  },
  /**
   * Advance the load bar to `fraction` of `stage` (the whole stage when omitted); anything at or behind the bar is
   * ignored. The bar stops short of 100 until firstFrame().
   */
  loadStage(stage: LoadStage, fraction = 1) {
    const value = loadProgressAt(stage, fraction);
    const state = gameScreenStore.getState();
    if (!state.firstFrame && state.loadProgress < value) gameScreenStore.setState({ loadProgress: value });
  },
  retry() {
    gameScreenStore.setState((s) => ({ canvasFailed: false, firstFrame: false, loadProgress: 0, attempt: s.attempt + 1 }));
  },
  markAnnounced() {
    gameScreenStore.setState({ announcedReady: true });
  },
  /**
   * A new GameScreen is about to mount (START from the lobby): its canvas has
   * drawn nothing yet, so a first frame from the previous mount must not
   * count. Keeps `attempt` and `announcedReady`.
   */
  resetForMount() {
    gameScreenStore.setState({ canvasFailed: false, firstFrame: false, viewState: null, loadProgress: 0 });
  },
  viewStateChanged(viewState: GameViewState | null) {
    if (gameScreenStore.getState().viewState !== viewState) gameScreenStore.setState({ viewState });
  },
};
