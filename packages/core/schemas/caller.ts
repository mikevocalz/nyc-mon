import { z } from 'zod';
import { CALLER_NAME_MAX_LENGTH, isStoredCallerName } from '../sim/caller-name.ts';
import { BirthYearSchema } from './age.ts';
import { EpochMsSchema, IdSchema } from './primitives.ts';

/** COPPA path state (§1.5). `not-required` covers Callers 13 and older. */
export const ConsentStatusSchema = z.enum(['not-required', 'pending', 'approved', 'denied']);

/**
 * A stored Caller name: the M07 rule (`validateCallerName`) minus the block
 * list, in trimmed NFC form, at most 16 UTF-16 code units.
 */
export const CallerNameSchema = z
  .string()
  .min(1)
  .max(CALLER_NAME_MAX_LENGTH)
  .refine(isStoredCallerName, { message: 'Caller name fails the M07 name rule' });

/** The human partner. Canon spelling is Caller (Law 9). */
export const CallerProfileSchema = z.object({
  callerId: IdSchema,
  /** What the Caller's Mon calls them (M07). */
  callerName: CallerNameSchema,
  birthYear: BirthYearSchema,
  consentStatus: ConsentStatusSchema,
  createdAt: EpochMsSchema,
});
