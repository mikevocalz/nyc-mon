import {
  type BabbleInventory,
  capVoiceStage,
  enforceVoiceStage,
  LIFECYCLE_STAGES,
  type LifecycleStage,
  MON_MOODS,
  type MonMood,
  parseVoiceLineageId,
  type VoiceStage,
  voiceStage as voiceStageAt,
} from '@acme/core';
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
export type { BabbleEntry, BabbleKind, LingoGuideEntry, MonLineEntry, MonLingo } from './lingo/index.ts';

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
 *
 * Voice stage (Decision 32): an Egg and a Baby in its first 24 hours babble,
 * a Baby after that speaks `limited` (family sound plus at most two words),
 * later forms speak in full. `monVoiceRef(mon, now)` works the stage out from
 * the Mon's `hatchedAt`; `planMonUtterance` runs every line through the speech
 * gate in @acme/core before anything is captioned or voiced, so a scripted
 * line or a model reply that breaks the stage never reaches the Caller.
 */

/** Which voice a Mon speaks with right now, as the MCP tools report it in `mon.voice` (plus the result's mood). */
export interface MonVoiceRef {
  readonly lineageId: string;
  readonly stage: LifecycleStage;
  /**
   * How much speech the Mon has (`voiceStage(mon, now)` in @acme/core). The
   * planner never grants more than the lifecycle stage allows; left out, an
   * Egg babbles and a Baby is `limited`.
   */
  readonly voiceStage?: VoiceStage;
  /** Sets how the line is delivered; from the same tool result's `mood`. */
  readonly mood?: MonMood;
}

/** The fields of a Mon record the voice reads. `hatchedAt` sets the first-day babble. */
export interface MonVoiceSource {
  readonly voiceLineageId: string | null;
  readonly stage: LifecycleStage;
  readonly hatchedAt?: number | null;
}

/**
 * `mon.voice` for a Mon record at `now` (the caller's clock; on a server, the
 * server's): null for a Mon hatched before voice lineages.
 */
export function monVoiceRef(mon: MonVoiceSource, now: number): { lineageId: string; stage: LifecycleStage; voiceStage: VoiceStage } | null {
  return mon.voiceLineageId === null ? null : { lineageId: mon.voiceLineageId, stage: mon.stage, voiceStage: voiceStageAt(mon, now) };
}

/** `mon.voice` as the MCP tools report it: the ref plus whether the served lingo can voice it right now. */
export interface MonVoiceView {
  readonly lineageId: string;
  readonly stage: LifecycleStage;
  /** `baby-talk`, `limited` or `full`: what the Mon may say right now. */
  readonly voiceStage: VoiceStage;
  /** False when the stage has no pitch or Payload has no voice cast for this lineage yet: the reply is shown, not spoken. */
  readonly voiced: boolean;
}

/** `mon.voice` for a Mon record at `now`, read against the served lingo. Null for a Mon hatched before voice lineages. */
export function monVoiceView(mon: MonVoiceSource, now: number, lingo: MonLingo = FALLBACK_MON_LINGO): MonVoiceView | null {
  const ref = monVoiceRef(mon, now);
  if (ref === null) return null;
  const voiced = voicePitchFactor(ref.stage, lingo) !== null && resolveVoice(ref.lineageId, lingo) !== null;
  return { ...ref, voiced };
}

const BLOODLINE_OF = new Map(allSpecies.map((species) => [species.speciesId, species.bloodlineId as string]));

/** The Bloodline of a species id, or of a lineage id's line key (the Egg form's species id). */
function bloodlineFor(subject: { readonly speciesId?: string; readonly lineageId?: string }): string | undefined {
  if (subject.speciesId !== undefined) return BLOODLINE_OF.get(subject.speciesId);
  const lineKey = subject.lineageId === undefined ? undefined : parseVoiceLineageId(subject.lineageId)?.lineKey;
  return lineKey === undefined ? undefined : BLOODLINE_OF.get(lineKey);
}

/**
 * The babble a Mon is made of, from the served `babble` rows (the fallback's
 * when the served lingo has none): the shared syllables, its Bloodline's
 * family sound, and for an Egg the sounds from inside the shell.
 */
export function babbleInventory(
  subject: { readonly speciesId?: string; readonly lineageId?: string },
  stage: LifecycleStage,
  lingo: MonLingo = FALLBACK_MON_LINGO,
): BabbleInventory {
  const rows = lingo.babble.length > 0 ? lingo.babble : FALLBACK_MON_LINGO.babble;
  const bloodlineId = bloodlineFor(subject);
  const mine = rows.filter((row) => row.bloodlineId === null || row.bloodlineId === bloodlineId);
  return {
    syllables: mine.filter((row) => row.kind === 'syllable').map((row) => row.text),
    sounds: mine.filter((row) => row.kind === 'family-sound' || (stage === 'Egg' && row.kind === 'egg-sound')).map((row) => row.text),
  };
}

/** Writing guidance for a model voicing a babbling Mon: the only sounds it may use. */
function babbleGuide(inventory: BabbleInventory, egg: boolean): string[] {
  const who = egg ? 'The Mon is still an Egg' : 'The Mon hatched less than a day ago';
  return [
    `${who}: baby talk only. Reply with wordless babble, two or three short sounds, like "${makeBabbleExample(inventory)}".`,
    `Build every sound from these syllables: ${inventory.syllables.join(', ')}. Its own sounds: ${inventory.sounds.join(', ') || 'none'}.`,
    'No real words in any language, no names, no "Callah", no numbers. Anything else is replaced with babble before it is spoken.',
  ];
}

function makeBabbleExample(inventory: BabbleInventory): string {
  return enforceVoiceStage('', 'baby-talk', inventory, { seed: 'guide-example' }).text;
}

/**
 * The served writing guidance for one Mon: the voice rules and word palette
 * that apply to its form, bloodline, stage and mood, and its canon lines.
 * A rule with no form, bloodline, stage or mood applies to every Mon. For a
 * model writing the Mon's reply (the MCP server's `talk_to_mon`).
 */
export function voiceGuideFor(
  mon: { readonly speciesId: string; readonly stage: LifecycleStage },
  mood: MonMood | undefined,
  lingo: MonLingo = FALLBACK_MON_LINGO,
  voiceStage?: VoiceStage,
): string[] {
  const stage = capVoiceStage(mon.stage, voiceStage);
  if (stage === 'baby-talk') return babbleGuide(babbleInventory({ speciesId: mon.speciesId }, mon.stage, lingo), mon.stage === 'Egg');
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

const VOICE_STAGES: readonly VoiceStage[] = ['baby-talk', 'limited', 'full'];

/**
 * Reads `mon.voice` from untrusted JSON (a tool result, storage). Undefined
 * unless it has a string lineage and a known stage; an unknown mood or voice
 * stage is dropped (the planner then caps by lifecycle stage).
 */
export function readMonVoiceRef(voice: unknown, mood?: unknown): MonVoiceRef | undefined {
  if (typeof voice !== 'object' || voice === null) return undefined;
  const { lineageId, stage, voiceStage } = voice as { lineageId?: unknown; stage?: unknown; voiceStage?: unknown };
  if (typeof lineageId !== 'string' || lineageId === '' || !isStage(stage)) return undefined;
  return {
    lineageId,
    stage,
    ...((VOICE_STAGES as readonly unknown[]).includes(voiceStage) ? { voiceStage: voiceStage as VoiceStage } : {}),
    ...(isMood(mood) ? { mood } : {}),
  };
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
  /** Nothing to say, or a stage with no pitch: no sound, the caption carries it. */
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
  /** The voice stage the line was gated at (`full` when no Mon voice is known). */
  readonly voiceStage: VoiceStage;
  /** True when the speech gate replaced the line (a real word from a babbling Mon, a sentence from a `limited` one). */
  readonly gated: boolean;
  /** What the screen shows: "Caller", no stage directions, one flowing line. */
  readonly caption: string;
  /** What the lineage voice reads: lexicon, audio tags, mood lead tag. */
  readonly spoken: string;
  /** What a voice without audio tags reads. */
  readonly plainSpoken: string;
  readonly ref: MonVoiceRef | undefined;
  readonly voice: MonVoicePlan;
}

/** Options for {@link planMonUtterance}. */
export interface PlanOptions {
  /**
   * Seeds the babble that replaces a line the gate refuses, so every surface
   * planning the same turn says the same babble. Defaults to lineage + text.
   */
  readonly seed?: string;
}

/**
 * Runs a line through the speech gate for `ref`'s voice stage (Decision 32):
 * babble only for `baby-talk`, the Q32 limit for `limited`, untouched for
 * `full` or when no Mon voice is known. Servers call it on model output.
 */
export function gateMonLine(text: string, ref: MonVoiceRef | undefined, lingo: MonLingo = FALLBACK_MON_LINGO, options: PlanOptions = {}): { text: string; voiceStage: VoiceStage; replaced: boolean } {
  if (ref === undefined) return { text, voiceStage: 'full', replaced: false };
  const voiceStage = capVoiceStage(ref.stage, ref.voiceStage);
  const inventory = babbleInventory({ lineageId: ref.lineageId }, ref.stage, lingo);
  const gated = enforceVoiceStage(text, voiceStage, inventory, { seed: options.seed ?? `${ref.lineageId}|${text}` });
  return { text: gated.text, voiceStage, replaced: gated.replaced };
}

/**
 * Plans one line for `ref` (the Mon's voice) with `lingo` (the served tables),
 * the same on every surface: a pure function of its inputs. The line is gated
 * by voice stage first ({@link gateMonLine}).
 */
export function planMonUtterance(text: string, ref: MonVoiceRef | undefined, lingo: MonLingo = FALLBACK_MON_LINGO, options: PlanOptions = {}): MonUtterance {
  const gate = gateMonLine(text.slice(0, MAX_SPOKEN_TEXT), ref, lingo, options);
  const trimmed = gate.text.slice(0, MAX_SPOKEN_TEXT);
  const caption = captionText(trimmed, lingo);
  const spoken = spokenLine(trimmed, ref?.mood, lingo);
  const plainSpoken = plainSpokenLine(trimmed, lingo);
  const base = { voiceStage: gate.voiceStage, gated: gate.replaced, caption, spoken, plainSpoken, ref };
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
  /** The client's voice stage. A server caps it by `stage` (`capVoiceStage`) and never trusts it to grant more speech. */
  readonly voiceStage?: VoiceStage;
  readonly mood?: MonMood;
}

/** The request for one line in `ref`'s voice. The server re-plans it from the same data. */
export function monSpeechRequest(text: string, ref: MonVoiceRef): MonSpeechRequest {
  return {
    text: text.slice(0, MAX_SPOKEN_TEXT),
    lineageId: ref.lineageId,
    stage: ref.stage,
    ...(ref.voiceStage === undefined ? {} : { voiceStage: ref.voiceStage }),
    ...(ref.mood === undefined ? {} : { mood: ref.mood }),
  };
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
