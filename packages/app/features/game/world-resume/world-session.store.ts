import { createStore } from 'zustand/vanilla';
import {
  INITIAL_SESSION_STATE,
  pillStateOf,
  type SessionEffect,
  type SessionEvent,
  type SessionState,
  transitionSession,
  type WorldPillState,
} from '@acme/core';

// The play session as Zustand state (Law 4: no useState for business
// state). Module scope like gameCameraStore: the session outlives the
// GameScreen component, so leaving the tab, rotating or folding never ends
// it. Every transition goes through core's `transitionSession`; this store
// only holds the result and hands the effects back to the caller, who runs
// them (use-world-save-lifecycle.ts turns `request-save` into a commit).

export interface WorldSessionState {
  readonly session: SessionState;
  /** Derived from `session`; what the pill's Rive `pill/state` property shows. */
  readonly pill: WorldPillState;
  /** Applies one event and returns the effects the caller must run. Ignored events return none. */
  readonly dispatch: (event: SessionEvent) => readonly SessionEffect[];
}

export function createWorldSessionStore(initial: SessionState = INITIAL_SESSION_STATE) {
  return createStore<WorldSessionState>((set, get) => ({
    session: initial,
    pill: pillStateOf(initial),
    dispatch: (event) => {
      const transition = transitionSession(get().session, event);
      if (transition.outcome === 'applied') set({ session: transition.state, pill: transition.pill });
      return transition.effects;
    },
  }));
}

export const worldSessionStore = createWorldSessionStore();
