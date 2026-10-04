import { z } from 'zod';
import { EpochMsSchema, IdSchema, UnitIntervalSchema } from './primitives.ts';

/** The three care meters (Bible v11: Energy, Fullness, one Social meter). No more. */
export const CARE_NEEDS = ['energy', 'fullness', 'social'] as const;

export const CareNeedSchema = z.enum(CARE_NEEDS);

export const CareActivitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('awake') }),
  z.object({ kind: z.literal('asleep'), since: EpochMsSchema }),
]);

/** An autonomous request from the Mon. Phase 1 only requests food. */
export const CareRequestSchema = z.object({
  need: z.literal('fullness'),
  since: EpochMsSchema,
});

/**
 * Care state for one individual. There is deliberately no HP, health, sickness
 * or death field (Law 8): the worst a neglected Mon gets is empty meters.
 */
export const CareStateSchema = z.object({
  monInstanceId: IdSchema,
  energy: UnitIntervalSchema,
  fullness: UnitIntervalSchema,
  social: UnitIntervalSchema,
  /** Sim time this state was last advanced to. */
  updatedAt: EpochMsSchema,
  lastFedAt: EpochMsSchema.nullable(),
  lastRestedAt: EpochMsSchema.nullable(),
  lastSocialAt: EpochMsSchema.nullable(),
  activity: CareActivitySchema,
  /** Overfeeding makes a Mon sluggish until this time. Never sick (§4.3 M14). */
  sluggishUntil: EpochMsSchema.nullable(),
  pendingRequest: CareRequestSchema.nullable(),
});

/** Caller actions on the care loop. Server writes carry these (§1.4). */
export const CareActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('feed'),
    foodClassId: IdSchema,
    /** Fullness gained, from the food's content record. */
    nutrition: UnitIntervalSchema,
  }),
  z.object({ kind: z.literal('rest') }),
  z.object({ kind: z.literal('wake') }),
  z.object({
    kind: z.literal('play'),
    /** Mini-game result quality, scales the Social and bond gain. */
    quality: UnitIntervalSchema,
  }),
]);
