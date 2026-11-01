import type { Authorize } from './freshToken.ts';
import type { MonVoice } from './monVoice.ts';
import { playMonClip, prepareMonClip, type MonClip, type SpeakAsOptions } from './speech.ts';
import type { VoicePort } from './speechQueue.ts';

/**
 * The speech queue's voice: speech.ts's two halves of `speakAs`.
 * `prepare` fetches one sentence from /api/tts in the Mon's voice (retry once,
 * never another voice; see prepareMonClip). `play` resolves when the clip has
 * ended or been cut off, which is what lets the queue play strictly in order.
 * The voice is read per sentence, so a tool result mid-reply that moves the
 * Mon's stage or mood applies from the next sentence on.
 */
export interface MonSpeechPortDeps {
  readonly voice: () => MonVoice | undefined;
  readonly authorize?: Authorize;
  readonly endpoint?: string;
  readonly fetchFn?: typeof fetch;
  readonly prepare?: typeof prepareMonClip;
  readonly play?: typeof playMonClip;
  /**
   * A sentence will not be in the Mon's own voice: `browser-voice` when the
   * browser reads it (no Mon voice known, or the server has no ElevenLabs),
   * `unavailable` when the Mon's voice failed and the caption carries it.
   */
  readonly onFallback?: (why: 'browser-voice' | 'unavailable') => void;
}

export function monSpeechPort(deps: MonSpeechPortDeps): VoicePort<MonClip> {
  const prepare = deps.prepare ?? prepareMonClip;
  const play = deps.play ?? playMonClip;
  const opts: SpeakAsOptions = {
    ...(deps.authorize ? { authorize: deps.authorize } : {}),
    ...(deps.endpoint ? { endpoint: deps.endpoint } : {}),
    ...(deps.fetchFn ? { fetchFn: deps.fetchFn } : {}),
  };
  return {
    prepare: async (text, signal) => {
      const clip = await prepare(text, deps.voice(), opts, signal);
      if (clip.kind === 'browser') deps.onFallback?.('browser-voice');
      else if (clip.kind === 'silent' && clip.reason === 'unavailable') deps.onFallback?.('unavailable');
      return clip;
    },
    play: (clip, signal) => play(clip, signal),
  };
}
