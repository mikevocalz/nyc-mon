import type { LifecycleStage, MonMood } from '@acme/core';

/**
 * The Mon's lines and lingo as Payload stores them. Payload is the source of
 * truth: the `language-lexicon` collection holds every word (lines,
 * pronunciations, stage directions, the word palette, voice rules) and the
 * `mon-voices` global holds the voice casting and delivery numbers. These types
 * mirror those documents field for field, so one function
 * (`monLingoFromRows`) turns either the Payload documents or the seed below
 * into the tables the voice planner reads.
 */

export const LEXICON_ENTRY_TYPES = ['lexicon', 'pronunciation_rule', 'grammar_rule', 'call_response', 'ballroom_term', 'style_rule'] as const;
export type LexiconEntryType = (typeof LEXICON_ENTRY_TYPES)[number];

/**
 * The `category` values the voice reads. Rows in any other category are kept
 * in the lexicon for writers but never reach a voice or a prompt.
 *
 * - `mon-line`: a line the Mon says (`call_response`). `triggerText` is the
 *   occasion (`hello`, `hungry`…), `responseText` the line.
 * - `pronunciation`: a word the voice says differently from the screen.
 *   `canonicalText` is the screen form, `variants` the other written forms,
 *   `spokenForm` what the voice reads.
 * - `stage-direction`: a `*direction*` the voice performs as an audio tag.
 *   `variants` are the keywords that pick it, `spokenForm` the tag.
 * - `word-palette`, `voice-rule`: guidance for a model writing the Mon's
 *   lines (the Agent Skill, the companion prompt). Served, never spoken.
 */
export const MON_LINGO_CATEGORIES = ['mon-line', 'pronunciation', 'stage-direction', 'word-palette', 'voice-rule'] as const;
export type MonLingoCategory = (typeof MON_LINGO_CATEGORIES)[number];

/** Payload's draft state; only `published` rows are canon and served. */
export type LexiconStatus = 'draft' | 'published';

/** One `language-lexicon` document, the fields the Mon's voice reads plus the editorial ones the seed fills. */
export interface LexiconRow {
  readonly key: string;
  readonly entryType: LexiconEntryType;
  readonly canonicalText: string;
  readonly spokenForm?: string | null;
  readonly meaning: string;
  readonly category: string;
  readonly subcategory?: string | null;
  readonly register?: string | null;
  readonly tone?: string | null;
  readonly ttsPronunciation?: string | null;
  readonly pronunciationNotes?: string | null;
  readonly triggerText?: string | null;
  readonly responseText?: string | null;
  readonly activationPolicy: string;
  readonly avoidWhen?: string | null;
  readonly sourceBasis?: string | null;
  readonly sourceUrl?: string | null;
  readonly editorNotes?: string | null;
  readonly active: boolean;
  /** Mon voice fields (added 2026-10-28). Empty means "every Mon". */
  readonly speciesId?: string | null;
  readonly bloodlineId?: string | null;
  readonly stage?: LifecycleStage | null;
  readonly mood?: MonMood | null;
  /** Pipe-delimited other written forms or keywords, like `communityTags`. */
  readonly variants?: string | null;
  readonly spokenPlural?: string | null;
  /** Lower first. Stage directions: the first keyword match wins. */
  readonly sortOrder?: number | null;
  readonly locale?: string | null;
  readonly _status?: LexiconStatus | null;
}

/** One voice actor bound to one lineage slot (`mon-voices.lineages`). */
export interface LineageVoiceDoc {
  readonly lineageId: string;
  readonly voiceId: string;
  readonly name: string;
  readonly style: number;
  readonly speed: number;
}

export interface MoodDeliveryDoc {
  readonly mood: MonMood;
  readonly tag?: string | null;
  readonly stability: number;
  readonly similarityBoost: number;
}

/** The `mon-voices` global. */
export interface MonVoicesDoc {
  readonly provider: 'elevenlabs';
  readonly model: string;
  readonly lineages: readonly LineageVoiceDoc[];
  /** Pitch factor per stage; null is silent. */
  readonly stagePitch: { readonly egg?: number | null; readonly baby?: number | null; readonly small?: number | null; readonly mid?: number | null; readonly max?: number | null };
  readonly moods: readonly MoodDeliveryDoc[];
  readonly defaultDelivery: { readonly tag?: string | null; readonly stability: number; readonly similarityBoost: number };
  readonly lowEnergy: { readonly moods: readonly MonMood[]; readonly styleFactor: number; readonly maxSpeed: number };
}
