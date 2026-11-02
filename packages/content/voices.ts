import { type BloodlineId, type LifecycleStage, type MonGender, type MonMood, parseVoiceLineageId } from '@acme/core';
import {
  FALLBACK_MON_LINGO,
  type LineageVoice,
  type MonLingo,
  type MoodDelivery,
  pronounceWith,
  stageDirectionsWith,
  type VoiceSettings,
} from './lingo/index.ts';
import { bloodlines } from './mons/index.ts';

export type { LineageVoice, MoodDelivery, VoiceExpression, VoiceSettings } from './lingo/index.ts';

/**
 * Voice lookups over the Mon's lingo tables. Each Mon keeps one voice lineage
 * for life (Bible v11 ¶56); `mintMonInstance` writes
 * `<egg form speciesId>/<gender>/<slot>` at hatch and the `mon-voices` global
 * in Payload maps it to an ElevenLabs voice.
 *
 * The tables come from Payload (`GET /v1/mon-lingo`, or the server reading
 * them directly). Every function takes them as `lingo`; leaving it out uses
 * `FALLBACK_MON_LINGO`, the seed, which is for tests and offline only.
 *
 * Pools are append-only and ordered: slot N is entry N-1. A pool shorter than
 * `VOICE_SLOTS_PER_GENDER` wraps, which re-maps slots when it grows, so fill a
 * pool to the slot count before a line ships.
 */

/** A bloodline's voices, split by gender. */
export interface LineVoicePools {
  readonly bloodlineId: BloodlineId;
  /** The Egg form's speciesId: the line key inside a lineage id. */
  readonly lineKey: string;
  readonly pools: Readonly<Record<MonGender, readonly LineageVoice[]>>;
}

function poolOf(lingo: MonLingo, lineKey: string, gender: MonGender): readonly LineageVoice[] {
  return lingo.voices.lineages.filter((voice) => voice.lineageId.startsWith(`${lineKey}/${gender}/`));
}

/** Every shipped bloodline's pools, in starter slot order (from the fallback tables). */
export const voicePools: readonly LineVoicePools[] = bloodlines.map((bloodline) => {
  const lineKey = bloodline.chain.speciesId;
  return {
    bloodlineId: bloodline.bloodlineId,
    lineKey,
    pools: { female: poolOf(FALLBACK_MON_LINGO, lineKey, 'female'), male: poolOf(FALLBACK_MON_LINGO, lineKey, 'male') },
  };
});

/** The voice for a lineage id, or null when the line has no voices yet or the id is malformed. */
export function resolveVoice(lineageId: string, lingo: MonLingo = FALLBACK_MON_LINGO): LineageVoice | null {
  const parsed = parseVoiceLineageId(lineageId);
  if (parsed === undefined) return null;
  const voices = poolOf(lingo, parsed.lineKey, parsed.gender);
  if (voices.length === 0) return null;
  return voices[(parsed.slot - 1) % voices.length] ?? null;
}

/**
 * Frequency multiplier for a stage's voice, or null when that stage is silent.
 * /api/tts bakes it into the audio with a duration-preserving shift, so a Baby
 * sounds young without talking faster.
 */
export function voicePitchFactor(stage: LifecycleStage, lingo: MonLingo = FALLBACK_MON_LINGO): number | null {
  return lingo.voices.stagePitch[stage];
}

/** The same table as a Web Speech `utterance.pitch` (range 0 to 2, 1 is the voice's default). */
export function webSpeechPitch(stage: LifecycleStage, lingo: MonLingo = FALLBACK_MON_LINGO): number | null {
  const factor = lingo.voices.stagePitch[stage];
  return factor === null ? null : Math.min(2, Math.max(0, factor));
}

/** The mood's lead tag and voice settings; without a mood, the default delivery. */
export function voiceDelivery(mood: MonMood | undefined, lingo: MonLingo = FALLBACK_MON_LINGO): MoodDelivery {
  return mood === undefined ? lingo.voices.defaultDelivery : lingo.voices.moods[mood];
}

/** {@link VoiceSettings} plus the expressive fields a voice carries. */
export interface ExpressiveVoiceSettings extends VoiceSettings {
  readonly style: number;
  readonly speed: number;
}

/**
 * Full ElevenLabs `voice_settings` for one voice in one mood: the mood's
 * stability and similarity plus the voice's style and speed. A tired or
 * sleeping Mon (the global's low-energy moods) keeps its own voice but drops
 * the swagger: style scaled down, never faster than the cap.
 */
export function expressiveVoiceSettings(voice: LineageVoice, mood: MonMood | undefined, lingo: MonLingo = FALLBACK_MON_LINGO): ExpressiveVoiceSettings {
  const { settings } = voiceDelivery(mood, lingo);
  const { lowEnergy } = lingo.voices;
  if (mood !== undefined && lowEnergy.moods.includes(mood)) {
    return { ...settings, style: voice.expression.style * lowEnergy.styleFactor, speed: Math.min(voice.expression.speed, lowEnergy.maxSpeed) };
  }
  return { ...settings, style: voice.expression.style, speed: voice.expression.speed };
}

/** Turns `*stage directions*` into the lexicon's audio tags or removes them, and drops stray asterisks. */
export function stageDirectionsToTags(text: string, lingo: MonLingo = FALLBACK_MON_LINGO): string {
  return stageDirectionsWith(text, lingo);
}

/**
 * How the Mon's voice says canon words that ElevenLabs reads wrong (ADR 0008):
 * the lexicon's pronunciation rows. The screen always spells "Caller"; the
 * voice says "Call-uh". Whole words only, plurals included, case kept.
 */
export function pronounceForVoice(text: string, lingo: MonLingo = FALLBACK_MON_LINGO): string {
  return pronounceWith(text, lingo);
}
