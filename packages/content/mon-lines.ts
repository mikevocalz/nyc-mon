import type { LifecycleStage, MonMood } from '@acme/core';
import { FALLBACK_MON_LINGO, type MonLingo } from './lingo/index.ts';

/**
 * What a Mon says out loud in the app, by occasion. Canon only (COPY_DECK
 * "Two voices": a `character` string comes from canon or ships empty), so an
 * occasion with no canon line returns undefined and the Mon stays quiet.
 *
 * - `hello`: the Caller taps the Mon on the H-Lynk, or comes back to it (M13).
 * - `first-words`: the hatched Baby's first look at the Caller (M12).
 * - `hungry`: a tap while the Mon is asking for food (M13).
 *
 * The lines live in Payload: `language-lexicon` rows in category `mon-line`,
 * published (canon) only, served by `GET /v1/mon-lingo`. Pass the served
 * `lingo`; without it the seed answers (offline and tests). Today the seed has
 * the Squeaklet's "Bet!" and "Food?" (OPEN_QUESTIONS Q32, Mike, 2026-10-23).
 */
export const MON_LINE_OCCASIONS = ['hello', 'first-words', 'hungry'] as const;
export type MonLineOccasion = (typeof MON_LINE_OCCASIONS)[number];

/** The Mon a line is for: its current form and stage, and its mood when known. */
export interface MonLineSubject {
  readonly speciesId: string;
  readonly stage: LifecycleStage;
  readonly mood?: MonMood;
}

/**
 * The canon line for `occasion`, or undefined when canon has none for this
 * Mon. A line written for the Mon's mood wins over one written for any mood.
 */
export function monLine(occasion: MonLineOccasion, mon: MonLineSubject, lingo: MonLingo = FALLBACK_MON_LINGO): string | undefined {
  const candidates = lingo.lines.filter((line) => line.occasion === occasion && line.speciesId === mon.speciesId && line.stage === mon.stage);
  const forMood = mon.mood === undefined ? undefined : candidates.find((line) => line.mood === mon.mood);
  return (forMood ?? candidates.find((line) => line.mood === null))?.text;
}
