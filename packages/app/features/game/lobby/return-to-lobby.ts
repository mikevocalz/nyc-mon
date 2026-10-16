import type { SessionState } from '@acme/core';
import type { LobbyState } from './lobby.store.ts';
import type { WorldSessionState } from '../world-resume/world-session.store.ts';

// Review finding H6: a STOP ends the session, and the Game tab goes back to
// the lobby so the ranking, the resume status and START are reachable again.
// Only a session that ends while the game is on screen does this; a session
// that was never started (idle → idle) or one that ends mid-transition leaves
// the lobby alone.

interface Subscribable<T> {
  getState(): T;
  subscribe(listener: (state: T, previous: T) => void): () => void;
}

/** True when this session change should hand the tab back to the lobby. */
export function shouldReturnToLobby(previous: SessionState, next: SessionState, phase: LobbyState['phase']): boolean {
  return phase === 'game' && previous.kind !== 'idle' && next.kind === 'idle';
}

/**
 * Subscribes the lobby to the session. Returns the unsubscribe; the Game tab
 * holds it for as long as it is mounted.
 */
export function bindReturnToLobby(session: Subscribable<WorldSessionState>, lobby: Subscribable<LobbyState>): () => void {
  return session.subscribe((state, previous) => {
    if (shouldReturnToLobby(previous.session, state.session, lobby.getState().phase)) lobby.getState().returnToLobby();
  });
}
