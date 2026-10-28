import { LIFECYCLE_STAGES, type LifecycleStage, MON_MOODS, type MonMood } from '@acme/core';
import { captionText, spokenText } from './captions.ts';
import {
  expressiveVoiceSettings,
  type ExpressiveVoiceSettings,
  pronounceForVoice,
  resolveVoice,
  stageDirectionsToTags,
  voiceDelivery,
  voicePitchFactor,
  webSpeechPitch,
} from './voices.ts';

export { captionText, dropUnmatchedQuotes, spokenText, unwrapQuotes } from './captions.ts';

/**
 * The Mon's one voice, for every surface that plays it.
 *
 * Source of truth: `voices.ts` (lineage -> ElevenLabs voice, stage pitch, mood
 * delivery, lexicon) and `captions.ts` (what the screen shows). This file joins
 * them into one plan per line, `planMonUtterance`, so the server that calls
 * ElevenLabs, the browser that plays the clip, the Web Speech fallback and any
 * native player all read the same voice id, settings, pitch and caption.
 *
 * The MCP server (the Alexa+ path) reports `mon.voice` through `monVoiceRef`.
 * Alexa itself reads replies in its own voice (docs/alexa/PLATFORM-DOCS.md
 * §2.8); `mon.voice` is for clients that voice the Mon themselves.
 *
 * Surfaces never call a TTS API directly: they take a plan from here and hand
 * it to a `MonVoicePort` (test/voice-boundary.test.ts enforces it).
 */

/** Which voice a Mon speaks with right now, as the MCP tools report it in `mon.voice` (plus the result's mood). */
export interface MonVoiceRef {
  readonly lineageId: string;
  readonly stage: LifecycleStage;
  /** Sets how the line is delivered; from the same tool result's `mood`. */
  readonly mood?: MonMood;
}

/** `mon.voice` for a Mon record: null for a Mon hatched before voice lineages. */
export function monVoiceRef(mon: { readonly voiceLineageId: string | null; readonly stage: LifecycleStage }): { lineageId: string; stage: LifecycleStage } | null {
  return mon.voiceLineageId === null ? null : { lineageId: mon.voiceLineageId, stage: mon.stage };
}

function isStage(value: unknown): value is LifecycleStage {
  return (LIFECYCLE_STAGES as readonly unknown[]).includes(value);
}

function isMood(value: unknown): value is MonMood {
  return (MON_MOODS as readonly unknown[]).includes(value);
}

/**
 * Reads `mon.voice` from untrusted JSON (a tool result, storage). Undefined
 * unless it has a string lineage and a known stage; an unknown mood is dropped.
 */
export function readMonVoiceRef(voice: unknown, mood?: unknown): MonVoiceRef | undefined {
  if (typeof voice !== 'object' || voice === null) return undefined;
  const { lineageId, stage } = voice as { lineageId?: unknown; stage?: unknown };
  if (typeof lineageId !== 'string' || lineageId === '' || !isStage(stage)) return undefined;
  return isMood(mood) ? { lineageId, stage, mood } : { lineageId, stage };
}

/**
 * Eleven v4 Turbo: reads audio tags like `[laughs]` and acts out the line,
 * where Flash v2.5 reads flat. Measured 2026-10-23 on a 100-character line via
 * /stream: about 0.2 to 0.3 s to first byte, 1.3 s total (Flash was 0.6 s).
 */
export const ELEVENLABS_TTS_MODEL = 'eleven_v4_turbo';

/** The longest line one request speaks; a reply is spoken sentence by sentence. */
export const MAX_SPOKEN_TEXT = 400;

/** An ElevenLabs audio tag such as `[laughs]` or `[clears throat]`. */
const AUDIO_TAG = /\[[a-z][a-z ]*\]/i;

/**
 * The text the lineage voice reads. The skill opens character lines with a
 * stage direction picked from the mood (`*chuckle*`, `*sighs*`), and the mood
 * also has a lead tag (`[happily]`). When the line already carries a tag from
 * its own direction, the mood tag is left off: two tags read as two
 * performances stacked on one word. The mood's voice settings apply either way.
 */
export function spokenLine(text: string, mood: MonMood | undefined): string {
  // Everything here is the Mon's voice: canon pronunciations apply (Caller is "Call-uh").
  const line = pronounceForVoice(stageDirectionsToTags(spokenText(text)));
  const { tag } = voiceDelivery(mood);
  return tag === undefined || AUDIO_TAG.test(line) ? line : `${tag} ${line}`;
}

/**
 * The text a voice without audio tags reads (Web Speech): stage directions
 * dropped instead of read out, quote marks removed, canon pronunciations kept.
 */
export function plainSpokenLine(text: string): string {
  return pronounceForVoice(
    spokenText(text)
      .replace(/\*[^*\n]{1,60}\*/g, ' ')
      .replace(/\*/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +([.,!?])/g, '$1')
      .trim(),
  );
}

/** How one line is voiced. */
export type MonVoicePlan =
  /** An Egg, or nothing to say: no sound, the caption carries it. */
  | { readonly kind: 'silent' }
  /** The Mon's lineage voice (ElevenLabs), pitched by stage. */
  | {
      readonly kind: 'lineage';
      readonly provider: 'elevenlabs';
      readonly lineageId: string;
      readonly voiceId: string;
      readonly model: typeof ELEVENLABS_TTS_MODEL;
      readonly settings: ExpressiveVoiceSettings;
      /** Frequency multiplier baked into the clip; playback stays at rate 1. */
      readonly pitchFactor: number;
      /** The same pitch for the Web Speech fallback when the server has no voice. */
      readonly fallbackPitch: number;
    }
  /** No lineage voice for this Mon (none reported yet, or its line has no voices): the one session browser voice. */
  | { readonly kind: 'fallback'; readonly pitch: number | undefined };

/** One line of the Mon, planned once and played by any surface. */
export interface MonUtterance {
  /** What the screen shows: "Caller", no stage directions, one flowing line. */
  readonly caption: string;
  /** What the lineage voice reads: lexicon, audio tags, mood lead tag. */
  readonly spoken: string;
  /** What a voice without audio tags reads. */
  readonly plainSpoken: string;
  readonly ref: MonVoiceRef | undefined;
  readonly voice: MonVoicePlan;
}

/** Plans one line for `ref` (the Mon's voice), the same on every surface. */
export function planMonUtterance(text: string, ref: MonVoiceRef | undefined): MonUtterance {
  const trimmed = text.slice(0, MAX_SPOKEN_TEXT);
  const caption = captionText(trimmed);
  const spoken = spokenLine(trimmed, ref?.mood);
  const plainSpoken = plainSpokenLine(trimmed);
  const base = { caption, spoken, plainSpoken, ref };
  if (plainSpoken === '') return { ...base, voice: { kind: 'silent' } };
  if (ref === undefined) return { ...base, voice: { kind: 'fallback', pitch: undefined } };
  const pitchFactor = voicePitchFactor(ref.stage);
  const fallbackPitch = webSpeechPitch(ref.stage);
  if (pitchFactor === null || fallbackPitch === null) return { ...base, voice: { kind: 'silent' } };
  const voice = resolveVoice(ref.lineageId);
  if (voice === null) return { ...base, voice: { kind: 'fallback', pitch: fallbackPitch } };
  return {
    ...base,
    voice: {
      kind: 'lineage',
      provider: 'elevenlabs',
      lineageId: voice.lineageId,
      voiceId: voice.elevenLabsVoiceId,
      model: ELEVENLABS_TTS_MODEL,
      settings: expressiveVoiceSettings(voice, ref.mood),
      pitchFactor,
      fallbackPitch,
    },
  };
}

/** The body a client posts to a Mon voice endpoint (`/api/tts`) for one line. */
export interface MonSpeechRequest {
  readonly text: string;
  readonly lineageId: string;
  readonly stage: LifecycleStage;
  readonly mood?: MonMood;
}

/** The request for one line in `ref`'s voice. The server re-plans it from the same data. */
export function monSpeechRequest(text: string, ref: MonVoiceRef): MonSpeechRequest {
  return { text: text.slice(0, MAX_SPOKEN_TEXT), lineageId: ref.lineageId, stage: ref.stage, ...(ref.mood === undefined ? {} : { mood: ref.mood }) };
}

/**
 * The speak() contract every platform implements: `prepare` turns one planned
 * line into something playable (a fetched clip, a native buffer, a browser
 * utterance), `play` plays it and resolves when it ends or is cut off.
 * Rejecting `prepare` skips the line; the caption still shows it.
 */
export interface MonVoicePort<C> {
  prepare(text: string, signal: AbortSignal): Promise<C>;
  play(clip: C, signal: AbortSignal): Promise<void>;
}
