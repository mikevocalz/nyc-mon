import { z } from 'zod';
import { EpochMsSchema, IdSchema, UnitIntervalSchema } from '@acme/core';

/**
 * Per-person grants the Caller sets on a familiar person. `feed` is separate
 * from `play` because the demo hangs on it: James may talk and play but
 * cannot share a meal with Mike's Mon.
 */
export const PermissionSchema = z.object({
  talk: z.boolean(),
  play: z.boolean(),
  feed: z.boolean(),
  rest: z.boolean(),
});
export type Permission = z.infer<typeof PermissionSchema>;

export const DEFAULT_FAMILIAR_PERMISSIONS: Permission = {
  talk: true,
  play: true,
  feed: false,
  rest: false,
};

/**
 * A familiar person in a Caller's circle. In the hackathon build every one is
 * a seeded fictional fixture (ADR 0015 §2): nothing is enrolled, no voiceprint
 * exists, and `fictional` is fixed to `true` so a real person cannot be
 * represented by this type until a consent ADR replaces it.
 */
export const FamiliarPersonSchema = z.object({
  personId: IdSchema,
  /** The Caller whose circle this person belongs to. */
  callerId: IdSchema,
  displayName: z.string().min(1).max(64),
  relationship: z.string().max(64).nullable(),
  permissions: PermissionSchema,
  fictional: z.literal(true),
});
export type FamiliarPerson = z.infer<typeof FamiliarPersonSchema>;

/** Where a presence signal came from. Echo audio is never a source (ADR 0007). */
export const PresenceSourceSchema = z.enum(['simulator', 'app-vad', 'web-vad']);
export type PresenceSource = z.infer<typeof PresenceSourceSchema>;

/** One detection. In the hackathon build only the simulator injects these. */
export const PresenceEventSchema = z.object({
  eventId: IdSchema,
  personId: IdSchema,
  callerId: IdSchema,
  confidence: UnitIntervalSchema,
  ts: EpochMsSchema,
  source: PresenceSourceSchema,
  /** The Mon the signal was heard near, when known. */
  monInstanceId: IdSchema.nullable(),
});
export type PresenceEvent = z.infer<typeof PresenceEventSchema>;

/** Confidence tiers (ADR 0007): the Mon's reaction granularity. */
export const PRESENCE_TIERS = ['present', 'maybe', 'silent'] as const;
export const PresenceTierSchema = z.enum(PRESENCE_TIERS);
export type PresenceTier = z.infer<typeof PresenceTierSchema>;

export const PRESENT_THRESHOLD = 0.9;
export const MAYBE_THRESHOLD = 0.7;
/** A PresenceEvent counts as "in the room" for this long (ADR 0007 §5). */
export const PRESENCE_FRESHNESS_MS = 90_000;

export function presenceTier(confidence: number): PresenceTier {
  if (confidence >= PRESENT_THRESHOLD) return 'present';
  if (confidence >= MAYBE_THRESHOLD) return 'maybe';
  return 'silent';
}
