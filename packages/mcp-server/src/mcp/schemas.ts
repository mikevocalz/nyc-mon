import { CARE_NEEDS, EpochMsSchema, IdSchema, LifecycleStageSchema, MonMoodSchema, UnitIntervalSchema } from '@acme/core';
import { z } from 'zod';
import { PermissionSchema, PresenceEventSchema, PresenceTierSchema } from '../presence/types.ts';

/**
 * Tool input and output schemas. Names are snake_case and stable: Alexa
 * locks tool signatures after publication (PLATFORM-DOCS §2.11).
 *
 * Canon (Law 8): care has no HP, health or sickness. The care tools map 1:1
 * to the four canon actions: feed (Share a meal, no item), rest, wake, play.
 */

// ---------------------------------------------------------------- inputs ---

const monId = IdSchema.optional().describe(
  "The Mon to act on, from a previous result's mon.monId. Omit to use the Caller's most recently hatched Mon.",
);

/** Simulator-only: registered only in dev mode, because Alexa+ sends no speaker identity. */
export const SpeakerHintSchema = z
  .object({ personId: IdSchema.describe('A familiar person id from get_familiar_people.') })
  .describe('Who the simulator believes is speaking. Needs a fresh presence event to count.');

export const MonIdInput = z.object({ monId });
export const NoInput = z.object({});

/** Optional client-generated UUID, stable for retries of the same action. */
const intentId = z.string().uuid().optional().describe(
  'Unique UUID for this one care action. Reuse only when retrying the same action; omit for a new action.',
);

export function careInput(devMode: boolean) {
  return devMode ? z.object({ monId, intentId, speakerHint: SpeakerHintSchema.optional() }) : z.object({ monId, intentId });
}

export function playInput(devMode: boolean) {
  const quality = UnitIntervalSchema.optional().describe(
    'How well the play went, 0 to 1 (Peek result quality). Scales Social and bond. Defaults to 0.5.',
  );
  return devMode
    ? z.object({ monId, quality, intentId, speakerHint: SpeakerHintSchema.optional() })
    : z.object({ monId, quality, intentId });
}

export const PersonIdInput = z.object({ personId: IdSchema.describe('From get_familiar_people.') });

export const AcknowledgePersonInput = z.object({
  personId: IdSchema,
  acknowledgedAs: z.enum(['greeted', 'hedged', 'ignored']).describe('What the Mon did when it noticed them.'),
});

export const InjectPresenceEventInput = z.object({
  personId: IdSchema,
  confidence: UnitIntervalSchema,
  monInstanceId: IdSchema.nullable().default(null),
});

// --------------------------------------------------------------- outputs ---

export const MonViewSchema = z.object({
  monId: IdSchema,
  name: z.string().nullable().describe('Null until the Caller names it in the app.'),
  speciesId: IdSchema,
  stage: LifecycleStageSchema,
  bond: UnitIntervalSchema,
  hatchedAt: EpochMsSchema,
});

export const CareViewSchema = z.object({
  energy: UnitIntervalSchema,
  fullness: UnitIntervalSchema,
  social: UnitIntervalSchema,
  activity: z.enum(['awake', 'asleep']),
  sluggish: z.boolean().describe('Ate too much recently; declines food and play for a while.'),
  wantsFood: z.boolean().describe('The Mon has asked for a meal.'),
  lastFedAt: EpochMsSchema.nullable(),
});

const NeedsSchema = z.array(z.enum(CARE_NEEDS)).describe('Meters low enough that the Mon needs the Caller.');

export const MonStatusOutput = z.object({
  mon: MonViewSchema,
  care: CareViewSchema,
  mood: MonMoodSchema,
  needs: NeedsSchema,
});

export const CARE_SUGGESTIONS = ['feed', 'rest', 'play', 'wait'] as const;

export const PresentPersonSchema = z.object({
  personId: IdSchema,
  displayName: z.string(),
  tier: PresenceTierSchema,
  confidence: UnitIntervalSchema,
});

export function checkOnMonOutput(devMode: boolean) {
  const base = z.object({
    mon: MonViewSchema,
    mood: MonMoodSchema,
    needs: NeedsSchema,
    suggestedCare: z.array(z.enum(CARE_SUGGESTIONS)).describe('Care that would help most right now, best first.'),
  });
  return devMode ? base.extend({ presentPeople: z.array(PresentPersonSchema) }) : base;
}

export const ActingVoiceOutput = z.object({
  kind: z.enum(['caller', 'familiar', 'unverified']),
  personId: IdSchema.optional(),
  displayName: z.string().optional(),
});

export const CARE_EFFECTS = ['eaten', 'overfed', 'fell-asleep', 'woke', 'woke-early', 'played'] as const;
export const DECLINE_REASONS = ['asleep', 'sluggish', 'already-asleep', 'already-awake', 'too-tired'] as const;

export const CareResultOutput = z.object({
  applied: z.boolean().describe('False when the Mon declined; nothing was written.'),
  effect: z.enum(CARE_EFFECTS).optional(),
  declinedBecause: z.enum(DECLINE_REASONS).optional(),
  mon: MonViewSchema,
  care: CareViewSchema,
  mood: MonMoodSchema,
});

export const IncubationOutput = z.object({
  incubating: z.boolean(),
  eggs: z.array(
    z.object({
      eggId: IdSchema,
      speciesId: IdSchema,
      incubationEndsAt: EpochMsSchema,
      minutesRemaining: z.number().int().nonnegative(),
      readyToHatch: z.boolean(),
    }),
  ),
});

export function talkToMonOutput(devMode: boolean) {
  const base = z.object({
    mon: MonViewSchema,
    mood: MonMoodSchema,
    needs: NeedsSchema,
    activity: z.enum(['awake', 'asleep']),
    wantsFood: z.boolean(),
    speaker: ActingVoiceOutput,
  });
  return devMode ? base.extend({ presentPeople: z.array(PresentPersonSchema) }) : base;
}

export const FamiliarPersonView = z.object({
  personId: IdSchema,
  displayName: z.string(),
  relationship: z.string().nullable(),
  permissions: PermissionSchema,
  fictional: z.literal(true),
});

export const FamiliarPeopleOutput = z.object({ people: z.array(FamiliarPersonView) });
export const PresentPeopleOutput = z.object({ people: z.array(PresentPersonSchema) });
export const PersonRelationshipOutput = z.object({ person: FamiliarPersonView });
export const SharedMemoriesOutput = z.object({
  personId: IdSchema,
  memories: z.array(z.object({ memoryId: IdSchema, summary: z.string(), at: EpochMsSchema })),
});
export const AcknowledgeOutput = z.object({ personId: IdSchema, memoryId: IdSchema, at: EpochMsSchema });
export const PresenceEventOutput = z.object({ event: PresenceEventSchema });
