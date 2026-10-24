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

/**
 * How one voice performs: the ElevenLabs `style` (how strongly the voice's own
 * delivery is exaggerated, 0 to 1) and `speed` (1 is the voice's natural pace,
 * 0.7 to 1.2). A mood scales these down when the Mon is tired.
 */
export interface VoiceExpression {
  readonly style: number;
  readonly speed: number;
}

/** One ElevenLabs voice bound to one lineage slot. */
export interface LineageVoice {
  /** The lineage id this entry serves, `<lineKey>/<gender>/<slot>`. */
  readonly lineageId: string;
  readonly elevenLabsVoiceId: string;
  /** ElevenLabs library name, for people reading this file. */
  readonly name: string;
  readonly expression: VoiceExpression;
}

/** A bloodline's voices, split by gender. */
export interface LineVoicePools {
  readonly bloodlineId: BloodlineId;
  /** The Egg form's speciesId: the line key inside a lineage id. */
  readonly lineKey: string;
  readonly pools: Readonly<Record<MonGender, readonly LineageVoice[]>>;
}

type VoiceSeed = readonly [elevenLabsVoiceId: string, name: string, expression: VoiceExpression];

function pool(lineKey: string, gender: MonGender, seeds: readonly VoiceSeed[]): readonly LineageVoice[] {
  return seeds.map(([elevenLabsVoiceId, name, expression], i) => ({ lineageId: `${lineKey}/${gender}/${i + 1}`, elevenLabsVoiceId, name, expression }));
}

/**
 * Hood Ratti line, dex-001..007. Recast by the owner on 2026-10-23: the
 * Caller's Hood Ratti-line Mon is Black American, from NYC, with swagger
 * (docs/canon/OPEN_QUESTIONS.md Q12; SKILL.md "Hood Ratti line"). Every voice
 * here is an ElevenLabs library voice labelled African American / Black
 * American. Style sits at 0.45 to 0.6 for a confident, rhythmic read; the
 * calmer voices get the lower style so they stay smooth instead of shouty.
 *
 * The recast keeps the slot order, so an existing Mon keeps its lineage id and
 * gets the new actor in that slot. Changing a live Mon's voice once is
 * acceptable before launch. After launch, never re-cast a slot: append a new
 * pool or a new line instead (Bible v11 ¶56, one voice for life).
 */
const HOOD_RATTI_VOICES: Readonly<Record<MonGender, readonly VoiceSeed[]>> = {
  male: [
    ['RI6PDnjA72WXqF0pmJ4i', 'Jax - Calm, Chill, Fresh', { style: 0.45, speed: 1.0 }],
    ['zm9E2qHSmW6HZXdIYeV9', "Tre's USA Voice", { style: 0.5, speed: 1.03 }],
    ['1cuDPO8sIMatoOE4Z2Zv', 'Dan - African American calm & friendly', { style: 0.45, speed: 1.02 }],
    ['ataV0GNgfIus2NWdTJP0', 'Louie the Legend', { style: 0.55, speed: 1.03 }],
  ],
  female: [
    ['zWoalRDt5TZrmW4ROIA7', 'Brooklyn - African American New Yorker', { style: 0.55, speed: 1.03 }],
    ['BeKZH03brdNaVyYtd97H', 'Michelle - West Coast Flow Light Soulful', { style: 0.5, speed: 1.0 }],
    ['iotvXRdCltpsT7ekz022', 'Tasha - Urban, Southern, Modern', { style: 0.5, speed: 1.02 }],
    ['N5oldAAfj8TlzCKVVyLS', 'Keke Sharice', { style: 0.55, speed: 1.03 }],
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

/** {@link VoiceSettings} plus the expressive fields a voice carries. */
export interface ExpressiveVoiceSettings extends VoiceSettings {
  readonly style: number;
  readonly speed: number;
}

/**
 * A tired or sleeping Mon keeps its own voice but drops the swagger: half the
 * style, and a touch slower than natural pace.
 */
const LOW_ENERGY_MOODS: ReadonlySet<MonMood> = new Set<MonMood>(['asleep', 'sluggish', 'needs-energy']);
const LOW_ENERGY_STYLE_FACTOR = 0.5;
const LOW_ENERGY_SPEED = 0.95;

/**
 * Full ElevenLabs `voice_settings` for one voice in one mood: the mood's
 * stability and similarity plus the voice's style and speed.
 *
 * Not yet sent by /api/tts, which posts `voiceDelivery(mood).settings` (the
 * two fields the comment above says Eleven v4 reads). ElevenLabs documents
 * `style` and `speed` for its other TTS models and says speed is not available
 * on Eleven v3; whether `eleven_v4_turbo` accepts or ignores them has not been
 * checked. Send this only after one live call against the current model
 * confirms it does not reject the extra fields.
 */
export function expressiveVoiceSettings(voice: LineageVoice, mood: MonMood | undefined): ExpressiveVoiceSettings {
  const { settings } = voiceDelivery(mood);
  if (mood !== undefined && LOW_ENERGY_MOODS.has(mood)) {
    return { ...settings, style: voice.expression.style * LOW_ENERGY_STYLE_FACTOR, speed: Math.min(voice.expression.speed, LOW_ENERGY_SPEED) };
  }
  return { ...settings, style: voice.expression.style, speed: voice.expression.speed };
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

/**
 * How the Mon's voice says canon words that ElevenLabs reads wrong (ADR 0008,
 * alexa-plus-brief, SKILL.md). The screen always spells "Caller"; the voice
 * says "Call-uh". Whole words only, plurals included, case kept.
 */
const LEXICON: readonly (readonly [RegExp, string])[] = [[/\b(Call)(?:ah|er)(s?)\b/gi, 'uh']];

function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  return replacement;
}

/** Applies {@link LEXICON} to a line before it goes to the voice. Captions keep the original text. */
export function pronounceForVoice(text: string): string {
  return LEXICON.reduce(
    (line, [pattern, ending]) =>
      line.replace(pattern, (whole: string, call: string, plural: string) => `${call}-${matchCase(whole, ending)}${plural ? matchCase(whole, 'z') : ''}`),
    text,
  );
}
