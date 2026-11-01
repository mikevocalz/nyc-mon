import { z } from 'zod';
import { MonInstanceSchema } from './mon.ts';
import { EpochMsSchema, IdSchema } from './primitives.ts';

/**
 * Cosmetic presentation beats of §3.5, in play order. Skipping any of them
 * never changes state. The egg-native order follows Decision 29: the egg stirs
 * from inside, builds pressure, cracks, bursts, the Baby emerges, then the
 * first look. The sim reads this list for its phase order; nothing else may
 * keep a copy of it.
 */
export const HATCH_PRESENTATION_PHASES = [
  'stir',
  'pressure',
  'crack',
  'burst',
  'emerge',
  'attention',
] as const;

export const HatchPresentationPhaseSchema = z.enum(HATCH_PRESENTATION_PHASES);

/**
 * The phase labels saves v1 and v2 wrote. The first two named the capture case
 * that Decision 29 removed from hatching. Frozen; read only by the v1 and v2
 * save schemas. `migrateV2ToV3` maps `case-open` to `stir` and `scanner` to
 * `pressure`.
 */
export const HATCH_PRESENTATION_PHASES_V2 = [
  'case-open',
  'scanner',
  'crack',
  'burst',
  'emerge',
  'attention',
] as const;

/** The hatch state union, parameterised by the phase enum a save version used. */
function hatchStateSchema<P extends z.ZodType<string>>(phase: P) {
  return z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('incubating'),
      eggId: IdSchema,
      monInstanceId: IdSchema,
      incubationEndsAt: EpochMsSchema,
    }),
    z.object({ kind: z.literal('ready'), eggId: IdSchema, monInstanceId: IdSchema }),
    z.object({
      kind: z.literal('presenting'),
      eggId: IdSchema,
      mon: MonInstanceSchema,
      phase,
      serverConfirmed: z.boolean(),
    }),
    z.object({
      kind: z.literal('hatched'),
      eggId: IdSchema,
      mon: MonInstanceSchema,
      serverConfirmed: z.boolean(),
    }),
  ]);
}

/**
 * Hatch state machine. The individual is committed on the `ready → presenting`
 * edge; every later state carries the same MonInstance.
 */
export const HatchStateSchema = hatchStateSchema(HatchPresentationPhaseSchema);

/** Hatch state as saves v1 and v2 stored it, with the legacy phase labels. Frozen. */
export const HatchStateV2Schema = hatchStateSchema(z.enum(HATCH_PRESENTATION_PHASES_V2));
