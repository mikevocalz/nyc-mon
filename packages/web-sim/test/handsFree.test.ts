import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE, isBargeIn, nextConversation, openEar, type ConversationEvent, type ConversationState, type ListenFn } from '../src/client/handsFree.ts';

function run(events: ConversationEvent['type'][], from: ConversationState = IDLE): ConversationState {
  return events.reduce((s, type) => nextConversation(s, { type } as ConversationEvent), from);
}

describe('conversation state machine', () => {
  it('Talk → listening → thinking → speaking → listening again (follow-up)', () => {
    expect(run(['talk']).mode).toBe('listening');
    expect(run(['talk', 'utterance']).mode).toBe('thinking');
    expect(run(['talk', 'utterance', 'reply-audio']).mode).toBe('speaking');
    expect(run(['talk', 'utterance', 'reply-audio', 'reply-done'])).toEqual({ mode: 'listening', voiceSession: true });
  });

  it('a silent follow-up window ends the session', () => {
    expect(run(['talk', 'utterance', 'reply-audio', 'reply-done', 'silent'])).toEqual(IDLE);
  });

  it('re-listens after a reply that played no audio (read-aloud off)', () => {
    expect(run(['talk', 'utterance', 'reply-done']).mode).toBe('listening');
  });

  it('a typed message never opens the mic after the reply', () => {
    expect(run(['typed', 'reply-audio', 'reply-done'])).toEqual(IDLE);
  });

  it('barge-in while speaking goes straight back to listening', () => {
    expect(run(['talk', 'utterance', 'reply-audio', 'barge-in'])).toEqual({ mode: 'listening', voiceSession: true });
  });

  it('Stop returns to idle from anywhere', () => {
    for (const path of [['talk'], ['talk', 'utterance'], ['talk', 'utterance', 'reply-audio']] as const) {
      expect(run([...path, 'stop'])).toEqual(IDLE);
    }
  });

  it('ignores events that do not fit the current mode', () => {
    expect(run(['silent'])).toEqual(IDLE);
    expect(run(['reply-done'])).toEqual(IDLE);
    expect(run(['talk', 'reply-audio']).mode).toBe('listening');
  });
});

describe('barge-in guard', () => {
  const speaking = 'Your Mon ate a whole slice of pizza today.';
  it('ignores anything inside the holdoff after the clip starts', () => {
    expect(isBargeIn({ heard: 'hey stop that', speaking, msSinceAudioStart: 200 })).toBe(false);
  });
  it('needs at least two words', () => {
    expect(isBargeIn({ heard: 'hey', speaking, msSinceAudioStart: 2000 })).toBe(false);
  });
  it('treats the Mon’s own words coming back through the mic as echo', () => {
    expect(isBargeIn({ heard: 'ate a whole slice of pizza', speaking, msSinceAudioStart: 2000 })).toBe(false);
  });
  it('accepts the person talking over the Mon', () => {
    expect(isBargeIn({ heard: 'wait is it sleeping', speaking, msSinceAudioStart: 2000 })).toBe(true);
  });
});

/** A scripted recognizer: the test drives its callbacks. */
function fakeListen() {
  let h: Parameters<ListenFn>[0] | null = null;
  const calls = { finish: 0, cancel: 0 };
  const listen: ListenFn = (handlers) => {
    h = handlers;
    return { finish: () => void calls.finish++, cancel: () => void calls.cancel++ };
  };
  return { listen, calls, interim: (t: string) => h!.onInterim(t), final: (t: string) => h!.onFinal(t), error: (m: string) => h!.onError(m) };
}

describe('ear', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function ear(extra: Partial<Parameters<typeof openEar>[0]> = {}) {
    const rec = fakeListen();
    const got = { utterances: [] as string[], silent: 0, interim: [] as string[], bargeIns: 0 };
    const e = openEar({
      listen: rec.listen,
      onInterim: (t) => got.interim.push(t),
      onUtterance: (t) => got.utterances.push(t),
      onSilent: () => got.silent++,
      onError: () => {},
      onBargeIn: () => got.bargeIns++,
      ...extra,
    })!;
    return { rec, got, e };
  }

  it('ends the utterance after 700 ms of silence, with no button press', () => {
    const { rec, got } = ear();
    rec.interim('how is');
    vi.advanceTimersByTime(500);
    rec.interim('how is my mon');
    vi.advanceTimersByTime(699);
    expect(rec.calls.finish).toBe(0);
    vi.advanceTimersByTime(1);
    expect(rec.calls.finish).toBe(1);
    rec.final('How is my Mon');
    expect(got.utterances).toEqual(['How is my Mon']);
  });

  it('uses the last interim if the recognizer never sends a final result', () => {
    const { rec, got } = ear();
    rec.interim('feed it');
    vi.advanceTimersByTime(700 + 1200);
    expect(got.utterances).toEqual(['feed it']);
  });

  it('delivers once even if the final result arrives after the fallback', () => {
    const { rec, got } = ear();
    rec.interim('feed it');
    vi.advanceTimersByTime(700 + 1200);
    rec.final('Feed it.');
    expect(got.utterances).toEqual(['feed it']);
  });

  it('a follow-up window with no speech closes after 8 s', () => {
    const { rec, got } = ear();
    vi.advanceTimersByTime(7999);
    expect(got.silent).toBe(0);
    vi.advanceTimersByTime(1);
    expect(got.silent).toBe(1);
    expect(rec.calls.cancel).toBe(1);
  });

  it('close() drops everything and fires nothing later', () => {
    const { rec, got, e } = ear();
    rec.interim('hello there');
    e.close();
    vi.advanceTimersByTime(20_000);
    rec.final('hello there');
    expect(got).toMatchObject({ utterances: [], silent: 0 });
  });

  it('while the Mon speaks, echo is ignored until the gate accepts real speech', () => {
    const { rec, got } = ear({ accept: (heard) => heard.trim().split(/\s+/).length >= 2 && !heard.includes('pizza') });
    rec.interim('pizza');
    rec.interim('pizza today');
    vi.advanceTimersByTime(10_000); // no no-speech timeout while gated
    expect(got).toMatchObject({ interim: [], silent: 0, bargeIns: 0 });
    rec.interim('pizza today wait stop');
    expect(got.bargeIns).toBe(1);
    expect(got.interim).toEqual(['wait stop']);
    vi.advanceTimersByTime(700);
    rec.final('pizza today wait stop');
    expect(got.utterances).toEqual(['wait stop']);
  });
});
