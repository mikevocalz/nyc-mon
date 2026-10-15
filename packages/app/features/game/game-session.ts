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

export const gameCameraStore = createCityCameraStore();

export interface GameScreenState {
  /** ThreeCanvas reported no backend (null) for the current attempt. */
  canvasFailed: boolean;
  /** The first frame of the current attempt was submitted. */
  firstFrame: boolean;
  /** Bumped by Retry; keys the ThreeCanvas so a failed backend gets a fresh instance. */
  attempt: number;
  movePadOpen: boolean;
  /** Set once the ready announcement has been spoken this session. */
  announcedReady: boolean;
}

export const gameScreenStore = createStore<GameScreenState>(() => ({
  canvasFailed: false,
  firstFrame: false,
  attempt: 0,
  movePadOpen: false,
  announcedReady: false,
}));

export const gameScreenActions = {
  backendChanged(backend: string | null) {
    gameScreenStore.setState({ canvasFailed: backend === null });
  },
  firstFrame() {
    if (!gameScreenStore.getState().firstFrame) gameScreenStore.setState({ firstFrame: true });
  },
  retry() {
    gameScreenStore.setState((s) => ({ canvasFailed: false, firstFrame: false, attempt: s.attempt + 1 }));
  },
  toggleMovePad() {
    gameScreenStore.setState((s) => ({ movePadOpen: !s.movePadOpen }));
  },
  markAnnounced() {
    gameScreenStore.setState({ announcedReady: true });
  },
};
