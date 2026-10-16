import type { WorldPillState } from '../schemas/world-save.ts';
import { assertNever } from '../sim/assert-never.ts';

// The play session state machine (Master Directive v2 §2C "Interaction
// contract" and §3 "Save lifecycle"). The session owns every transition;
// the pill's Rive state machine reflects `pill` and never decides anything.
//
// - `start` enters `playing` with the session id the caller minted.
// - A short `pillPress` toggles `playing` ↔ `paused`.
// - `stopConfirm` (the hold) enters `stop-confirm`; `confirmStop` ends the
//   session, `cancelStop` returns to whatever the player was doing.
// - `background` pauses; it never ends a session.
// - Pause and resume keep `sessionId`; only `confirmStop` clears it. A new id
//   only ever arrives through `start` from `idle`.
// - Every transition that should reach disk emits a `request-save` effect;
//   the app's save cadence turns it into one durable write.
//
// An event the current state does not accept is `ignored`: the state and
// pill come back unchanged with no effects, so a double tap or a stray
// background event never desyncs the pill from the session.

export type PauseCause = 'pill' | 'background';

export type SessionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'playing'; readonly sessionId: string; readonly startedAt: number }
  | {
      readonly kind: 'paused';
      readonly sessionId: string;
      readonly startedAt: number;
      readonly pausedAt: number;
      readonly cause: PauseCause;
    }
  | {
      readonly kind: 'stop-confirm';
      readonly sessionId: string;
      readonly startedAt: number;
      /** When the hold began; the simulation is paused while the player decides. */
      readonly pausedAt: number;
      /** Where `cancelStop` returns to. */
      readonly resumeTo: 'playing' | 'paused';
    };

export type SessionEvent =
  | { readonly type: 'start'; readonly sessionId: string; readonly at: number }
  | { readonly type: 'pillPress'; readonly at: number }
  | { readonly type: 'stopConfirm'; readonly at: number }
  | { readonly type: 'confirmStop'; readonly at: number }
  | { readonly type: 'cancelStop'; readonly at: number }
  | { readonly type: 'background'; readonly at: number };

export type SaveReason = 'pause' | 'background' | 'stop';

/** The one side effect a transition can ask for. `stop` is the final save of the session. */
export interface SessionEffect {
  readonly kind: 'request-save';
  readonly reason: SaveReason;
  readonly sessionId: string;
  readonly at: number;
}

export interface SessionTransition {
  readonly state: SessionState;
  readonly pill: WorldPillState;
  readonly effects: readonly SessionEffect[];
  readonly outcome: 'applied' | 'ignored';
}

export const INITIAL_SESSION_STATE: SessionState = Object.freeze({ kind: 'idle' }) as SessionState;

/** The pill state the Rive `pill/state` property takes for a session state. */
export function pillStateOf(state: SessionState): WorldPillState {
  switch (state.kind) {
    case 'idle':
      return 'start';
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'stop-confirm':
      return 'stopConfirm';
    default:
      return assertNever(state);
  }
}

const NO_EFFECTS: readonly SessionEffect[] = Object.freeze([]);

function ignored(state: SessionState): SessionTransition {
  return { state, pill: pillStateOf(state), effects: NO_EFFECTS, outcome: 'ignored' };
}

function applied(state: SessionState, effects: readonly SessionEffect[] = NO_EFFECTS): SessionTransition {
  return { state, pill: pillStateOf(state), effects, outcome: 'applied' };
}

function save(reason: SaveReason, sessionId: string, at: number): SessionEffect {
  return { kind: 'request-save', reason, sessionId, at };
}

/** Applies one event. Pure; the caller stores the returned state and runs the effects. */
export function transitionSession(state: SessionState, event: SessionEvent): SessionTransition {
  switch (state.kind) {
    case 'idle':
      switch (event.type) {
        case 'start':
          return applied({ kind: 'playing', sessionId: event.sessionId, startedAt: event.at });
        case 'pillPress':
        case 'stopConfirm':
        case 'confirmStop':
        case 'cancelStop':
        case 'background':
          return ignored(state);
        default:
          return assertNever(event);
      }
    case 'playing':
      switch (event.type) {
        case 'pillPress':
          return applied(
            { kind: 'paused', sessionId: state.sessionId, startedAt: state.startedAt, pausedAt: event.at, cause: 'pill' },
            [save('pause', state.sessionId, event.at)],
          );
        case 'background':
          return applied(
            { kind: 'paused', sessionId: state.sessionId, startedAt: state.startedAt, pausedAt: event.at, cause: 'background' },
            [save('background', state.sessionId, event.at)],
          );
        case 'stopConfirm':
          return applied({ kind: 'stop-confirm', sessionId: state.sessionId, startedAt: state.startedAt, pausedAt: event.at, resumeTo: 'playing' });
        case 'start':
        case 'confirmStop':
        case 'cancelStop':
          return ignored(state);
        default:
          return assertNever(event);
      }
    case 'paused':
      switch (event.type) {
        case 'pillPress':
          return applied({ kind: 'playing', sessionId: state.sessionId, startedAt: state.startedAt });
        case 'stopConfirm':
          return applied({ kind: 'stop-confirm', sessionId: state.sessionId, startedAt: state.startedAt, pausedAt: state.pausedAt, resumeTo: 'paused' });
        case 'start':
        case 'confirmStop':
        case 'cancelStop':
        case 'background':
          return ignored(state);
        default:
          return assertNever(event);
      }
    case 'stop-confirm':
      switch (event.type) {
        case 'confirmStop':
          return applied({ kind: 'idle' }, [save('stop', state.sessionId, event.at)]);
        case 'cancelStop':
          switch (state.resumeTo) {
            case 'playing':
              return applied({ kind: 'playing', sessionId: state.sessionId, startedAt: state.startedAt });
            case 'paused':
              return applied({ kind: 'paused', sessionId: state.sessionId, startedAt: state.startedAt, pausedAt: state.pausedAt, cause: 'pill' });
            default:
              return assertNever(state.resumeTo);
          }
        case 'background':
          return applied(
            { kind: 'paused', sessionId: state.sessionId, startedAt: state.startedAt, pausedAt: state.pausedAt, cause: 'background' },
            [save('background', state.sessionId, event.at)],
          );
        case 'start':
        case 'pillPress':
        case 'stopConfirm':
          return ignored(state);
        default:
          return assertNever(event);
      }
    default:
      return assertNever(state);
  }
}
