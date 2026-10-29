import { z } from 'zod';
import { EpochMsSchema, IdSchema } from './primitives.ts';

/**
 * Why a Mon is calling (Mike, 2026-10-29: classic attention calls). Five are
 * real needs; `false-call` is the Mon testing the Caller, answered only by
 * discipline.
 */
export const CALL_KINDS = ['hunger', 'energy', 'social', 'cold', 'bedtime', 'false-call'] as const;
export const CallKindSchema = z.enum(CALL_KINDS);

/** One open attention call. At most one per kind is open at a time. */
export const AttentionCallSchema = z.object({
  /** Deterministic: `${monInstanceId}:${kind}:${openedAt}`. */
  callId: IdSchema,
  kind: CallKindSchema,
  openedAt: EpochMsSchema,
  /** Active (unpaused) ms already elapsed; the deadline is 15 min of unpaused time. */
  elapsedMs: z.number().int().nonnegative(),
});

/** A cold. Cured by 2 or 3 doses of medicine; it never ends anything else (Law 8). */
export const ColdSchema = z.object({
  since: EpochMsSchema,
  dosesNeeded: z.number().int().min(2).max(3),
  dosesGiven: z.number().int().min(0),
});

/**
 * The classic care layer for one Mon: local-first, one record per Mon in save
 * v4. Server-replicated care stays in `CareState`; this layer derives call
 * answers from it. There is no health, sickness or death field (Law 8): the
 * worst state is a cold, poop and a count of care mistakes.
 */
export const ClassicCareStateSchema = z.object({
  monInstanceId: IdSchema,
  updatedAt: EpochMsSchema,
  poop: z.number().int().min(0).max(4),
  /** Null while asleep or paused. */
  nextPoopAt: EpochMsSchema.nullable(),
  cold: ColdSchema.nullable(),
  /** 0..4 quarters, shown as a 4-segment bar. */
  discipline: z.number().int().min(0).max(4),
  /** Abstract weight units, integer. */
  weight: z.number().int().min(1),
  lights: z.enum(['on', 'off']),
  /** Open calls, at most one per kind. */
  calls: z.array(AttentionCallSchema),
  /** Count for the current lifecycle stage; reset only by evolution, never by pause. */
  mistakes: z.number().int().nonnegative(),
  /** Lifetime total for the Journal and Dex; never shown as a penalty. */
  mistakesLifetime: z.number().int().nonnegative(),
  stageStartedAt: EpochMsSchema,
  /** Unpaused ms spent in the current stage (the Q43 age clock). */
  stageActiveMs: z.number().int().nonnegative(),
});
