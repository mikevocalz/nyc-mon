import { LIFECYCLE_STAGES, type LifecycleStage, MON_MOODS, type MonMood } from '@acme/core';
import type { LexiconRow, MonVoicesDoc } from './rows.ts';

/**
 * The tables the Mon's voice reads, built from Payload's documents. This is
 * also what `GET /v1/mon-lingo` serves: plain JSON, no editorial fields.
 */

/** A line the Mon says on one occasion (`hello`, `hungry`…). */
export interface MonLineEntry {
  readonly key: string;
  readonly speciesId: string;
  readonly stage: LifecycleStage;
  readonly occasion: string;
  readonly text: string;
  readonly mood: MonMood | null;
}

/** A word the voice says differently from the screen (Caller → "Call-uh"). */
export interface PronunciationEntry {
  readonly key: string;
  /** The screen form. */
  readonly written: string;
  /** Other written forms: the voice reads them like `written`, a caption turns them into `written`. */
  readonly variants: readonly string[];
  readonly spoken: string;
  readonly spokenPlural: string | null;
}

/** A `*stage direction*` performed as an audio tag; the first entry whose keywords match wins. */
export interface StageDirectionEntry {
  readonly key: string;
  readonly tag: string;
  readonly keywords: readonly string[];
}

/** Writing guidance served to models that write the Mon's lines (word palette, voice rules). */
export interface LingoGuideEntry {
  readonly key: string;
  readonly category: 'word-palette' | 'voice-rule';
  readonly subcategory: string | null;
  readonly text: string;
  readonly meaning: string;
  readonly policy: string;
  readonly bloodlineId: string | null;
  readonly speciesId: string | null;
  readonly stage: LifecycleStage | null;
  readonly mood: MonMood | null;
  readonly trigger: string | null;
}

/** What kind of babble sound a row is. */
export type BabbleKind = 'syllable' | 'family-sound' | 'egg-sound';

/** One babble sound (Decision 32): a syllable every Mon chains, a line's family sound, or an Egg's muffled sound. */
export interface BabbleEntry {
  readonly key: string;
  readonly kind: BabbleKind;
  readonly text: string;
  /** Null: every Bloodline. */
  readonly bloodlineId: string | null;
}

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
  /** ElevenLabs library name, for people reading the data. */
  readonly name: string;
  readonly expression: VoiceExpression;
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

export interface MonVoiceTables {
  readonly provider: 'elevenlabs';
  readonly model: string;
  /** Every lineage voice, in slot order within each `<lineKey>/<gender>` pool. */
  readonly lineages: readonly LineageVoice[];
  /** Frequency multiplier per stage; null is silent (an Egg). */
  readonly stagePitch: Readonly<Record<LifecycleStage, number | null>>;
  readonly moods: Readonly<Record<MonMood, MoodDelivery>>;
  readonly defaultDelivery: MoodDelivery;
  readonly lowEnergy: { readonly moods: readonly MonMood[]; readonly styleFactor: number; readonly maxSpeed: number };
}

export interface MonLingo {
  readonly locale: string;
  readonly lines: readonly MonLineEntry[];
  readonly pronunciations: readonly PronunciationEntry[];
  readonly stageDirections: readonly StageDirectionEntry[];
  readonly guide: readonly LingoGuideEntry[];
  /** Babble sounds. Empty in lingo served before the babble rows; readers then use the fallback's. */
  readonly babble: readonly BabbleEntry[];
  readonly voices: MonVoiceTables;
}

export const DEFAULT_LINGO_LOCALE = 'en-US';

const STAGE_FIELD: Readonly<Record<LifecycleStage, keyof MonVoicesDoc['stagePitch']>> = { Egg: 'egg', Baby: 'baby', Small: 'small', Mid: 'mid', Max: 'max' };

function splitPipes(value: string | null | undefined): string[] {
  return (value ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function isStage(value: unknown): value is LifecycleStage {
  return (LIFECYCLE_STAGES as readonly unknown[]).includes(value);
}

function isMood(value: unknown): value is MonMood {
  return (MON_MOODS as readonly unknown[]).includes(value);
}

/** Canon only: published (Payload drafts are not) and active. */
export function isServedRow(row: LexiconRow): boolean {
  return row.active && row._status === 'published';
}

function byOrderThenKey(a: LexiconRow, b: LexiconRow): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

function lineageOrder(a: LineageVoice, b: LineageVoice): number {
  const [aLine, aGender, aSlot] = a.lineageId.split('/');
  const [bLine, bGender, bSlot] = b.lineageId.split('/');
  if (aLine !== bLine) return (aLine ?? '') < (bLine ?? '') ? -1 : 1;
  if (aGender !== bGender) return (aGender ?? '') < (bGender ?? '') ? -1 : 1;
  return Number(aSlot) - Number(bSlot);
}

function delivery(tag: string | null | undefined, stability: number, similarityBoost: number): MoodDelivery {
  return { tag: nonEmpty(tag), settings: { stability, similarity_boost: similarityBoost } };
}

/**
 * Turns `language-lexicon` rows and the `mon-voices` global into the voice's
 * tables. The server runs it on Payload's documents; the offline fallback runs
 * it on the seed. Rows that are drafts, inactive, in another locale or in a
 * category the voice does not read are left out.
 */
export function monLingoFromRows(rows: readonly LexiconRow[], voices: MonVoicesDoc, locale: string = DEFAULT_LINGO_LOCALE): MonLingo {
  const served = rows.filter((row) => isServedRow(row) && (row.locale ?? DEFAULT_LINGO_LOCALE) === locale).sort(byOrderThenKey);

  const lines: MonLineEntry[] = [];
  const pronunciations: PronunciationEntry[] = [];
  const stageDirections: StageDirectionEntry[] = [];
  const guide: LingoGuideEntry[] = [];
  const babble: BabbleEntry[] = [];
  for (const row of served) {
    switch (row.category) {
      case 'mon-line': {
        const text = nonEmpty(row.responseText) ?? nonEmpty(row.canonicalText);
        const occasion = nonEmpty(row.triggerText);
        if (text === undefined || occasion === undefined || !nonEmpty(row.speciesId) || !isStage(row.stage)) break;
        lines.push({ key: row.key, speciesId: row.speciesId!.trim(), stage: row.stage, occasion, text, mood: isMood(row.mood) ? row.mood : null });
        break;
      }
      case 'pronunciation': {
        const spoken = nonEmpty(row.spokenForm);
        if (spoken === undefined) break;
        pronunciations.push({ key: row.key, written: row.canonicalText.trim(), variants: splitPipes(row.variants), spoken, spokenPlural: nonEmpty(row.spokenPlural) ?? null });
        break;
      }
      case 'stage-direction': {
        const tag = nonEmpty(row.spokenForm);
        const keywords = splitPipes(row.variants);
        if (tag === undefined || keywords.length === 0) break;
        stageDirections.push({ key: row.key, tag, keywords });
        break;
      }
      case 'word-palette':
      case 'voice-rule':
        guide.push({
          key: row.key,
          category: row.category,
          subcategory: nonEmpty(row.subcategory) ?? null,
          text: row.canonicalText,
          meaning: row.meaning,
          policy: row.activationPolicy,
          bloodlineId: nonEmpty(row.bloodlineId) ?? null,
          speciesId: nonEmpty(row.speciesId) ?? null,
          stage: isStage(row.stage) ? row.stage : null,
          mood: isMood(row.mood) ? row.mood : null,
          trigger: nonEmpty(row.triggerText) ?? null,
        });
        break;
      case 'babble': {
        const text = nonEmpty(row.canonicalText)?.toLowerCase();
        const kind = row.subcategory?.trim();
        // Letters only; the speech gate re-checks every entry against its real-word list.
        if (text === undefined || !/^[a-z]{1,10}$/.test(text) || (kind !== 'syllable' && kind !== 'family-sound' && kind !== 'egg-sound')) break;
        babble.push({ key: row.key, kind, text, bloodlineId: nonEmpty(row.bloodlineId) ?? null });
        break;
      }
      default:
        break;
    }
  }

  const defaultDelivery = delivery(voices.defaultDelivery.tag, voices.defaultDelivery.stability, voices.defaultDelivery.similarityBoost);
  const moods = Object.fromEntries(
    MON_MOODS.map((mood) => {
      const doc = voices.moods.find((entry) => entry.mood === mood);
      return [mood, doc === undefined ? defaultDelivery : delivery(doc.tag, doc.stability, doc.similarityBoost)];
    }),
  ) as Record<MonMood, MoodDelivery>;
  const stagePitch = Object.fromEntries(
    LIFECYCLE_STAGES.map((stage) => {
      const factor = voices.stagePitch[STAGE_FIELD[stage]];
      return [stage, typeof factor === 'number' && Number.isFinite(factor) && factor > 0 ? factor : null];
    }),
  ) as Record<LifecycleStage, number | null>;

  return {
    locale,
    lines,
    pronunciations,
    stageDirections,
    guide,
    babble,
    voices: {
      provider: voices.provider,
      model: voices.model,
      lineages: voices.lineages
        .map((voice) => ({ lineageId: voice.lineageId, elevenLabsVoiceId: voice.voiceId, name: voice.name, expression: { style: voice.style, speed: voice.speed } }))
        .sort(lineageOrder),
      stagePitch,
      moods,
      defaultDelivery,
      lowEnergy: { moods: voices.lowEnergy.moods.filter(isMood), styleFactor: voices.lowEnergy.styleFactor, maxSpeed: voices.lowEnergy.maxSpeed },
    },
  };
}

// --- Reading served JSON -----------------------------------------------------

/** More babble rows than a served lingo may carry; a longer list is malformed. */
export const MAX_BABBLE_ROWS = 200;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

function isDelivery(v: unknown): v is MoodDelivery {
  return isObj(v) && (v.tag === undefined || isStr(v.tag)) && isObj(v.settings) && isNum(v.settings.stability) && isNum(v.settings.similarity_boost);
}

/**
 * Reads `GET /v1/mon-lingo`'s `data` from untrusted JSON. Undefined when any
 * table is malformed, so a client keeps the lingo it had (or the fallback)
 * instead of speaking with half a table.
 */
export function parseMonLingo(value: unknown): MonLingo | undefined {
  if (!isObj(value) || !isStr(value.locale) || !isObj(value.voices)) return undefined;
  const { lines, pronunciations, stageDirections, guide, voices } = value;
  if (!Array.isArray(lines) || !lines.every((l) => isObj(l) && isStr(l.key) && isStr(l.speciesId) && isStage(l.stage) && isStr(l.occasion) && isStr(l.text) && (l.mood === null || isMood(l.mood)))) return undefined;
  if (!Array.isArray(pronunciations) || !pronunciations.every((p) => isObj(p) && isStr(p.key) && isStr(p.written) && isStrArr(p.variants) && isStr(p.spoken) && isStrOrNull(p.spokenPlural))) return undefined;
  if (!Array.isArray(stageDirections) || !stageDirections.every((d) => isObj(d) && isStr(d.key) && isStr(d.tag) && isStrArr(d.keywords) && d.keywords.length > 0)) return undefined;
  if (!Array.isArray(guide) || !guide.every((g) => isObj(g) && isStr(g.key) && (g.category === 'word-palette' || g.category === 'voice-rule') && isStr(g.text))) return undefined;
  // A server from before the babble rows sends no `babble`: read it as empty.
  const babble = value.babble === undefined ? [] : value.babble;
  if (!Array.isArray(babble) || babble.length > MAX_BABBLE_ROWS || !babble.every((b) => isObj(b) && isStr(b.key) && isStr(b.text) && (b.kind === 'syllable' || b.kind === 'family-sound' || b.kind === 'egg-sound') && isStrOrNull(b.bloodlineId))) return undefined;
  if (voices.provider !== 'elevenlabs' || !isStr(voices.model) || !Array.isArray(voices.lineages)) return undefined;
  if (!voices.lineages.every((l) => isObj(l) && isStr(l.lineageId) && isStr(l.elevenLabsVoiceId) && isStr(l.name) && isObj(l.expression) && isNum(l.expression.style) && isNum(l.expression.speed))) return undefined;
  const { stagePitch, moods, defaultDelivery, lowEnergy } = voices;
  if (!isObj(stagePitch) || !LIFECYCLE_STAGES.every((s) => stagePitch[s] === null || isNum(stagePitch[s]))) return undefined;
  if (!isObj(moods) || !MON_MOODS.every((m) => isDelivery(moods[m])) || !isDelivery(defaultDelivery)) return undefined;
  if (!isObj(lowEnergy) || !Array.isArray(lowEnergy.moods) || !lowEnergy.moods.every(isMood) || !isNum(lowEnergy.styleFactor) || !isNum(lowEnergy.maxSpeed)) return undefined;
  return { ...(value as unknown as MonLingo), babble: babble as BabbleEntry[] };
}
