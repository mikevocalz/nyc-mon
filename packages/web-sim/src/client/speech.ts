/**
 * Web Speech: push-to-talk in, speech synthesis out. Both are feature-detected;
 * without them the simulator is text-only and says so on the mic button.
 */

interface RecognitionResultEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return recognitionCtor() !== null;
}

export function canSpeak(): boolean {
  return typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined';
}

export interface Listening {
  /** Stop and deliver what was heard. */
  finish(): void;
  /** Stop and drop it. */
  cancel(): void;
}

export function listen(handlers: {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}): Listening | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = true;
  let heard = '';
  let cancelled = false;
  rec.onresult = (e) => {
    let interim = '';
    heard = '';
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (!r) continue;
      const t = r[0]?.transcript ?? '';
      if (r.isFinal) heard += t;
      else interim += t;
    }
    handlers.onInterim((heard + interim).trim());
  };
  rec.onerror = (e) => {
    if (e.error === 'aborted' || e.error === 'no-speech') return;
    handlers.onError(
      e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone access is blocked. Allow it in the browser, or type instead.'
        : 'Voice input stopped. Hold the mic button to try again, or type instead.',
    );
  };
  rec.onend = () => {
    if (!cancelled && heard.trim()) handlers.onFinal(heard.trim());
  };
  rec.start();
  return {
    finish: () => rec.stop(),
    cancel: () => {
      cancelled = true;
      rec.abort();
    },
  };
}

export function speak(text: string): void {
  if (!canSpeak() || !text.trim()) return;
  globalThis.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 1.02;
  globalThis.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) globalThis.speechSynthesis.cancel();
}
