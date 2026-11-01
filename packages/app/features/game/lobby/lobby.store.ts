import { createStore } from 'zustand/vanilla';
import type { LeaderboardPage, ResumeResult } from '@acme/core';
import type { AngledStartState, TransitionPhase } from '@acme/ui/lobby';

// The Game tab's lobby state (Law 4: no useState for business state).
// Module scope like gameCameraStore: the lobby outlives its screen, so a
// rotation, fold or tab switch mid-start never loses the phase. One owner
// per concern: `resume` is what resolveResume decided, `leaderboard` what
// the source last answered (kept across a refetch so the panel never
// flashes empty), `phase` which surface the Game tab shows.

export type LobbyPhase = 'lobby' | 'transition' | 'game';

export interface LobbyState {
  readonly phase: LobbyPhase;
  /** `null` until the resume hook has run; never a network wait. */
  readonly resume: ResumeResult | null;
  readonly leaderboard: LeaderboardPage | 'loading';
  /** The last page with rows, kept while a refetch is in flight. */
  readonly previousLeaderboard: LeaderboardPage | null;
  readonly startState: AngledStartState;
  readonly transitionPhase: TransitionPhase;
  /** Set when `onStart` rejected; cleared by the next press. */
  readonly startError: string | null;
  /** When the lobby last resolved its resume (epoch ms): the clock the screen reads for the stale age and the scheme. */
  readonly openedAtMs: number;
  readonly setResume: (resume: ResumeResult, now: number) => void;
  /** Marks a refetch. A previous page with rows is kept as `previousLeaderboard`. */
  readonly beginLeaderboardLoad: () => void;
  readonly setLeaderboard: (page: LeaderboardPage) => void;
  /** START pressed: `loading`, cover `enter`, phase `transition`. Ignored unless START is `idle` in the lobby. */
  readonly beginStart: () => boolean;
  readonly setTransitionPhase: (phase: TransitionPhase) => void;
  /** The resumed frame is on screen: phase `game`, cover `done`, START `idle` again for the next lobby visit. */
  readonly finishStart: () => void;
  /** `onStart` rejected: back to the lobby with START `idle` and the strip's generic line. */
  readonly failStart: (reason: string) => void;
  /** Gameplay ended (pill stop or leaving the tab): back to the lobby. */
  readonly returnToLobby: () => void;
}

export function createLobbyStore() {
  return createStore<LobbyState>((set, get) => ({
    phase: 'lobby',
    resume: null,
    leaderboard: 'loading',
    previousLeaderboard: null,
    startState: 'idle',
    transitionPhase: 'done',
    startError: null,
    openedAtMs: 0,
    setResume: (resume, now) => set({ resume, openedAtMs: now }),
    beginLeaderboardLoad: () => {
      const { leaderboard, previousLeaderboard } = get();
      const previous = leaderboard !== 'loading' && leaderboard.rows.length > 0 ? leaderboard : previousLeaderboard;
      set({ leaderboard: 'loading', previousLeaderboard: previous });
    },
    setLeaderboard: (page) => set({ leaderboard: page }),
    beginStart: () => {
      if (get().startState !== 'idle' || get().phase !== 'lobby') return false;
      set({ startState: 'loading', transitionPhase: 'enter', phase: 'transition', startError: null });
      return true;
    },
    setTransitionPhase: (transitionPhase) => set({ transitionPhase }),
    finishStart: () => set({ phase: 'game', transitionPhase: 'done', startState: 'idle' }),
    failStart: (reason) => set({ phase: 'lobby', transitionPhase: 'done', startState: 'idle', startError: reason }),
    returnToLobby: () => set({ phase: 'lobby', transitionPhase: 'done', startState: 'idle' }),
  }));
}

export const lobbyStore = createLobbyStore();
