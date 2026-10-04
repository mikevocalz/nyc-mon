import { z } from 'zod';
import { LifecycleStageSchema } from './lifecycle.ts';
import { IdSchema } from './primitives.ts';
import { BloodlineIdSchema } from './species.ts';

/**
 * One form in a Bloodline's evolution tree (DECISIONS.md #12).
 *
 * Shaped after PokeAPI's evolution-chain `chain` node
 * (https://pokeapi.co/docs/v2#evolution-chains: `species`, `evolution_details`,
 * `evolves_to`). The tree is rooted at the Egg; a Mid has one child per Max form.
 *
 * `evolutionDetails` holds `eventId`s of authored EvolutionEvents that can take
 * this form to its children. Empty means TODO(canon): nothing is authored, so
 * nothing can fire (Law 7). Phase 1 ships every list empty.
 */
export const EvolutionNodeSchema = z.object({
  speciesId: IdSchema,
  dexId: z.number().int().positive().nullable(),
  formName: z.string().min(1).nullable(),
  stage: LifecycleStageSchema,
  evolutionDetails: z.array(IdSchema),
  get evolvesTo() {
    return z.array(EvolutionNodeSchema);
  },
});

/** A Dex family as an evolution-chain resource: "Hood Ratti Bloodline" (DECISIONS.md #11, #12). */
export const BloodlineSchema = z.object({
  bloodlineId: BloodlineIdSchema,
  /** The roster's family name, verbatim. UI renders `${bloodlineName} Bloodline`. */
  bloodlineName: z.string().min(1),
  chain: EvolutionNodeSchema,
});
