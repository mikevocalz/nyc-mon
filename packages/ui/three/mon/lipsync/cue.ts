import { sampleAmplitude, type AmplitudeTrack } from './amplitude.ts';
import { arkitKey, arkitToRig, mouthToRig, type RigTargets } from './retarget.ts';
import { buildVisemeTimeline, sampleVisemes, type CharacterAlignment, type Viseme, type VisemeKey } from './visemes.ts';

/**
 * The speech cue: what the simulator host sends the Mon view once per
 * utterance over the MCP Apps bridge, as one key of the host context
 * ({@link SPEECH_CONTEXT_KEY}; McpUiHostContext allows extra keys "for forward
 * compatibility"). One message when the audio starts and one when it stops,
 * never a message per frame. On a real Echo, Alexa speaks in its own voice,
 * no host sends this key, and the Mon keeps its idle clip.
 */

/** Audio2Face-3D frames: `frames[k][i]` is `names[i]` (ARKit) at `k / fps` seconds. */
export interface FaceTrack {
  readonly fps: number;
  readonly names: readonly string[];
  readonly frames: readonly (readonly number[])[];
}

/** One utterance's mouth, from the best source the host had. */
export type SpeechTrack =
  | ({ readonly kind: 'face' } & FaceTrack)
  | { readonly kind: 'visemes'; readonly keys: readonly VisemeKey[] }
  | ({ readonly kind: 'amplitude' } & AmplitudeTrack);

export type MonSpeechCue =
  | {
      readonly kind: 'start';
      /** New per utterance; a repeated id is the same utterance. */
      readonly id: string;
      /** How far into the audio the host was when it sent this (audio.currentTime). */
      readonly elapsedMs: number;
      readonly durationMs: number;
      readonly track: SpeechTrack;
      /** What the sentence does, for the body: one upper-body gesture at most (idle/gestures.ts). */
      readonly gesture?: MonGesture;
    }
  | { readonly kind: 'stop'; readonly id: string }
  /** The host's microphone opened (`on`) or closed: the Mon looks and listens. */
  | { readonly kind: 'listen'; readonly id: string; readonly on: boolean };

/** A sentence's gesture class, chosen by the host from the words it speaks. */
export type MonGesture = 'greet' | 'question' | 'self' | 'excited' | 'agree' | 'deny';
export const MON_GESTURES: readonly MonGesture[] = ['greet', 'question', 'self', 'excited', 'agree', 'deny'];

/** The host-context key that carries the latest cue. */
export const SPEECH_CONTEXT_KEY = 'nycMonSpeech';

/** The sources the host may hold for one clip. */
export interface SpeechSources {
  readonly face?: FaceTrack | null;
  readonly alignment?: CharacterAlignment | null;
  readonly amplitude?: AmplitudeTrack | null;
}

/**
 * The fallback chain, best first (MoyoLearn ADR-112's order, with character
 * timing in the middle): Audio2Face frames, then character-timed visemes,
 * then the loudness envelope. Null means no source: the mouth stays closed
 * and the Mon keeps its clip. Never an error.
 */
export function pickSpeechTrack(sources: SpeechSources): SpeechTrack | null {
  const { face, alignment, amplitude } = sources;
  if (face && face.frames.length > 0 && face.names.length > 0 && face.fps > 0) {
    return { kind: 'face', fps: face.fps, names: face.names, frames: face.frames };
  }
  if (alignment) {
    const keys = buildVisemeTimeline(alignment);
    if (keys.some((k) => k.v !== 'rest')) return { kind: 'visemes', keys };
  }
  if (amplitude && amplitude.values.some((v) => v > 0)) return { kind: 'amplitude', fps: amplitude.fps, values: amplitude.values };
  return null;
}

/**
 * Where the audio is now, in ms, for a start cue received at `receivedAtMs`
 * (both on the view's own clock, performance.now). The host stamped the cue
 * with the audio's own position (`audio.currentTime`) when it sent it, so the
 * view needs no clock shared with the host: frame k of a face lands at
 * `k / fps` seconds of audio.
 */
export function utteranceTimeMs(cue: Extract<MonSpeechCue, { kind: 'start' }>, receivedAtMs: number, nowMs: number): number {
  return nowMs - receivedAtMs + cue.elapsedMs;
}

export interface SampleSpeechOptions {
  /** Scales the motion; reduced motion passes about 0.6. Default 1. */
  readonly amplitude?: number;
  /** Per-syllable variation (visemes only). Default true. */
  readonly vary?: boolean;
}

/** The rig's targets at `tMs` into the utterance. */
export function sampleSpeechTrack(track: SpeechTrack, tMs: number, options: SampleSpeechOptions = {}): RigTargets {
  const gain = options.amplitude ?? 1;
  switch (track.kind) {
    case 'visemes':
      return mouthToRig(sampleVisemes(track.keys, tMs, { amplitude: gain, ...(options.vary === undefined ? {} : { vary: options.vary }) }));
    case 'amplitude':
      return mouthToRig(sampleAmplitude(track, tMs, gain));
    case 'face': {
      // Linear between frames: at 30 fps a held frame is a visible stutter.
      const last = track.frames.length - 1;
      const f = Math.min(Math.max((tMs / 1000) * track.fps, 0), last);
      const i = Math.floor(f);
      const a = track.frames[i] ?? [];
      const b = track.frames[Math.min(i + 1, last)] ?? a;
      const frame: Record<string, number> = {};
      track.names.forEach((name, n) => {
        const x = a[n] ?? 0;
        frame[arkitKey(name)] = (x + ((b[n] ?? x) - x) * (f - i)) * gain;
      });
      return arkitToRig(frame);
    }
  }
}

const VISEMES: ReadonlySet<string> = new Set<Viseme>(['rest', 'closed', 'open', 'wide', 'round', 'teeth', 'mid']);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
/** Thirty seconds at 60 fps: longer than any reply /api/tts will speak. */
const MAX_FRAMES = 1800;

function parseTrack(t: unknown): SpeechTrack | null {
  if (!isRecord(t)) return null;
  if (t.kind === 'visemes') {
    if (!Array.isArray(t.keys) || t.keys.length > MAX_FRAMES) return null;
    const keys: VisemeKey[] = [];
    for (const k of t.keys) {
      if (!isRecord(k) || typeof k.v !== 'string' || !VISEMES.has(k.v) || !isNum(k.startMs) || !isNum(k.endMs)) return null;
      keys.push({ v: k.v as Viseme, startMs: k.startMs, endMs: k.endMs });
    }
    return { kind: 'visemes', keys };
  }
  if (t.kind === 'amplitude') {
    if (!isNum(t.fps) || !(t.fps > 0) || !Array.isArray(t.values) || t.values.length > MAX_FRAMES * 2 || !t.values.every(isNum)) return null;
    return { kind: 'amplitude', fps: t.fps, values: t.values as number[] };
  }
  if (t.kind === 'face') {
    if (!isNum(t.fps) || !(t.fps > 0) || !Array.isArray(t.names) || t.names.length > 64 || !t.names.every((n) => typeof n === 'string')) return null;
    if (!Array.isArray(t.frames) || t.frames.length === 0 || t.frames.length > MAX_FRAMES) return null;
    const width = t.names.length;
    for (const f of t.frames) if (!Array.isArray(f) || f.length !== width || !f.every(isNum)) return null;
    return { kind: 'face', fps: t.fps, names: t.names as string[], frames: t.frames as number[][] };
  }
  return null;
}

/** Reads a cue from the host context; anything malformed is null, so a bad message never breaks the view. */
export function parseSpeechCue(value: unknown): MonSpeechCue | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '' || value.id.length > 64) return null;
  if (value.kind === 'stop') return { kind: 'stop', id: value.id };
  if (value.kind === 'listen') return typeof value.on === 'boolean' ? { kind: 'listen', id: value.id, on: value.on } : null;
  if (value.kind !== 'start' || !isNum(value.elapsedMs) || !isNum(value.durationMs) || value.durationMs <= 0) return null;
  const track = parseTrack(value.track);
  if (!track) return null;
  const gesture = (MON_GESTURES as readonly unknown[]).includes(value.gesture) ? (value.gesture as MonGesture) : undefined;
  return { kind: 'start', id: value.id, elapsedMs: Math.max(0, value.elapsedMs), durationMs: value.durationMs, track, ...(gesture ? { gesture } : {}) };
}
