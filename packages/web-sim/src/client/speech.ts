import { voicePlaybackRate, webSpeechPitch } from '@acme/content/voices';
import type { MonVoice } from './monVoice.ts';

/**
 * Web Speech: push-to-talk in, speech synthesis out. Both are feature-detected;
 * without them the simulator is text-only and says so on the mic button.
 * `speakAs` adds the Mon's own ElevenLabs voice through /api/tts, falling back
 * to Web Speech.
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

export function speak(text: string, pitch?: number): void {
  if (!canSpeak() || !text.trim()) return;
  globalThis.speechSynthesis.cancel();
  // The skill writes stage directions as *short huff*; some voices read the asterisks out.
  const u = new SpeechSynthesisUtterance(text.replace(/\*/g, ''));
  u.lang = 'en-US';
  u.rate = 1.02;
  if (pitch !== undefined) u.pitch = pitch;
  globalThis.speechSynthesis.speak(u);
}

let playing: { readonly audio: HTMLAudioElement; readonly url: string } | null = null;
let pending: AbortController | null = null;

function stopAudio(): void {
  pending?.abort();
  pending = null;
  if (playing) {
    playing.audio.pause();
    URL.revokeObjectURL(playing.url);
    playing = null;
  }
}

export interface SpeakAsOptions {
  /** The person's MCP access token in OAuth mode; /api/tts checks it like /api/model. */
  readonly getToken?: () => string | undefined;
  readonly endpoint?: string;
  readonly fetchFn?: typeof fetch;
}

/**
 * Speaks `text` as the current Mon. Simulator only: on a real Echo, Alexa reads
 * replies in its own voice (PLATFORM-DOCS §2.8).
 *
 * With a voice, it fetches the Mon's lineage voice from /api/tts and plays it at
 * the stage's playback rate with `preservesPitch = false`, so the same voice
 * sounds younger or older. That also changes tempo; a server-side pitch shift
 * is the upgrade that keeps tempo. On 204 or any error it falls back to Web
 * Speech with `utterance.pitch` from the same stage table. An Egg is silent.
 * Without a voice it is plain `speak`.
 */
export async function speakAs(text: string, voice: MonVoice | undefined, opts: SpeakAsOptions = {}): Promise<void> {
  stopSpeaking();
  if (!text.trim()) return;
  if (voice === undefined) return speak(text);
  const rate = voicePlaybackRate(voice.stage);
  if (rate === null) return;
  const fallback = () => speak(text, webSpeechPitch(voice.stage) ?? undefined);
  if (typeof Audio === 'undefined') return fallback();

  const abort = new AbortController();
  pending = abort;
  try {
    const token = opts.getToken?.();
    const res = await (opts.fetchFn ?? fetch)(opts.endpoint ?? '/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text: text.slice(0, 400), lineageId: voice.lineageId, stage: voice.stage }),
      signal: abort.signal,
    });
    if (abort.signal.aborted) return;
    if (res.status !== 200) return fallback();
    const blob = await res.blob();
    if (abort.signal.aborted) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preservesPitch = false;
    audio.playbackRate = rate;
    audio.onended = () => {
      if (playing?.audio === audio) stopAudio();
    };
    pending = null;
    playing = { audio, url };
    await audio.play();
  } catch {
    if (!abort.signal.aborted) {
      stopAudio();
      fallback();
    }
  }
}

export function stopSpeaking(): void {
  stopAudio();
  if (canSpeak()) globalThis.speechSynthesis.cancel();
}
