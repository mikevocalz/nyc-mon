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
   * World load, 0..100, set at real milestones of the current attempt
   * (LOAD_STAGES): never estimated from time. 100 once the first frame lands.
   */
  loadProgress: number;
}

/** Where each load milestone puts the bar. Ordered; progress never moves backwards. */
export const LOAD_STAGES = {
  /** The scene module import has started. */
  requested: 5,
  /** three.js and the scene module are loaded. */
  moduleLoaded: 35,
  /** The city meshes, materials and actors are built. */
  worldBuilt: 75,
  /** Shader pipelines are compiled and a frame using them was drawn. */
  firstRender: 90,
  /** The first frame landed. */
  done: 100,
} as const;

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
  /** Advance the load bar to a milestone; an earlier milestone after a later one is ignored. */
  loadStage(stage: keyof typeof LOAD_STAGES) {
    const value = LOAD_STAGES[stage];
    if (gameScreenStore.getState().loadProgress < value) gameScreenStore.setState({ loadProgress: value });
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
