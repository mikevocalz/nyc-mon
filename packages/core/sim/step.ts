import type { IdleVignetteDef } from '../types/index.ts';
import { advanceCare } from './care.ts';
import type { CareEvent, SimState } from './state.ts';
import { type CareTuning, DEFAULT_CARE_TUNING } from './tuning.ts';
import { type ScheduledVignette, scheduleIdleVignettes } from './vignettes.ts';

export interface StepOptions {
  readonly tuning?: CareTuning;
  readonly vignettes?: readonly IdleVignetteDef[];
}

export interface StepResult {
  readonly state: SimState;
  readonly events: readonly CareEvent[];
  readonly vignettes: readonly ScheduledVignette[];
}

/**
 * The sim tick: deterministic in `(state, now, seed)`. Advances care to `now`
 * and schedules idle vignettes for the elapsed window. Never changes the
 * lifecycle stage (Law 7) and has no faint or death path (Law 8).
 */
export function step(state: SimState, now: number, seed: number, options: StepOptions = {}): StepResult {
  const advanced = advanceCare(state, now, options.tuning ?? DEFAULT_CARE_TUNING);
  const vignettes = scheduleIdleVignettes({
    table: options.vignettes ?? [],
    bond: state.mon.bond,
    seed,
    timeline: advanced.timeline,
  });
  return { state: advanced.state, events: advanced.events, vignettes };
}
