import type { EvolutionEvent } from '../types/index.ts';
import { type ClassicTuning, DEFAULT_CLASSIC_TUNING } from './classic-tuning.ts';
import type { FeatureFlags } from './evolution.ts';
import type {
  CareHistory,
  ClassicOptions,
  Hearts,
  MonCareAction,
  MonCareOutcome,
  MonCareResult,
  MonCareState,
  MonCareView,
  StepMonCareOptions,
} from './mon-care-types.ts';

const pending = (name: string): Error => new Error(`${name}: lane (b) implementation pending`);

/** The tick. Advances care, then classic, over unpaused spans only. Deterministic in (state, now, options). */
export function stepMonCare(state: MonCareState, now: number, options: StepMonCareOptions): MonCareResult {
  void state;
  void now;
  void options;
  throw pending('stepMonCare');
}

/** Applies one Caller action at `at` (advancing first). An `at` before the state's clock applies at the clock. */
export function applyMonCareAction(
  state: MonCareState,
  action: MonCareAction,
  at: number,
  options: ClassicOptions,
): MonCareResult & { readonly outcome: MonCareOutcome } {
  void state;
  void action;
  void at;
  void options;
  throw pending('applyMonCareAction');
}

/** 0..4 hearts for a 0..1 meter. 0 only at the very bottom; 4 at or above 0.875. */
export function heartsFor(value: number): Hearts {
  if (!(value > 0)) return 0;
  const quarters = Math.floor(value * 4 + 0.5);
  return quarters >= 4 ? 4 : quarters <= 1 ? 1 : quarters === 2 ? 2 : 3;
}

/** Everything the screen, widget and notifications read, as of `now`. */
export function selectMonCareView(state: MonCareState, now: number, options: ClassicOptions): MonCareView {
  void state;
  void now;
  void options;
  throw pending('selectMonCareView');
}

/** Predicted REAL call openings in (now, now + horizonMs], assuming no Caller action. False calls are never predicted. */
export function predictRealCalls(
  state: MonCareState,
  now: number,
  horizonMs: number,
  options: ClassicOptions,
): readonly { readonly kind: 'hunger' | 'energy' | 'social' | 'cold' | 'bedtime'; readonly at: number }[] {
  void state;
  void now;
  void horizonMs;
  void options;
  throw pending('predictRealCalls');
}

/** The care history that picks an evolution branch. */
export function careHistoryOf(state: MonCareState, tuning: ClassicTuning = DEFAULT_CLASSIC_TUNING): CareHistory {
  void state;
  void tuning;
  throw pending('careHistoryOf');
}

/** Picks the branch among authored canon events. Never invents a target form. */
export function chooseEvolutionBranch(candidates: readonly EvolutionEvent[], history: CareHistory): EvolutionEvent | null {
  void candidates;
  void history;
  throw pending('chooseEvolutionBranch');
}

/** Q43 trigger: unpaused stage age, bond and the feature flag. */
export function evolutionReady(
  state: MonCareState,
  events: readonly EvolutionEvent[],
  flags: FeatureFlags,
  tuning: ClassicTuning = DEFAULT_CLASSIC_TUNING,
): EvolutionEvent | null {
  void state;
  void events;
  void flags;
  void tuning;
  throw pending('evolutionReady');
}
