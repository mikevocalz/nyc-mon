import { z } from 'zod';
import { EpochMsSchema, IdSchema, UnitIntervalSchema } from '@acme/core';

/**
 * Per-person grants the Caller sets on a FamiliarPerson. `care` covers
 * heal/inventory mutations; `feed` is separate because the demo hangs on it
 * (James may talk and play but cannot feed Mike's rare item).
 */
export const PermissionSchema = z.object({
  talk: z.boolean(),
  play: z.boolean(),
  feed: z.boolean(),
  care: z.boolean(),
});
export type Permission = z.infer<typeof PermissionSchema>;

export const DEFAULT_FAMILIAR_PERMISSIONS: Permission = {
  talk: true,
  play: true,
  feed: false,
  care: false,
};

/**
 * A consented, self-enrolled voice in a Caller's circle. The embedding lives in
 * an encrypted store keyed by `voicePrintRef`; enrollment audio is never kept
 * (ADR 0007). Persistence lands in a `familiar-people` Payload collection —
 * TODO, deliberately not created in this scaffold.
 */
export const FamiliarPersonSchema = z.object({
  personId: IdSchema,
  /** The Caller whose circle this person belongs to. */
  callerId: IdSchema,
  displayName: z.string().min(1).max(64),
  relationship: z.string().max(64).nullable(),
  permissions: PermissionSchema,
  enrolledAt: EpochMsSchema,
  /** Self-enrollment only — never 'other' (build prompt, hard do-not). */
  enrolledBy: z.literal('self'),
  /** Opaque pointer to the encrypted speaker embedding, never audio. */
  voicePrintRef: IdSchema,
  /** Alexa Voice ID personId, only when the person linked it themselves. */
  alexaVoiceIdHint: z.string().max(128).nullable(),
});
export type FamiliarPerson = z.infer<typeof FamiliarPersonSchema>;

/** Where a presence signal came from. Echo ambient audio is never a source. */
export const PresenceSourceSchema = z.enum(['app-vad', 'web-vad', 'alexa-voice-id']);
export type PresenceSource = z.infer<typeof PresenceSourceSchema>;

/**
 * One detection emitted by the NYC-Mon app/web presence pipeline and fanned out
 * over Supabase Realtime (ADR 0007).
 */
export const PresenceEventSchema = z.object({
  eventId: IdSchema,
  personId: IdSchema,
  callerId: IdSchema,
  confidence: UnitIntervalSchema,
  ts: EpochMsSchema,
  source: PresenceSourceSchema,
  /** The Mon the signal was heard near, when the app knows which is active. */
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
