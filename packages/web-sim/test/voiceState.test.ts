import { describe, expect, it } from 'vitest';
import { INITIAL_VOICE, nextVoice, voiceAnnouncement, type VoiceEvent, type VoiceState } from '../src/client/voiceState.ts';

const run = (...events: VoiceEvent[]): VoiceState => events.reduce(nextVoice, INITIAL_VOICE);

describe('companion voice states', () => {
  it('push-to-talk: listens, thinks, speaks, then stops listening', () => {
    expect(run({ type: 'talk' }).phase).toBe('listening');
    expect(run({ type: 'talk' }, { type: 'utterance' }).phase).toBe('thinking');
    expect(run({ type: 'talk' }, { type: 'utterance' }, { type: 'reply-audio' }).phase).toBe('speaking');
    expect(run({ type: 'talk' }, { type: 'utterance' }, { type: 'reply-audio' }, { type: 'reply-done' }).phase).toBe('off');
  });

  it('conversation mode goes back to listening after each reply and after silence', () => {
    const on = run({ type: 'conversation', on: true });
    expect(on).toMatchObject({ phase: 'listening', conversation: true });
    expect(run({ type: 'conversation', on: true }, { type: 'utterance' }, { type: 'reply-done' }).phase).toBe('listening');
    expect(run({ type: 'conversation', on: true }, { type: 'silent' }).phase).toBe('listening');
    expect(run({ type: 'talk' }, { type: 'silent' }).phase).toBe('off');
    expect(run({ type: 'conversation', on: true }, { type: 'conversation', on: false })).toMatchObject({ phase: 'off', conversation: false });
  });

  it('barge-in while the Mon speaks or thinks is interrupted, then listening once words come in', () => {
    const cut = run({ type: 'talk' }, { type: 'utterance' }, { type: 'reply-audio' }, { type: 'barge-in' });
    expect(cut.phase).toBe('interrupted');
    expect(nextVoice(cut, { type: 'interim', text: 'wait' })).toMatchObject({ phase: 'listening', heard: 'wait' });
    expect(run({ type: 'typed' }, { type: 'barge-in' }).phase).toBe('interrupted');
    expect(run({ type: 'barge-in' }).phase).toBe('off');
    expect(run({ type: 'talk' }, { type: 'barge-in' }).phase).toBe('listening');
  });

  it('a typed message while the Mon speaks cuts it off without opening the mic', () => {
    expect(run({ type: 'typed' }, { type: 'reply-audio' }, { type: 'typed' }).phase).toBe('thinking');
    expect(run({ type: 'typed' }, { type: 'reply-audio' }, { type: 'cut' }).phase).toBe('off');
    expect(run({ type: 'conversation', on: true }, { type: 'utterance' }, { type: 'reply-audio' }, { type: 'cut' }).phase).toBe('listening');
  });

  it('a blocked mic or missing speech recognition says so and keeps the mic off', () => {
    const denied = run({ type: 'conversation', on: true }, { type: 'mic-denied' });
    expect(denied).toMatchObject({ phase: 'off', mic: 'denied', conversation: false });
    expect(nextVoice(denied, { type: 'talk' }).phase).toBe('off');
    expect(voiceAnnouncement(denied)).toMatch(/blocked/i);
    const noAsr = run({ type: 'talk' }, { type: 'asr-unavailable' });
    expect(noAsr).toMatchObject({ phase: 'off', asr: 'unavailable' });
    expect(nextVoice(noAsr, { type: 'talk' }).phase).toBe('off');
    expect(voiceAnnouncement(noAsr)).toMatch(/speech recognition/i);
  });

  it('announces each state in its own words', () => {
    const said = new Set([
      voiceAnnouncement(run({ type: 'talk' })),
      voiceAnnouncement(run({ type: 'talk' }, { type: 'utterance' })),
      voiceAnnouncement(run({ type: 'talk' }, { type: 'utterance' }, { type: 'reply-audio' })),
      voiceAnnouncement(run({ type: 'talk' }, { type: 'utterance' }, { type: 'reply-audio' }, { type: 'barge-in' })),
    ]);
    expect(said.size).toBe(4);
    expect(voiceAnnouncement(INITIAL_VOICE)).toBe('');
  });
});
