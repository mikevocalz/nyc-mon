/**
 * The NVIDIA companion's voice conversation (nvidia.tsx), as states the page
 * shows and announces.
 *
 * Push-to-talk (`talk`) opens one listening window. Conversation mode keeps
 * the mic coming back after every reply and every silence, like an Echo in
 * follow-up mode. Talking over the Mon while it thinks or speaks is a
 * barge-in: the page stops it and the state is `interrupted` until the
 * Caller's words start showing up, then `listening`.
 */
export type VoicePhase = 'off' | 'listening' | 'thinking' | 'speaking' | 'interrupted';

export interface VoiceState {
  readonly phase: VoicePhase;
  /** Always listening: the mic re-opens after each reply and each silence. */
  readonly conversation: boolean;
  readonly mic: 'unknown' | 'ready' | 'denied';
  /** Where speech-to-text runs; `unavailable` when neither Riva nor the browser can. */
  readonly asr: 'riva' | 'browser' | 'unavailable';
  /** Interim text of the utterance being heard. */
  readonly heard: string;
}

export type VoiceEvent =
  | { readonly type: 'talk' }
  | { readonly type: 'conversation'; readonly on: boolean }
  | { readonly type: 'mic-ready' }
  | { readonly type: 'interim'; readonly text: string }
  | { readonly type: 'utterance' }
  | { readonly type: 'typed' }
  | { readonly type: 'silent' }
  | { readonly type: 'reply-audio' }
  | { readonly type: 'reply-done' }
  | { readonly type: 'barge-in' }
  | { readonly type: 'cut' }
  | { readonly type: 'stop' }
  | { readonly type: 'mic-denied' }
  | { readonly type: 'asr-unavailable' }
  | { readonly type: 'asr'; readonly kind: 'riva' | 'browser' };

export const INITIAL_VOICE: VoiceState = { phase: 'off', conversation: false, mic: 'unknown', asr: 'browser', heard: '' };

const canListen = (s: VoiceState) => s.mic !== 'denied' && s.asr !== 'unavailable';
const idle = (s: VoiceState): VoiceState => ({ ...s, phase: s.conversation ? 'listening' : 'off', heard: '' });

export function nextVoice(s: VoiceState, e: VoiceEvent): VoiceState {
  switch (e.type) {
    case 'talk':
      return canListen(s) ? { ...s, phase: 'listening', heard: '' } : s;
    case 'conversation':
      if (!e.on) return { ...s, conversation: false, phase: s.phase === 'listening' || s.phase === 'interrupted' ? 'off' : s.phase, heard: '' };
      return canListen(s) ? { ...s, conversation: true, phase: s.phase === 'off' ? 'listening' : s.phase } : s;
    case 'mic-ready':
      return { ...s, mic: 'ready' };
    case 'interim':
      return s.phase === 'listening' || s.phase === 'interrupted' ? { ...s, phase: 'listening', heard: e.text } : s;
    case 'utterance':
    case 'typed':
      return { ...s, phase: 'thinking', heard: '' };
    case 'silent':
      return s.phase === 'listening' || s.phase === 'interrupted' ? idle(s) : s;
    case 'reply-audio':
      return s.phase === 'thinking' ? { ...s, phase: 'speaking' } : s;
    case 'reply-done':
      return s.phase === 'thinking' || s.phase === 'speaking' ? idle(s) : s;
    case 'barge-in':
      return s.phase === 'thinking' || s.phase === 'speaking' ? { ...s, phase: 'interrupted', heard: '' } : s;
    case 'cut':
      return s.phase === 'thinking' || s.phase === 'speaking' ? idle(s) : s;
    case 'stop':
      return { ...s, phase: 'off', conversation: false, heard: '' };
    case 'mic-denied':
      return { ...s, mic: 'denied', phase: 'off', conversation: false, heard: '' };
    case 'asr-unavailable':
      return { ...s, asr: 'unavailable', phase: s.phase === 'listening' || s.phase === 'interrupted' ? 'off' : s.phase, conversation: false, heard: '' };
    case 'asr':
      return { ...s, asr: e.kind };
  }
}

/** What the page's polite live region says for this state ('' says nothing). */
export function voiceAnnouncement(s: VoiceState): string {
  if (s.mic === 'denied') return 'Microphone blocked. Allow it in the browser to talk, or type instead.';
  if (s.asr === 'unavailable') return 'Speech recognition isn’t available in this browser. Type instead.';
  switch (s.phase) {
    case 'off':
      return '';
    case 'listening':
      return s.conversation ? 'Listening. Talk any time, even while your Mon answers.' : 'Listening.';
    case 'thinking':
      return 'Your Mon is thinking.';
    case 'speaking':
      return 'Your Mon is talking. Talk, type or tap Stop to cut in.';
    case 'interrupted':
      return 'Stopped. Go ahead.';
  }
}
