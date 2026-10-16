import { describe, expect, it } from 'vitest';
import { INITIAL_SESSION_STATE, pillStateOf, type SessionEvent, type SessionState, transitionSession } from '../world/session.ts';
import { T0 } from './harness.ts';

const start: SessionEvent = { type: 'start', sessionId: 'session-1', at: T0 };

function run(events: readonly SessionEvent[], from: SessionState = INITIAL_SESSION_STATE) {
  let state = from;
  const transitions = events.map((event) => {
    const t = transitionSession(state, event);
    state = t.state;
    return t;
  });
  return { state, transitions };
}

describe('play session state machine (§2C, §14 "no new session created by pause/resume")', () => {
  it('start → playing; short press toggles playing ↔ paused with a save on pause only', () => {
    const { transitions } = run([start, { type: 'pillPress', at: T0 + 1 }, { type: 'pillPress', at: T0 + 2 }]);
    expect(transitions.map((t) => t.pill)).toEqual(['playing', 'paused', 'playing']);
    expect(transitions[1]!.effects).toEqual([{ kind: 'request-save', reason: 'pause', sessionId: 'session-1', at: T0 + 1 }]);
    expect(transitions[2]!.effects).toEqual([]);
    expect(transitions.every((t) => t.outcome === 'applied')).toBe(true);
  });

  it('pause and resume never change the session id, however many times', () => {
    const toggles = Array.from({ length: 40 }, (_, i): SessionEvent => ({ type: 'pillPress', at: T0 + i + 1 }));
    const { state } = run([start, ...toggles]);
    expect(state).toEqual({ kind: 'playing', sessionId: 'session-1', startedAt: T0 });
  });

  it('stop needs the hold then the confirm; a plain press never stops', () => {
    const playing = run([start]).state;
    expect(transitionSession(playing, { type: 'confirmStop', at: T0 + 1 }).outcome).toBe('ignored');
    const held = transitionSession(playing, { type: 'stopConfirm', at: T0 + 1 });
    expect(held.pill).toBe('stopConfirm');
    expect(held.effects).toEqual([]);
    expect(transitionSession(held.state, { type: 'pillPress', at: T0 + 2 }).outcome).toBe('ignored');
    const stopped = transitionSession(held.state, { type: 'confirmStop', at: T0 + 3 });
    expect(stopped.state).toEqual({ kind: 'idle' });
    expect(stopped.pill).toBe('start');
    expect(stopped.effects).toEqual([{ kind: 'request-save', reason: 'stop', sessionId: 'session-1', at: T0 + 3 }]);
  });

  it('cancelStop returns to exactly where the player was', () => {
    const playing = run([start]).state;
    const fromPlaying = run([{ type: 'stopConfirm', at: T0 + 1 }, { type: 'cancelStop', at: T0 + 2 }], playing).state;
    expect(fromPlaying).toEqual(playing);
    const paused = run([start, { type: 'pillPress', at: T0 + 1 }]).state;
    const fromPaused = run([{ type: 'stopConfirm', at: T0 + 2 }, { type: 'cancelStop', at: T0 + 3 }], paused).state;
    expect(fromPaused).toEqual(paused);
  });

  it('background pauses from playing and from stop-confirm with a save, and is ignored elsewhere', () => {
    const playing = run([start]).state;
    const bg = transitionSession(playing, { type: 'background', at: T0 + 1 });
    expect(bg.state).toEqual({ kind: 'paused', sessionId: 'session-1', startedAt: T0, pausedAt: T0 + 1, cause: 'background' });
    expect(bg.effects).toEqual([{ kind: 'request-save', reason: 'background', sessionId: 'session-1', at: T0 + 1 }]);
    const held = transitionSession(playing, { type: 'stopConfirm', at: T0 + 2 }).state;
    expect(transitionSession(held, { type: 'background', at: T0 + 3 }).state).toMatchObject({ kind: 'paused', cause: 'background', sessionId: 'session-1' });
    expect(transitionSession(bg.state, { type: 'background', at: T0 + 4 }).outcome).toBe('ignored');
    expect(transitionSession(INITIAL_SESSION_STATE, { type: 'background', at: T0 }).outcome).toBe('ignored');
    // The player resumes with the pill; background never ends the session.
    expect(transitionSession(bg.state, { type: 'pillPress', at: T0 + 5 }).state).toEqual(playing);
  });

  it('start is ignored while a session exists, so a second start can never mint a new id', () => {
    const playing = run([start]).state;
    const again = transitionSession(playing, { type: 'start', sessionId: 'session-2', at: T0 + 1 });
    expect(again.outcome).toBe('ignored');
    expect(again.state).toBe(playing);
    const paused = transitionSession(playing, { type: 'pillPress', at: T0 + 2 }).state;
    expect(transitionSession(paused, { type: 'start', sessionId: 'session-2', at: T0 + 3 }).state).toBe(paused);
  });

  it('an ignored event leaves the pill in sync with the state', () => {
    const states: SessionState[] = [
      INITIAL_SESSION_STATE,
      run([start]).state,
      run([start, { type: 'pillPress', at: T0 + 1 }]).state,
      run([start, { type: 'stopConfirm', at: T0 + 1 }]).state,
    ];
    const events: SessionEvent[] = [start, { type: 'pillPress', at: T0 }, { type: 'stopConfirm', at: T0 }, { type: 'confirmStop', at: T0 }, { type: 'cancelStop', at: T0 }, { type: 'background', at: T0 }];
    for (const state of states) {
      for (const event of events) {
        const t = transitionSession(state, event);
        expect(t.pill).toBe(pillStateOf(t.state));
        if (t.outcome === 'ignored') {
          expect(t.state).toBe(state);
          expect(t.effects).toEqual([]);
        }
      }
    }
  });
});
