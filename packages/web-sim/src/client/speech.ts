import { voicePitchFactor, webSpeechPitch } from '@acme/content/voices';
import { amplitudeEnvelope, pickSpeechTrack, type CharacterAlignment, type FaceTrack, type SpeechTrack } from '@acme/ui/three/mon/lipsync';
import type { MonVoice } from './monVoice.ts';
import { emitSpeechCue } from './speechCues.ts';

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

let playing: { readonly audio: HTMLAudioElement; readonly url: string; readonly cueId: string | null } | null = null;
let pending: AbortController | null = null;
let utterances = 0;

function stopAudio(): void {
  pending?.abort();
  pending = null;
  if (playing) {
    playing.audio.pause();
    URL.revokeObjectURL(playing.url);
    if (playing.cueId) emitSpeechCue({ kind: 'stop', id: playing.cueId });
    playing = null;
  }
}

/** /api/tts's JSON answer: the clip plus whatever timing the server could get for it. */
interface TtsPerformance {
  readonly audio: string;
  readonly audioContentType: string;
  readonly alignment?: CharacterAlignment;
  readonly face?: FaceTrack;
}

function isPerformance(v: unknown): v is TtsPerformance {
  return typeof v === 'object' && v !== null && typeof (v as TtsPerformance).audio === 'string' && typeof (v as TtsPerformance).audioContentType === 'string';
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The loudness envelope of the clip itself, for the last lip-sync fallback. Null where WebAudio is missing. */
async function envelopeOf(bytes: ArrayBuffer): Promise<{ fps: number; values: readonly number[] } | null> {
  const Ctx = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Ctx) return null;
  try {
    const buffer = await new Ctx(1, 1, 44_100).decodeAudioData(bytes.slice(0));
    return amplitudeEnvelope(buffer.getChannelData(0), buffer.sampleRate, 60);
  } catch {
    return null;
  }
}

function trackDurationMs(track: SpeechTrack): number {
  switch (track.kind) {
    case 'face': return (track.frames.length / track.fps) * 1000;
    case 'amplitude': return (track.values.length / track.fps) * 1000;
    case 'visemes': return track.keys.at(-1)?.endMs ?? 0;
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
 * With a voice, it fetches the Mon's lineage voice from /api/tts, which bakes
 * the stage's pitch in without changing duration and picks the delivery from
 * the mood, and plays it at rate 1. On 204 or any error it falls back to Web
 * Speech with `utterance.pitch` from the same stage table (Web Speech pitch
 * leaves the rate alone). An Egg is silent. Without a voice it is plain `speak`.
 */
export async function speakAs(text: string, voice: MonVoice | undefined, opts: SpeakAsOptions = {}): Promise<void> {
  stopSpeaking();
  if (!text.trim()) return;
  if (voice === undefined) return speak(text);
  if (voicePitchFactor(voice.stage) === null) return;
  const fallback = () => speak(text, webSpeechPitch(voice.stage) ?? undefined);
  if (typeof Audio === 'undefined') return fallback();

  const abort = new AbortController();
  pending = abort;
  try {
    const token = opts.getToken?.();
    const res = await (opts.fetchFn ?? fetch)(opts.endpoint ?? '/api/tts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // JSON carries the clip with its lip-sync timing; plain audio still works.
        accept: 'application/json, audio/mpeg',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text: text.slice(0, 400),
        lineageId: voice.lineageId,
        stage: voice.stage,
        ...(voice.mood === undefined ? {} : { mood: voice.mood }),
      }),
      signal: abort.signal,
    });
    if (abort.signal.aborted) return;
    if (res.status !== 200) return fallback();
    let bytes: Uint8Array<ArrayBuffer>;
    let contentType = 'audio/mpeg';
    let face: FaceTrack | undefined;
    let alignment: CharacterAlignment | undefined;
    if ((res.headers.get('content-type') ?? '').startsWith('application/json')) {
      const body: unknown = await res.json();
      if (!isPerformance(body)) return fallback();
      bytes = fromBase64(body.audio);
      contentType = body.audioContentType;
      face = body.face;
      alignment = body.alignment;
    } else {
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    if (abort.signal.aborted) return;
    // Best source first: Audio2Face frames, character timing, then the clip's own loudness.
    const amplitude = face || alignment ? null : await envelopeOf(bytes.buffer);
    if (abort.signal.aborted) return;
    const track = pickSpeechTrack({ face: face ?? null, alignment: alignment ?? null, amplitude });
    const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
    // The pitch is already in the clip; playback rate stays 1 so tempo is the voice's own.
    const audio = new Audio(url);
    audio.onended = () => {
      if (playing?.audio === audio) stopAudio();
    };
    pending = null;
    const cueId = track ? `u${++utterances}-${Date.now().toString(36)}` : null;
    playing = { audio, url, cueId };
    await audio.play();
    if (track && cueId && playing?.audio === audio) {
      const seconds = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : trackDurationMs(track) / 1000;
      const elapsed = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      emitSpeechCue({ kind: 'start', id: cueId, elapsedMs: elapsed * 1000, durationMs: Math.max(1, seconds * 1000), track });
    }
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
