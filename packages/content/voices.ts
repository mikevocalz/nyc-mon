import { type BloodlineId, type LifecycleStage, type MonGender, type MonMood, parseVoiceLineageId } from '@acme/core';
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
 * Pitch factor per stage: the same voice sounds higher when young and lower
 * when grown. Null means silent: an Egg does not speak.
 *
 * /api/tts bakes this into the audio with a duration-preserving shift
 * (resample by the factor, then time-stretch back), so a Baby sounds young
 * without talking faster. The browser plays the result at rate 1.
 */
const PITCH_FACTOR: Readonly<Record<LifecycleStage, number | null>> = {
  Egg: null,
  Baby: 1.3,
  Small: 1.15,
  Mid: 1.0,
  Max: 0.92,
};

/** Frequency multiplier for a stage's voice, or null when that stage is silent. */
export function voicePitchFactor(stage: LifecycleStage): number | null {
  return PITCH_FACTOR[stage];
}


/** The same table as a Web Speech `utterance.pitch` (range 0 to 2, 1 is the voice's default). */
export function webSpeechPitch(stage: LifecycleStage): number | null {
  const factor = PITCH_FACTOR[stage];
  return factor === null ? null : Math.min(2, Math.max(0, factor));
}

/** ElevenLabs voice settings the expressive model reads (Eleven v4 takes these two only). */
export interface VoiceSettings {
  /** 0 to 1. Lower gives a wider emotional range; higher sounds steadier and flatter. */
  readonly stability: number;
  /** 0 to 1. How closely the output keeps to the library voice. */
  readonly similarity_boost: number;
}

/** How a Mon in one mood delivers a line: a leading audio tag plus voice settings. */
export interface MoodDelivery {
  /** An audio tag such as `[happily]`, prepended to the line; undefined adds none. */
  readonly tag: string | undefined;
  readonly settings: VoiceSettings;
}

/**
 * Same voice across moods, so similarity stays put; stability carries the
 * mood. 0.35 for a content Mon gives the bounciest read, 0.4 for a Mon that
 * wants something, 0.55 to 0.6 for a tired or sleeping one, which should sound
 * flat and low-energy. Tags are the ones ElevenLabs documents for v3/v4.
 */
const MOOD_DELIVERY: Readonly<Record<MonMood, MoodDelivery>> = {
  content: { tag: '[happily]', settings: { stability: 0.35, similarity_boost: 0.8 } },
  asleep: { tag: '[whispers]', settings: { stability: 0.6, similarity_boost: 0.8 } },
  sluggish: { tag: '[slow]', settings: { stability: 0.55, similarity_boost: 0.8 } },
  'needs-fullness': { tag: '[curious]', settings: { stability: 0.4, similarity_boost: 0.8 } },
  'needs-energy': { tag: '[sighs]', settings: { stability: 0.55, similarity_boost: 0.8 } },
  'needs-social': { tag: '[sad]', settings: { stability: 0.4, similarity_boost: 0.8 } },
};

/** Without a mood: no leading tag, a middle stability. */
const DEFAULT_DELIVERY: MoodDelivery = { tag: undefined, settings: { stability: 0.45, similarity_boost: 0.8 } };

export function voiceDelivery(mood: MonMood | undefined): MoodDelivery {
  return mood === undefined ? DEFAULT_DELIVERY : MOOD_DELIVERY[mood];
}

/**
 * The skill writes stage directions as `*short huff*`. Ones with a matching
 * audio tag become that tag; the rest are dropped so nobody reads them out.
 * First keyword match wins.
 */
const STAGE_DIRECTION_TAGS: readonly (readonly [RegExp, string])[] = [
  [/laugh|chuckl|giggl|snicker|cackl/i, '[laughs]'],
  [/huff|sigh/i, '[sighs]'],
  [/whisper|murmur/i, '[whispers]'],
  [/shout|yell/i, '[shouts]'],
  [/clears? (its |his |her )?throat|ahem/i, '[clears throat]'],
];

/** Turns `*stage directions*` into audio tags or removes them, and drops stray asterisks. */
export function stageDirectionsToTags(text: string): string {
  return text
    .replace(/\*([^*\n]{1,60})\*/g, (_, direction: string) => {
      const hit = STAGE_DIRECTION_TAGS.find(([pattern]) => pattern.test(direction));
      return hit ? hit[1] : '';
    })
    .replace(/\*/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
