import { type BloodlineId, type LifecycleStage, type MonGender, parseVoiceLineageId } from '@acme/core';
import { bloodlines, hoodRattiBloodline } from './mons/index.ts';

/**
 * Voice registry. Each Mon keeps one voice lineage for life (Bible v11 ¶56);
 * `mintMonInstance` writes `<egg form speciesId>/<gender>/<slot>` at hatch and
 * this file maps it to an ElevenLabs voice.
 *
 * Where it plays: only the web simulator speaks with these voices. On a real
 * Echo, Alexa reads every reply in its own voice (PLATFORM-DOCS §2.8), so the
 * MCP server only reports the lineage and stage.
 *
 * Pools are append-only and ordered: slot N is entry N-1. A pool shorter than
 * `VOICE_SLOTS_PER_GENDER` wraps, which re-maps slots when it grows, so fill a
 * pool to the slot count before a line ships.
 */

/** One ElevenLabs voice bound to one lineage slot. */
export interface LineageVoice {
  /** The lineage id this entry serves, `<lineKey>/<gender>/<slot>`. */
  readonly lineageId: string;
  readonly elevenLabsVoiceId: string;
  /** ElevenLabs library name, for people reading this file. */
  readonly name: string;
}

/** A bloodline's voices, split by gender. */
export interface LineVoicePools {
  readonly bloodlineId: BloodlineId;
  /** The Egg form's speciesId: the line key inside a lineage id. */
  readonly lineKey: string;
  readonly pools: Readonly<Record<MonGender, readonly LineageVoice[]>>;
}

type VoiceSeed = readonly [elevenLabsVoiceId: string, name: string];

function pool(lineKey: string, gender: MonGender, seeds: readonly VoiceSeed[]): readonly LineageVoice[] {
  return seeds.map(([elevenLabsVoiceId, name], i) => ({ lineageId: `${lineKey}/${gender}/${i + 1}`, elevenLabsVoiceId, name }));
}

/** Owner's picks, 2026-10-23. Hood Ratti line, dex-001..007. */
const HOOD_RATTI_VOICES: Readonly<Record<MonGender, readonly VoiceSeed[]>> = {
  male: [
    ['ataV0GNgfIus2NWdTJP0', 'Louie the Legend'],
    ['OwEAPhTFInN6VSRT9QXm', 'Jordan - Warm & Gritty'],
    ['2t3wubVNRseKNVjtlWx1', 'Quinn - Soft Nerd Boy'],
    ['r6wl0leuE6uvo1N05wP7', 'Ben - Relaxed reader, NY'],
  ],
  female: [
    ['b8JMPeNuVrqqWExQc8e9', 'Ayla - Bubbly'],
    ['o9B86nZP8mMLaT5FBEzP', 'Kathie - Sassy & Playful'],
    ['wIzYfKZE8c87XZD7bDLH', 'Zibby - Quirky'],
    ['d8WcCpplp8meHt10UhL8', 'Emily - Bright'],
  ],
};

const SEEDS_BY_BLOODLINE: ReadonlyMap<BloodlineId, Readonly<Record<MonGender, readonly VoiceSeed[]>>> = new Map([
  [hoodRattiBloodline.bloodlineId, HOOD_RATTI_VOICES],
  // TODO(canon): voices for the other lines. Empty pools resolve to null and the sim falls back to Web Speech.
]);

/** Every shipped bloodline's pools, in starter slot order. */
export const voicePools: readonly LineVoicePools[] = bloodlines.map((bloodline) => {
  const lineKey = bloodline.chain.speciesId;
  const seeds = SEEDS_BY_BLOODLINE.get(bloodline.bloodlineId);
  return {
    bloodlineId: bloodline.bloodlineId,
    lineKey,
    pools: { female: pool(lineKey, 'female', seeds?.female ?? []), male: pool(lineKey, 'male', seeds?.male ?? []) },
  };
});

const poolsByLineKey = new Map(voicePools.map((line) => [line.lineKey, line]));

/** The voice for a lineage id, or null when the line has no voices yet or the id is malformed. */
export function resolveVoice(lineageId: string): LineageVoice | null {
  const parsed = parseVoiceLineageId(lineageId);
  if (parsed === undefined) return null;
  const voices = poolsByLineKey.get(parsed.lineKey)?.pools[parsed.gender];
  if (voices === undefined || voices.length === 0) return null;
  return voices[(parsed.slot - 1) % voices.length] ?? null;
}

/**
 * Playback rate per stage: same voice, higher when young, lower when grown.
 * Null means silent: an Egg does not speak. The sim applies it as
 * `HTMLAudioElement.playbackRate` with `preservesPitch = false`, which moves
 * tempo with pitch, so a Baby also talks 30% faster. That is the ceiling of a
 * client-side shift; the upgrade is a server-side pitch shift that keeps tempo.
 */
const PLAYBACK_RATE: Readonly<Record<LifecycleStage, number | null>> = {
  Egg: null,
  Baby: 1.3,
  Small: 1.15,
  Mid: 1.0,
  Max: 0.92,
};

export function voicePlaybackRate(stage: LifecycleStage): number | null {
  return PLAYBACK_RATE[stage];
}

/** The same table as a Web Speech `utterance.pitch` (range 0 to 2, 1 is the voice's default). */
export function webSpeechPitch(stage: LifecycleStage): number | null {
  const rate = PLAYBACK_RATE[stage];
  return rate === null ? null : Math.min(2, Math.max(0, rate));
}
