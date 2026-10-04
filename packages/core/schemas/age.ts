import { z } from 'zod';
import { EpochMsSchema } from './primitives.ts';

/** Earliest birth year M04 and the server accept (ADR 0001; `m04.error.too_early` below it). */
export const MIN_BIRTH_YEAR = 1900;

/** A birth year as M04 stores it and the server receives it. The upper bound is checked against the clock by the caller. */
export const BirthYearSchema = z.number().int().min(MIN_BIRTH_YEAR).max(9999);

/**
 * The stored M04 answer: persisted by the app's age slice (MMKV) and parsed
 * with this schema on read (Law 5). Asked once; P1 routes depend on it.
 */
export const AgeAnswerSchema = z.object({
  birthYear: BirthYearSchema,
  answeredAtMs: EpochMsSchema,
});
