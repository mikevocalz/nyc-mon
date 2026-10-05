import { z } from 'zod';
import {
  CareStateSchema,
  IdSchema,
  LifecycleStageSchema,
  MonInstanceSchema,
  UnitIntervalSchema,
} from '@acme/core';
import {
  FamiliarPersonSchema,
  PermissionSchema,
  PresenceEventSchema,
  PresenceTierSchema,
} from '../presence/types.ts';

/**
 * Tool input/output zod schemas for the Alexa+ MCP surface (build prompt
 * §Deliverables-1). Names are snake_case and stable — `alexa-ai new` generates
 * the add-on manifest by introspecting them.
 *
 * Canon note (Law 8): CareState has no HP/health/sickness field, by design.
 * The build prompt's "hunger / mood / health" maps to `fullness`, a derived
 * mood hint, and *nothing* — `heal_mon` is the Nurse Nay soothe flow, never a
 * cure for "sick".
 */

// ---------------------------------------------------------------- inputs ---

export const MonIdInput = z.object({
  monId: IdSchema.optional().describe('Defaults to the Caller’s active Mon.'),
});

export const TalkToMonInput = z.object({
  monId: IdSchema.optional(),
  utterance: z.string().min(1).max(500),
  /** Who Alexa/whichever client believes is speaking; resolved server-side. */
  speakerHint: z
    .object({
      alexaVoiceId: z.string().max(128).optional(),
      personId: IdSchema.optional(),
    })
    .optional(),
});

export const CheckOnMonInput = MonIdInput;

export const FeedMonInput = z.object({
  monId: IdSchema.optional(),
  itemId: IdSchema,
});

export const PlayWithMonInput = z.object({
  monId: IdSchema.optional(),
  activity: z.string().min(1).max(64),
  /** Mini-game quality 0..1, scales Social + bond (CareAction 'play'). */
  quality: UnitIntervalSchema.optional(),
});

export const HealMonInput = MonIdInput;

export const PersonIdInput = z.object({ personId: IdSchema });

export const AcknowledgePersonInput = z.object({
  personId: IdSchema,
  /** What the Mon did with the recognition, for the memory log. */
  acknowledgedAs: z.enum(['greeted', 'hedged', 'ignored']).optional(),
});

export const InjectPresenceEventInput = PresenceEventSchema.omit({ eventId: true }).extend({
  eventId: IdSchema.optional(),
});

// --------------------------------------------------------------- outputs ---

/** Mood is a *derived* hint for the personality layer, not a stored meter. */
export const MonStatusOutput = z.object({
  mon: MonInstanceSchema,
  care: CareStateSchema,
  stage: LifecycleStageSchema,
  bloodlineName: z.string().optional().describe('e.g. "Hood Ratti" — UI builds "<name> Bloodline".'),
  moodHint: z.enum(['content', 'hungry', 'tired', 'lonely', 'sluggish']).optional(),
});

export const InventoryItemOutput = z.object({
  itemId: IdSchema,
  name: z.string(),
  foodClassId: IdSchema.nullable(),
  quantity: z.number().int().nonnegative(),
  rarity: z.enum(['common', 'rare']).optional(),
});

export const InventoryOutput = z.object({ items: z.array(InventoryItemOutput) });
export type InventoryItem = z.infer<typeof InventoryItemOutput>;

export const IncubationOutput = z.object({
  incubating: z.boolean(),
  eggId: IdSchema.optional(),
  incubationEndsAt: z.number().int().nonnegative().optional(),
  minutesRemaining: z.number().nonnegative().optional(),
});

export const PresentPeopleOutput = z.object({
  people: z.array(
    z.object({
      personId: IdSchema,
      displayName: z.string().optional(),
      confidence: UnitIntervalSchema,
      tier: PresenceTierSchema,
      lastSeenAt: z.number().int().nonnegative(),
    }),
  ),
});

export const FamiliarPeopleOutput = z.object({ people: z.array(FamiliarPersonSchema) });

export const PersonRelationshipOutput = z.object({
  person: FamiliarPersonSchema,
  relationship: z.string().nullable(),
  permissions: PermissionSchema,
  /** How well this Mon knows them — TODO(canon): bond-per-person model. */
  familiarity: UnitIntervalSchema.optional(),
});

export const SharedMemoriesOutput = z.object({
  personId: IdSchema,
  memories: z.array(
    z.object({
      memoryId: IdSchema,
      summary: z.string(),
      at: z.number().int().nonnegative(),
    }),
  ),
});

export const CareActionResultOutput = z.object({
  mon: MonInstanceSchema,
  care: CareStateSchema,
  applied: z.boolean(),
});

export const TalkToMonOutput = z.object({
  mon: MonInstanceSchema,
  /** Structured beats for the personality layer — never canned dialogue. */
  context: z.object({
    pendingRequest: z.string().nullable(),
    moodHint: z.string().optional(),
    presentPeople: z.array(IdSchema),
  }),
});

export const PresenceEventOutput = z.object({ event: PresenceEventSchema });
