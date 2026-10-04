import { z } from 'zod';
import { MonInstanceSchema } from './mon.ts';
import { EpochMsSchema, IdSchema } from './primitives.ts';

/** Cosmetic presentation beats of §3.5. Skipping any of them never changes state. */
export const HATCH_PRESENTATION_PHASES = [
  'case-open',
  'scanner',
  'crack',
  'burst',
  'emerge',
  'attention',
] as const;

export const HatchPresentationPhaseSchema = z.enum(HATCH_PRESENTATION_PHASES);

/**
 * Hatch state machine. The individual is committed on the `ready → presenting`
 * edge; every later state carries the same MonInstance.
 */
export const HatchStateSchema = z.discriminatedUnion('kind', [
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
    phase: HatchPresentationPhaseSchema,
    serverConfirmed: z.boolean(),
  }),
  z.object({
    kind: z.literal('hatched'),
    eggId: IdSchema,
    mon: MonInstanceSchema,
    serverConfirmed: z.boolean(),
  }),
]);
