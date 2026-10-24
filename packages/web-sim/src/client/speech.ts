import { voicePitchFactor, webSpeechPitch } from '@acme/content/voices';
import { gestureFor } from '@acme/ui/three/mon/idle';
import { amplitudeEnvelope, pickSpeechTrack, type CharacterAlignment, type FaceTrack, type MonGesture, type SpeechTrack } from '@acme/ui/three/mon/lipsync';
import type { MonVoice } from './monVoice.ts';
import { bearer, noAuthorize, type Authorize } from './freshToken.ts';
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

/** The browser voice for this session: picked once by name, then reused, so Web Speech never alternates voices. */
let browserVoiceName: string | null = null;

function sessionBrowserVoice(): SpeechSynthesisVoice | undefined {
  const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
  if (voices.length === 0) return undefined;
  if (browserVoiceName === null) {
    try {
      browserVoiceName = globalThis.sessionStorage?.getItem('nyc-mon.browserVoice') ?? null;
    } catch {
      browserVoiceName = null;
    }
  }
  let v = browserVoiceName === null ? undefined : voices.find((x) => x.name === browserVoiceName);
  if (!v) {
    v = voices.find((x) => x.lang === 'en-US' && x.default) ?? voices.find((x) => x.lang.startsWith('en')) ?? voices[0];
    browserVoiceName = v?.name ?? null;
    try {
      if (browserVoiceName) globalThis.sessionStorage?.setItem('nyc-mon.browserVoice', browserVoiceName);
    } catch {
      // Storage blocked: the name still holds for this page.
    }
  }
  return v;
}

/** Speaks with Web Speech; resolves when the utterance ends, fails, or is cancelled. */
export function speak(text: string, pitch?: number): Promise<void> {
  if (!canSpeak() || !text.trim()) return Promise.resolve();
  globalThis.speechSynthesis.cancel();
  // The skill writes stage directions as *short huff*; some voices read the asterisks out.
  const u = new SpeechSynthesisUtterance(text.replace(/\*/g, ''));
  u.lang = 'en-US';
  u.rate = 1.02;
  const v = sessionBrowserVoice();
  if (v) u.voice = v;
  if (pitch !== undefined) u.pitch = pitch;
  const ended = new Promise<void>((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
  });
  globalThis.speechSynthesis.speak(u);
  return ended;
}

/** /api/tts's JSON answer: the clip plus whatever timing the server could get for it. */
interface TtsPerformance {
  readonly audio: string;
  readonly audioContentType: string;
  readonly alignment?: CharacterAlignment;
  readonly face?: FaceTrack;
  /** Audio2Face renders after the answer; GET <endpoint>/face/<faceId> collects it. */
  readonly faceId?: string;
}

const FACE_ID = /^[0-9a-f-]{36}$/;

/** The deferred Audio2Face frames for one clip, or null (none configured, too slow, failed). */
async function fetchFace(faceId: string, opts: SpeakAsOptions, signal: AbortSignal): Promise<FaceTrack | null> {
  if (!FACE_ID.test(faceId)) return null;
  try {
    const res = await (opts.authorize ?? noAuthorize)((token) =>
      (opts.fetchFn ?? fetch)(`${opts.endpoint ?? '/api/tts'}/face/${faceId}`, { method: 'GET', headers: bearer(token), signal }),
    );
    if (res.status !== 200) return null;
    const body = (await res.json()) as { face?: FaceTrack };
    return body.face ?? null;
  } catch {
    return null;
  }
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
  /** Calls /api/tts with the person's MCP access token in OAuth mode, refreshed as needed (freshToken.ts). */
  readonly authorize?: Authorize;
  readonly endpoint?: string;
  readonly fetchFn?: typeof fetch;
  /**
   * Play after whatever is already speaking or queued instead of cutting it
   * off (sentence-by-sentence replies). `stopSpeaking()` cancels the queue.
   */
  readonly queue?: boolean;
  /** Wait before the one retry (ms). Default 300. */
  readonly retryDelayMs?: number;
}

/** One sentence of the Mon's voice, fetched and ready to play. */
export type MonClip =
  | {
      readonly kind: 'audio';
      readonly bytes: Uint8Array<ArrayBuffer>;
      readonly contentType: string;
      readonly track: SpeechTrack | null;
      /** Audio2Face frames still rendering; the clip plays on `track` and swaps to these mid-line. */
      readonly face: Promise<FaceTrack | null> | null;
      /** The sentence's upper-body gesture class (idle/gestures.ts), sent on its start cue. */
      readonly gesture?: MonGesture;
    }
  /** The server has no ElevenLabs voice (204): the session's one browser voice reads it. */
  | { readonly kind: 'browser'; readonly text: string; readonly pitch: number | undefined }
  /** Nothing to play: an Egg, an empty line, or the voice failed twice (the caption carries the words). */
  | { readonly kind: 'silent' };

/** The last Mon voice this session used; a reply without a voice of its own speaks in it. */
let sessionVoice: MonVoice | undefined;

/**
 * Sets the Mon voice for the rest of the session, so a reply that arrives
 * before any Mon tool result in this conversation still uses the Mon's voice.
 */
export function setSessionVoice(voice: MonVoice | undefined): void {
  if (voice !== undefined) sessionVoice = voice;
}

class TtsFailure extends Error {}

/**
 * Fetches one sentence. With a voice it never falls back to another voice:
 * a failed request (non-200 other than 204, unreadable body, network) is
 * retried once after a short wait, then the clip is silent and a warning
 * names the status (never the text). 204 means this server has no ElevenLabs
 * at all, and only then does the browser voice read the line.
 */
export async function prepareMonClip(text: string, voice: MonVoice | undefined, opts: SpeakAsOptions, signal: AbortSignal): Promise<MonClip> {
  if (voice !== undefined) setSessionVoice(voice);
  const v = voice ?? sessionVoice;
  if (!text.trim()) return { kind: 'silent' };
  if (v === undefined) return { kind: 'browser', text, pitch: undefined };
  if (voicePitchFactor(v.stage) === null) return { kind: 'silent' };
  if (typeof Audio === 'undefined') return { kind: 'silent' };
  let lastStatus = 'network';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 300));
    if (signal.aborted) return { kind: 'silent' };
    try {
      const res = await (opts.authorize ?? noAuthorize)((token) =>
        (opts.fetchFn ?? fetch)(opts.endpoint ?? '/api/tts', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            // JSON carries the clip with its lip-sync timing; plain audio still works.
            accept: 'application/json, audio/mpeg',
            ...bearer(token),
          },
          body: JSON.stringify({ text: text.slice(0, 400), lineageId: v.lineageId, stage: v.stage, ...(v.mood === undefined ? {} : { mood: v.mood }) }),
          signal,
        }),
      );
      if (res.status === 204) return { kind: 'browser', text, pitch: webSpeechPitch(v.stage) ?? undefined };
      if (res.status !== 200) {
        lastStatus = String(res.status);
        throw new TtsFailure();
      }
      let bytes: Uint8Array<ArrayBuffer>;
      let contentType = 'audio/mpeg';
      let face: FaceTrack | undefined;
      let alignment: CharacterAlignment | undefined;
      let later: Promise<FaceTrack | null> | null = null;
      if ((res.headers.get('content-type') ?? '').startsWith('application/json')) {
        const body: unknown = await res.json();
        if (!isPerformance(body)) {
          lastStatus = 'unreadable body';
          throw new TtsFailure();
        }
        bytes = fromBase64(body.audio);
        contentType = body.audioContentType;
        face = body.face;
        alignment = body.alignment;
        // Start collecting the face now, so it is often ready by the time this clip plays.
        if (!face && body.faceId) later = fetchFace(body.faceId, opts, signal);
      } else {
        bytes = new Uint8Array(await res.arrayBuffer());
      }
      // Best source first: Audio2Face frames, character timing, then the clip's own loudness.
      const amplitude = face || alignment ? null : await envelopeOf(bytes.buffer);
      const gesture = gestureFor(text);
      return { kind: 'audio', bytes, contentType, track: pickSpeechTrack({ face: face ?? null, alignment: alignment ?? null, amplitude }), face: later, ...(gesture ? { gesture } : {}) };
    } catch (err) {
      if (signal.aborted) return { kind: 'silent' };
      if (!(err instanceof TtsFailure)) lastStatus = 'network';
    }
  }
  console.warn(`[web-sim] Mon voice unavailable (${lastStatus}); the caption carries the reply.`);
  return { kind: 'silent' };
}

let utterances = 0;
/** The Mon's voice level: 1, or lower while something louder plays over it (the hatch's white-out). */
let duckLevel = 1;

/** Scales the Mon's voice now and for every clip until called again with 1. Web Speech cannot change mid-line and is left as is. */
export function setSpeechDuck(level: number): void {
  duckLevel = Math.max(0, Math.min(1, level));
  if (current) current.audio.volume = duckLevel;
}

/** The clip playing now, so stopSpeaking can cut it off and send the view its stop cue. */
let current: { readonly audio: HTMLAudioElement; readonly url: string; readonly cueId: string | null; readonly done: () => void } | null = null;

function stopAudio(): void {
  const c = current;
  if (!c) return;
  current = null;
  c.audio.pause();
  URL.revokeObjectURL(c.url);
  if (c.cueId) emitSpeechCue({ kind: 'stop', id: c.cueId });
  c.done();
}

/**
 * Plays one prepared clip and resolves when it ends, is cut off, or fails.
 * The Mon view gets a start cue stamped with the audio's own position once
 * play() resolves, and a stop cue at the end.
 */
export async function playMonClip(clip: MonClip, signal: AbortSignal): Promise<void> {
  if (signal.aborted || clip.kind === 'silent') return;
  if (clip.kind === 'browser') return speak(clip.text, clip.pitch);
  stopAudio();
  const url = URL.createObjectURL(new Blob([clip.bytes], { type: clip.contentType }));
  // The pitch is already in the clip; playback rate stays 1 so tempo is the voice's own.
  const audio = new Audio(url);
  audio.volume = duckLevel;
  const track = clip.track;
  const cueId = track ? `u${++utterances}-${Date.now().toString(36)}` : null;
  await new Promise<void>((resolve) => {
    const entry = { audio, url, cueId, done: resolve };
    current = entry;
    const finish = () => {
      if (current === entry) stopAudio();
    };
    audio.onended = finish;
    audio.onerror = finish;
    signal.addEventListener('abort', finish, { once: true });
    audio.play().then(
      () => {
        if (current !== entry || !track || !cueId) return;
        const seconds = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : trackDurationMs(track) / 1000;
        const elapsed = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const gesture = clip.gesture ? { gesture: clip.gesture } : {};
        emitSpeechCue({ kind: 'start', id: cueId, elapsedMs: elapsed * 1000, durationMs: Math.max(1, seconds * 1000), track, ...gesture });
        // The face arrives mid-line: the same utterance id with the face track,
        // stamped with where the audio is now, so the view switches on the clip's clock.
        void clip.face?.then((frames) => {
          const faceTrack = frames ? pickSpeechTrack({ face: frames, alignment: null, amplitude: null }) : null;
          if (!faceTrack || current !== entry || audio.ended) return;
          const at = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
          emitSpeechCue({ kind: 'start', id: cueId, elapsedMs: at * 1000, durationMs: Math.max(1, seconds * 1000), track: faceTrack, ...gesture });
        });
      },
      () => {
        console.warn('[web-sim] Mon voice could not play (autoplay or decode); the caption carries the reply.');
        finish();
      },
    );
  });
}

/** One AbortController for everything queued; stopSpeaking() replaces it. */
let session = new AbortController();
let tail: Promise<void> = Promise.resolve();

/**
 * Speaks `text` as the current Mon. Simulator only: on a real Echo, Alexa reads
 * replies in its own voice (PLATFORM-DOCS §2.8).
 *
 * With a voice (or the session voice), it fetches the Mon's lineage voice from
 * /api/tts and plays it at rate 1; a failure is retried once and then stays
 * silent, never another voice. Web Speech reads only when the server has no
 * ElevenLabs at all (204), in one browser voice for the whole session. An Egg
 * is silent. `{ queue: true }` appends to what is speaking; otherwise it cuts
 * it off. Resolves when this text has finished (or was cancelled).
 */
export async function speakAs(text: string, voice: MonVoice | undefined, opts: SpeakAsOptions = {}): Promise<void> {
  if (!opts.queue) stopSpeaking();
  const { signal } = session;
  // Fetch now (overlapping the clip ahead), play in order.
  const ready = prepareMonClip(text, voice, opts, signal);
  const previous = tail;
  const mine = previous.then(async () => playMonClip(await ready, signal));
  tail = mine.catch(() => {});
  return mine;
}

/** The only cancel: cuts off the clip playing now and everything queued after it. */
export function stopSpeaking(): void {
  session.abort();
  session = new AbortController();
  tail = Promise.resolve();
  stopAudio();
  if (canSpeak()) globalThis.speechSynthesis.cancel();
}
