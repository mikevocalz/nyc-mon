import { describe, expect, it, vi } from 'vitest';
import { createVoiceController, type EarHandlers, type MicSource } from '../src/client/voiceController.ts';
import { INITIAL_VOICE, nextVoice, type VoiceEvent, type VoiceState } from '../src/client/voiceState.ts';

/** A controllable mic, ear and Mon voice around the controller. */
function rig(opts: { micDenied?: boolean; noAsr?: boolean } = {}) {
  let state: VoiceState = INITIAL_VOICE;
  let frame: ((rms: number, at: number) => void) | null = null;
  let ear: EarHandlers | null = null;
  let playingSince: number | null = null;
  const mic: MicSource = { onFrame: (fn) => { frame = fn; return () => { frame = null; }; }, close: vi.fn() };
  const deps = {
    state: () => state,
    dispatch: (e: VoiceEvent) => { state = nextVoice(state, e); },
    openMic: vi.fn(async () => {
      if (opts.micDenied) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
      return mic;
    }),
    openEar: vi.fn((h: EarHandlers) => {
      if (opts.noAsr) return null;
      ear = h;
      return { close: vi.fn(() => { ear = null; }), finish: vi.fn() };
    }),
    stopVoice: vi.fn(),
    abortTurn: vi.fn(),
    submit: vi.fn(),
    playingSince: () => playingSince,
    onBargeIn: vi.fn(),
  };
  const c = createVoiceController(deps);
  /** Feeds level frames every 20 ms. */
  const speak = (from: number, ms: number, rms = 0.2) => { for (let at = from; at < from + ms; at += 20) frame?.(rms, at); };
  return {
    c, deps, mic,
    get state() { return state; },
    get ear() { return ear; },
    set playing(at: number | null) { playingSince = at; },
    speak,
    dispatch: (e: VoiceEvent) => { deps.dispatch(e); c.sync(); },
  };
}

describe('voice controller: push-to-talk and conversation mode', () => {
  it('Talk opens the mic and an ear; an utterance goes to the Mon', async () => {
    const r = rig();
    await r.c.talk();
    expect(r.state.phase).toBe('listening');
    expect(r.deps.openEar).toHaveBeenCalledTimes(1);
    r.ear!.onInterim('how are');
    expect(r.state.heard).toBe('how are');
    r.ear!.onUtterance('how are you', 1234);
    expect(r.state.phase).toBe('thinking');
    expect(r.deps.submit).toHaveBeenCalledWith('how are you', 1234);
  });

  it('closes the mic once a push-to-talk reply is done', async () => {
    const r = rig();
    await r.c.talk();
    r.ear!.onUtterance('hi', 1);
    r.dispatch({ type: 'reply-audio' });
    r.dispatch({ type: 'reply-done' });
    expect(r.state.phase).toBe('off');
    expect(r.mic.close).toHaveBeenCalled();
  });

  it('conversation mode opens a new ear after every reply', async () => {
    const r = rig();
    await r.c.setConversation(true);
    r.ear!.onUtterance('hi', 1);
    r.dispatch({ type: 'reply-done' });
    expect(r.state.phase).toBe('listening');
    expect(r.deps.openEar).toHaveBeenCalledTimes(2);
    expect(r.mic.close).not.toHaveBeenCalled();
  });

  it('says the mic is blocked when getUserMedia is refused', async () => {
    const r = rig({ micDenied: true });
    await r.c.setConversation(true);
    expect(r.state).toMatchObject({ phase: 'off', mic: 'denied' });
    expect(r.deps.openEar).not.toHaveBeenCalled();
  });

  it('says speech recognition is unavailable when no ear can open', async () => {
    const r = rig({ noAsr: true });
    await r.c.talk();
    expect(r.state).toMatchObject({ phase: 'off', asr: 'unavailable' });
  });
});

describe('voice controller: barge-in', () => {
  it('talking over the Mon stops it with a fade, cancels the turn and listens', async () => {
    const r = rig();
    await r.c.setConversation(true);
    r.ear!.onUtterance('tell me a story', 1);
    r.dispatch({ type: 'reply-audio' });
    r.playing = 10_000;
    r.speak(10_400, 200);
    expect(r.deps.stopVoice).toHaveBeenCalledWith(60);
    expect(r.deps.abortTurn).toHaveBeenCalledTimes(1);
    expect(r.state.phase).toBe('interrupted');
    expect(r.ear).not.toBeNull();
    expect(r.deps.onBargeIn).toHaveBeenCalledWith({ source: 'voice', phase: 'speaking', triggerAt: 10_460, onsetAt: 10_400 });
  });

  it('cuts in while the Mon is still thinking too', async () => {
    const r = rig();
    await r.c.setConversation(true);
    r.ear!.onUtterance('hi', 1);
    r.speak(500, 200);
    expect(r.deps.abortTurn).toHaveBeenCalledTimes(1);
    expect(r.state.phase).toBe('interrupted');
  });

  it('does not cut in on the first 250 ms of a clip or on speech while already listening', async () => {
    const r = rig();
    await r.c.setConversation(true);
    r.speak(0, 300);
    expect(r.deps.stopVoice).not.toHaveBeenCalled();
    r.ear!.onUtterance('hi', 1);
    r.dispatch({ type: 'reply-audio' });
    r.playing = 5000;
    r.speak(5000, 240);
    expect(r.deps.stopVoice).not.toHaveBeenCalled();
  });

  it('a tap on Talk while the Mon speaks cuts it off and listens; typing cuts it off without listening', async () => {
    const r = rig();
    await r.c.talk();
    r.ear!.onUtterance('hi', 1);
    r.dispatch({ type: 'reply-audio' });
    await r.c.talk();
    expect(r.deps.stopVoice).toHaveBeenCalledWith(60);
    expect(r.state.phase).toBe('interrupted');
    expect(r.ear).not.toBeNull();
    r.ear!.onUtterance('again', 2);
    r.dispatch({ type: 'reply-audio' });
    r.c.cutIn('type');
    expect(r.deps.stopVoice).toHaveBeenCalledTimes(2);
    expect(r.state.phase).toBe('off');
    expect(r.deps.onBargeIn).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'type', phase: 'speaking' }));
  });
});
