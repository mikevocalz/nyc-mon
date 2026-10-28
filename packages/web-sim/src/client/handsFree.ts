import type { Listening } from './speech.ts';

/**
 * Hands-free conversation, like an Echo's follow-up mode.
 *
 * Talk opens a voice session. The mic listens; ~700 ms after the person stops
 * talking the utterance goes to the Mon without a "Done talking" press. While
 * the Mon replies, the mic is shut (no echo cancellation: it heard the Mon
 * itself); Talk cuts in. When the Mon finishes, the mic re-opens for a follow-up; a follow-up window with no speech (~8 s)
 * ends the session and the display goes back to idle.
 */

export type ConversationMode = 'idle' | 'listening' | 'thinking' | 'speaking';

export type ConversationEvent =
  | { readonly type: 'talk' }
  | { readonly type: 'typed' }
  | { readonly type: 'utterance' }
  | { readonly type: 'silent' }
  | { readonly type: 'reply-audio' }
  | { readonly type: 'reply-done' }
  | { readonly type: 'barge-in' }
  | { readonly type: 'stop' };

export interface ConversationState {
  readonly mode: ConversationMode;
  /** Started with Talk, so the mic re-opens after each reply. */
  readonly voiceSession: boolean;
}

export const IDLE: ConversationState = { mode: 'idle', voiceSession: false };

export function nextConversation(s: ConversationState, e: ConversationEvent): ConversationState {
  switch (e.type) {
    case 'stop':
      return IDLE;
    case 'talk':
      return { mode: 'listening', voiceSession: true };
    case 'typed':
      // A typed message is a one-off: the mic stays shut after the reply.
      return { mode: 'thinking', voiceSession: false };
    case 'utterance':
      return s.mode === 'listening' ? { ...s, mode: 'thinking' } : s;
    case 'silent':
      return s.mode === 'listening' ? IDLE : s;
    case 'reply-audio':
      return s.mode === 'thinking' ? { ...s, mode: 'speaking' } : s;
    case 'reply-done':
      if (s.mode !== 'thinking' && s.mode !== 'speaking') return s;
      return s.voiceSession ? { ...s, mode: 'listening' } : IDLE;
    case 'barge-in':
      return s.mode === 'speaking' || s.mode === 'thinking' ? { ...s, mode: 'listening' } : s;
  }
}

// ---------------------------------------------------------------- ear ---

export type ListenFn = (handlers: {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}) => Listening | null;

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export interface EarOptions {
  readonly listen: ListenFn;
  readonly onInterim: (text: string) => void;
  /** One utterance, delivered once. `endedAt` is when the person stopped talking (performance.now()). */
  readonly onUtterance: (text: string, endedAt: number) => void;
  /** Nothing was said inside the window. */
  readonly onSilent: () => void;
  readonly onError: (message: string) => void;
  /**
   * Barge-in gate while the Mon speaks: speech counts only once this accepts
   * it. Until then nothing is shown and the no-speech window doesn't run.
   */
  readonly accept?: (heard: string) => boolean;
  /** The gate opened: the person is talking over the Mon. */
  readonly onBargeIn?: () => void;
  readonly silenceMs?: number;
  readonly noSpeechMs?: number;
  /** After stop(), how long to wait for the recognizer's final result before using the last interim. */
  readonly finalGraceMs?: number;
  readonly timers?: Timers;
  readonly now?: () => number;
}

export interface Ear {
  /** Stop listening and drop anything heard. Safe to call twice. */
  close(): void;
  /** End the utterance now (the Talk button pressed mid-sentence). */
  finish(): void;
}

/**
 * One listening window over Web Speech: end-of-speech by silence after the
 * last result, a no-speech timeout, and an optional barge-in gate.
 */
export function openEar(opts: EarOptions): Ear | null {
  const timers: Timers = opts.timers ?? {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  const now = opts.now ?? (() => performance.now());
  const silenceMs = opts.silenceMs ?? 700;
  const finalGraceMs = opts.finalGraceMs ?? 1200;
  let gated = opts.accept !== undefined;
  /** What the mic had heard (echo) before the gate opened; dropped from the utterance. */
  let echoPrefix = '';
  let latest = '';
  let lastHeardAt = 0;
  let closed = false;
  let delivered = false;
  let silenceTimer: unknown = null;
  let graceTimer: unknown = null;
  let noSpeechTimer: unknown = null;
  let listening: Listening | null = null;

  const clear = (t: unknown) => {
    if (t !== null) timers.clearTimeout(t);
  };
  const clearAll = () => {
    clear(silenceTimer);
    clear(graceTimer);
    clear(noSpeechTimer);
    silenceTimer = graceTimer = noSpeechTimer = null;
  };
  const strip = (text: string) => {
    const t = text.trim();
    return echoPrefix && t.startsWith(echoPrefix) ? t.slice(echoPrefix.length).trim() : t;
  };
  const deliver = (text: string) => {
    if (closed || delivered) return;
    const said = strip(text);
    if (!said) return;
    delivered = true;
    closed = true;
    clearAll();
    listening?.cancel();
    opts.onUtterance(said, lastHeardAt || now());
  };
  const endUtterance = () => {
    if (closed || delivered) return;
    clear(silenceTimer);
    silenceTimer = null;
    // stop() makes the recognizer finalize what it has; onFinal delivers it.
    listening?.finish();
    graceTimer = timers.setTimeout(() => deliver(latest), finalGraceMs);
  };

  listening = opts.listen({
    onInterim: (text) => {
      if (closed) return;
      const heard = text.trim();
      if (!heard) return;
      if (gated) {
        const fresh = echoPrefix && heard.startsWith(echoPrefix) ? heard.slice(echoPrefix.length) : heard;
        if (!opts.accept!(fresh)) {
          echoPrefix = heard;
          return;
        }
        gated = false;
        opts.onBargeIn?.();
      }
      latest = heard;
      lastHeardAt = now();
      clear(noSpeechTimer);
      noSpeechTimer = null;
      opts.onInterim(strip(heard));
      clear(silenceTimer);
      silenceTimer = timers.setTimeout(endUtterance, silenceMs);
    },
    onFinal: (text) => {
      if (gated) return;
      deliver(text);
    },
    onError: (message) => {
      if (closed) return;
      closed = true;
      clearAll();
      opts.onError(message);
    },
  });
  if (!listening) return null;
  const rec = listening;

  if (!gated && opts.noSpeechMs !== Infinity) {
    noSpeechTimer = timers.setTimeout(() => {
      if (closed || latest) return;
      closed = true;
      clearAll();
      rec.cancel();
      opts.onSilent();
    }, opts.noSpeechMs ?? 8000);
  }

  return {
    close() {
      if (closed) return;
      closed = true;
      clearAll();
      rec.cancel();
    },
    finish() {
      if (closed) return;
      if (!latest) {
        closed = true;
        clearAll();
        rec.cancel();
        opts.onSilent();
        return;
      }
      endUtterance();
    },
  };
}
