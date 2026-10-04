import type { IdleVignetteDef } from '../types/index.ts';
import { createRandom, mixSeed } from './random.ts';
import type { ActivitySpan } from './state.ts';

/** One scheduled idle vignette for the renderer's AnimationMixer (§3.2). */
export interface ScheduledVignette {
  readonly vignetteId: string;
  readonly startAt: number;
  readonly slot: number;
}

export interface VignetteScheduleOptions {
  /** Species vignettes plus any authored for this individual. */
  readonly table: readonly IdleVignetteDef[];
  readonly bond: number;
  readonly seed: number;
  readonly timeline: readonly ActivitySpan[];
  /** TODO(canon): pacing is game feel, not canon. */
  readonly slotMs?: number;
  readonly fireChance?: number;
}

export const DEFAULT_VIGNETTE_SLOT_MS = 15_000;
export const DEFAULT_VIGNETTE_FIRE_CHANCE = 0.6;

/** Weight of one vignette at a bond level; 0 means not eligible. */
export function vignetteWeight(def: IdleVignetteDef, bond: number, activity: 'awake' | 'asleep'): number {
  if (bond < def.minBond) return 0;
  if (def.activity !== 'any' && def.activity !== activity) return 0;
  return def.baseWeight + def.bondWeight * bond;
}

/**
 * Seeded idle-vignette schedule. Time is cut into fixed slots on the epoch grid;
 * each slot draws from its own seed, so any window over the same span returns
 * the same vignettes no matter how the span was split.
 */
export function scheduleIdleVignettes(options: VignetteScheduleOptions): ScheduledVignette[] {
  const slotMs = options.slotMs ?? DEFAULT_VIGNETTE_SLOT_MS;
  const fireChance = options.fireChance ?? DEFAULT_VIGNETTE_FIRE_CHANCE;
  const out: ScheduledVignette[] = [];
  for (const span of options.timeline) {
    for (let slot = Math.ceil(span.from / slotMs); slot * slotMs < span.to; slot++) {
      const random = createRandom(mixSeed(options.seed, slot));
      if (random() >= fireChance) continue;
      const weights = options.table.map((def) => vignetteWeight(def, options.bond, span.activity));
      const total = weights.reduce((sum, w) => sum + w, 0);
      if (total <= 0) continue;
      let pick = random() * total;
      let index = 0;
      while (index < weights.length - 1 && pick >= (weights[index] ?? 0)) {
        pick -= weights[index] ?? 0;
        index++;
      }
      const def = options.table[index];
      if (def === undefined) continue;
      out.push({
        vignetteId: def.vignetteId,
        startAt: slot * slotMs + Math.floor(random() * (slotMs / 2)),
        slot,
      });
    }
  }
  return out;
}
