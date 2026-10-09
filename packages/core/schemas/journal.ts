import { z } from 'zod';
import { EpochMsSchema, IdSchema } from './primitives.ts';

/**
 * What a journal entry records (M18). Each kind is something that happened:
 * the hatch, the naming, a meal, a nap, a game of Peek, waking up rested.
 * There is deliberately no kind for absence, a missed day, a low meter, a
 * request or a declined action (D-15a): the journal never logs what did not happen.
 */
export const JOURNAL_ENTRY_KINDS = ['hatched', 'named', 'fed', 'rested', 'played', 'woke-rested'] as const;

export const JournalEntryKindSchema = z.enum(JOURNAL_ENTRY_KINDS);

/**
 * One entry in a Mon's journal (M18). Appended by the Mon store on the
 * matching action; never edited or removed, so the "days together" count
 * can only rise. `first` marks the first entry of its kind for this Mon
 * ("first meal", "first nap", "first game").
 */
export const JournalEntrySchema = z.object({
  entryId: IdSchema,
  monInstanceId: IdSchema,
  at: EpochMsSchema,
  kind: JournalEntryKindSchema,
  /** True on the first entry of this kind for this Mon. */
  first: z.boolean(),
});
