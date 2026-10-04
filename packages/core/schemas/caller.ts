import { z } from 'zod';
import { EpochMsSchema, IdSchema } from './primitives.ts';

/** COPPA path state (§1.5). `not-required` covers Callers 13 and older. */
export const ConsentStatusSchema = z.enum(['not-required', 'pending', 'approved', 'denied']);

/** The human partner. Canon spelling is Caller (Law 9). */
export const CallerProfileSchema = z.object({
  callerId: IdSchema,
  /** What the Caller's Mon calls them (M07). */
  callerName: z.string().min(1).max(32),
  birthYear: z.number().int().min(1900).max(9999),
  consentStatus: ConsentStatusSchema,
  createdAt: EpochMsSchema,
});
