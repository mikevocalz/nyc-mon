import { LIFECYCLE_STAGES, type LifecycleStage, MON_MOODS, type MonMood } from '@acme/core';
import { captionText, spokenText } from './captions.ts';
import { FALLBACK_MON_LINGO, type MonLingo } from './lingo/index.ts';
import { allSpecies } from './mons/index.ts';
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
export { FALLBACK_MON_LINGO, parseMonLingo } from './lingo/index.ts';
export type { LingoGuideEntry, MonLineEntry, MonLingo } from './lingo/index.ts';

/**
 * The Mon's one voice, for every surface that plays it.
 *
 * Source of truth: Payload. The `language-lexicon` collection holds the
 * words (pronunciations such as Caller -> "Call-uh", stage directions, lines)
 * and the `mon-voices` global the voices (lineage -> ElevenLabs voice, stage
 * pitch, mood delivery). `GET /v1/mon-lingo` serves both as one `MonLingo`.
 * This file joins them with `captions.ts` (what the screen shows) into one
 * plan per line, `planMonUtterance(text, ref, lingo)`, a pure function of
 * its inputs, so the server that calls ElevenLabs, the browser that plays the
 * clip, the Web Speech fallback and any native player read the same voice id,
 * settings, pitch and caption for the same served tables. Without `lingo` it
 * plans with `FALLBACK_MON_LINGO` (the seed; tests and offline only).
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

/** `mon.voice` as the MCP tools report it: the ref plus whether the served lingo can voice it right now. */
export interface MonVoiceView {
  readonly lineageId: string;
  readonly stage: LifecycleStage;
  /** False for an Egg, or when Payload has no voice cast for this lineage yet: the reply is shown, not spoken. */
  readonly voiced: boolean;
}

/** `mon.voice` for a Mon record, read against the served lingo. Null for a Mon hatched before voice lineages. */
export function monVoiceView(mon: { readonly voiceLineageId: string | null; readonly stage: LifecycleStage }, lingo: MonLingo = FALLBACK_MON_LINGO): MonVoiceView | null {
  const ref = monVoiceRef(mon);
  if (ref === null) return null;
  const voiced = voicePitchFactor(ref.stage, lingo) !== null && resolveVoice(ref.lineageId, lingo) !== null;
  return { ...ref, voiced };
}

const BLOODLINE_OF = new Map(allSpecies.map((species) => [species.speciesId, species.bloodlineId as string]));

/**
 * The served writing guidance for one Mon: the voice rules and word palette
 * that apply to its form, bloodline, stage and mood, and its canon lines.
 * A rule with no form, bloodline, stage or mood applies to every Mon. For a
 * model writing the Mon's reply (the MCP server's `talk_to_mon`).
 */
export function voiceGuideFor(mon: { readonly speciesId: string; readonly stage: LifecycleStage }, mood: MonMood | undefined, lingo: MonLingo = FALLBACK_MON_LINGO): string[] {
  const bloodlineId = BLOODLINE_OF.get(mon.speciesId);
  const applies = (entry: { speciesId: string | null; bloodlineId: string | null; stage: LifecycleStage | null; mood: MonMood | null }) =>
    (entry.speciesId === null || entry.speciesId === mon.speciesId) &&
    (entry.bloodlineId === null || entry.bloodlineId === bloodlineId) &&
    (entry.stage === null || entry.stage === mon.stage) &&
    (entry.mood === null || entry.mood === mood);
  const guide = lingo.guide.filter(applies).map((entry) => {
    if (entry.category === 'word-palette') return `${entry.text}: ${entry.meaning} ${entry.policy}`;
    if (entry.mood !== null) return `Mood ${entry.mood}: ${entry.text}`;
    return entry.text;
  });
  const lines = lingo.lines
    .filter((line) => line.speciesId === mon.speciesId && line.stage === mon.stage && (line.mood === null || line.mood === mood))
    .map((line) => `Canon line (${line.occasion}): "${line.text}"`);
  return [...guide, ...lines];
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
 * The seed's model, Eleven v4 Turbo: reads audio tags like `[laughs]` and acts
 * out the line, where Flash v2.5 reads flat. Measured 2026-10-23 on a
 * 100-character line via /stream: about 0.2 to 0.3 s to first byte, 1.3 s
 * total (Flash was 0.6 s). The served model is `lingo.voices.model`.
 */
export const ELEVENLABS_TTS_MODEL: string = FALLBACK_MON_LINGO.voices.model;

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
export function spokenLine(text: string, mood: MonMood | undefined, lingo: MonLingo = FALLBACK_MON_LINGO): string {
  // Everything here is the Mon's voice: canon pronunciations apply (Caller is "Call-uh").
  const line = pronounceForVoice(stageDirectionsToTags(spokenText(text), lingo), lingo);
  const { tag } = voiceDelivery(mood, lingo);
  return tag === undefined || AUDIO_TAG.test(line) ? line : `${tag} ${line}`;
}

/**
 * The text a voice without audio tags reads (Web Speech): stage directions
 * dropped instead of read out, quote marks removed, canon pronunciations kept.
 */
export function plainSpokenLine(text: string, lingo: MonLingo = FALLBACK_MON_LINGO): string {
  return pronounceForVoice(
    spokenText(text)
      .replace(/\*[^*\n]{1,60}\*/g, ' ')
      .replace(/\*/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +([.,!?])/g, '$1')
      .trim(),
    lingo,
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
      readonly model: string;
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

/**
 * Plans one line for `ref` (the Mon's voice) with `lingo` (the served tables),
 * the same on every surface: a pure function of its three inputs.
 */
export function planMonUtterance(text: string, ref: MonVoiceRef | undefined, lingo: MonLingo = FALLBACK_MON_LINGO): MonUtterance {
  const trimmed = text.slice(0, MAX_SPOKEN_TEXT);
  const caption = captionText(trimmed, lingo);
  const spoken = spokenLine(trimmed, ref?.mood, lingo);
  const plainSpoken = plainSpokenLine(trimmed, lingo);
  const base = { caption, spoken, plainSpoken, ref };
  if (plainSpoken === '') return { ...base, voice: { kind: 'silent' } };
  if (ref === undefined) return { ...base, voice: { kind: 'fallback', pitch: undefined } };
  const pitchFactor = voicePitchFactor(ref.stage, lingo);
  const fallbackPitch = webSpeechPitch(ref.stage, lingo);
  if (pitchFactor === null || fallbackPitch === null) return { ...base, voice: { kind: 'silent' } };
  const voice = resolveVoice(ref.lineageId, lingo);
  if (voice === null) return { ...base, voice: { kind: 'fallback', pitch: fallbackPitch } };
  return {
    ...base,
    voice: {
      kind: 'lineage',
      provider: lingo.voices.provider,
      lineageId: voice.lineageId,
      voiceId: voice.elevenLabsVoiceId,
      model: lingo.voices.model,
      settings: expressiveVoiceSettings(voice, ref.mood, lingo),
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
