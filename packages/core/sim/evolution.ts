import type { EvolutionEvent, LifecycleStage, MonInstance } from '../types/index.ts';

/** Phase 1 ships Egg → Baby only (Law 7). */
export interface FeatureFlags {
  readonly evolutionEnabled: boolean;
}

export const PHASE1_FEATURE_FLAGS: FeatureFlags = { evolutionEnabled: false };

const NEXT_STAGE: Readonly<Record<LifecycleStage, LifecycleStage | null>> = {
  Egg: 'Baby',
  Baby: 'Small',
  Small: 'Mid',
  Mid: 'Max',
  Max: null,
};

export type EvolutionResult =
  | { readonly kind: 'evolved'; readonly mon: MonInstance }
  | {
      readonly kind: 'blocked';
      readonly reason: 'feature-disabled' | 'stage-mismatch' | 'species-mismatch' | 'not-adjacent' | 'bond-too-low';
    };

/**
 * The only path that changes `stage`. Requires an authored EvolutionEvent and
 * the feature flag. Keeps `monInstanceId`, bond, nickname and voice lineage.
 */
export function applyEvolution(mon: MonInstance, event: EvolutionEvent, flags: FeatureFlags): EvolutionResult {
  if (!flags.evolutionEnabled) return { kind: 'blocked', reason: 'feature-disabled' };
  if (event.fromStage !== mon.stage) return { kind: 'blocked', reason: 'stage-mismatch' };
  if (event.speciesId !== mon.speciesId) return { kind: 'blocked', reason: 'species-mismatch' };
  if (NEXT_STAGE[event.fromStage] !== event.toStage) return { kind: 'blocked', reason: 'not-adjacent' };
  if (mon.bond < event.minBond) return { kind: 'blocked', reason: 'bond-too-low' };
  return { kind: 'evolved', mon: { ...mon, stage: event.toStage, speciesId: event.toSpeciesId ?? mon.speciesId } };
}
