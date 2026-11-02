import type { LifecycleStage } from '@acme/core';

/**
 * What a Mon says out loud in the app, by occasion. Canon only (COPY_DECK
 * "Two voices": a `character` string comes from canon or ships empty), so an
 * occasion with no canon line returns undefined and the Mon stays quiet.
 *
 * - `hello`: the Caller taps the Mon on the H-Lynk, or comes back to it (M13).
 * - `first-words`: the hatched Baby's first look at the Caller (M12).
 * - `hungry`: a tap while the Mon is asking for food (M13).
 *
 * Source today: OPEN_QUESTIONS Q32, partly answered 2026-10-23 by Mike for the
 * Hood Ratti line only. A Squeaklet uses the family sound plus at most two
 * words ("Bet!", "Food?"), never a sentence, and no "Callah" yet. The other
 * lines, and every later stage, wait on canon.
 */
export const MON_LINE_OCCASIONS = ['hello', 'first-words', 'hungry'] as const;
export type MonLineOccasion = (typeof MON_LINE_OCCASIONS)[number];

/** The Mon a line is for: its current form and stage. */
export interface MonLineSubject {
  readonly speciesId: string;
  readonly stage: LifecycleStage;
}

/** dex-002 is the Squeaklet, the Hood Ratti Baby (mons/hood-ratti.ts). */
const CANON_LINES: Readonly<Record<string, { readonly stage: LifecycleStage; readonly lines: Readonly<Partial<Record<MonLineOccasion, string>>> }>> = {
  'dex-002': { stage: 'Baby', lines: { hello: 'Bet!', 'first-words': 'Bet!', hungry: 'Food?' } },
};

/** The canon line for `occasion`, or undefined when canon has none for this Mon. */
export function monLine(occasion: MonLineOccasion, mon: MonLineSubject): string | undefined {
  const entry = CANON_LINES[mon.speciesId];
  if (entry === undefined || entry.stage !== mon.stage) return undefined;
  return entry.lines[occasion];
}
