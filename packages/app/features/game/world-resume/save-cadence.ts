import type { WorldPillState } from '@acme/core';

// When a world save is written (Master Directive v2 §3 "Save lifecycle"):
// on a bounded periodic cadence while playing, on pause, on explicit exit
// (stop), on app background. Never per frame: the camera store changes on
// every gesture event and none of those calls reach here; only the ticker
// and the lifecycle events do.
//
// Idempotent by revision. The draft revision is `stored + 1` once anything
// changed since the last commit and `stored` otherwise, so two decisions in
// a row for the same draft write once; the second sees nothing to save.

/** Periodic save interval while playing. 15 s caps a crash at 15 s of lost movement. */
export const SAVE_INTERVAL_MS = 15_000;

/** Mirror of `PillState` in packages/ui/game-controls/contract.ts (lane C owns that file). */
type KitPillState = 'start' | 'playing' | 'paused' | 'stopConfirm';
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// Decision: BUILD the check against a literal mirror. `@acme/ui` exports no
// `./game-controls` entry yet, so the kit type cannot cross the package
// boundary; re-point `KitPillState` at that export once lane C adds it.
const pillStatesMatch: Equals<WorldPillState, KitPillState> = true;
void pillStatesMatch;

/** What asked for a save. `tick` is the interval; the rest are lifecycle events. */
export type SaveTrigger = 'tick' | 'pause' | 'background' | 'stop' | 'exit';

export interface SaveDecisionInput {
  readonly trigger: SaveTrigger;
  readonly pill: WorldPillState;
  /** Epoch ms of the decision. */
  readonly now: number;
  /** `savedAt` of the last committed save, or `null` before the first. */
  readonly lastSavedAt: number | null;
  /** `revision` of the last committed save, 0 before the first. */
  readonly storedRevision: number;
  /** The revision the in-memory draft would be written as; see {@linkcode draftRevision}. */
  readonly draftRevision: number;
}

export type SaveDecision =
  | { readonly save: true; readonly revision: number }
  | { readonly save: false; readonly why: 'unchanged' | 'not-playing' | 'interval-not-elapsed' };

/** `stored + 1` once anything changed since the last commit; `stored` while nothing did. */
export function draftRevision(storedRevision: number, changedSinceCommit: boolean): number {
  return changedSinceCommit ? storedRevision + 1 : storedRevision;
}

/**
 * The one place that says yes or no to a write. Lifecycle triggers save as
 * soon as the draft is dirty, whatever the interval says; the tick saves
 * only while playing and only once per interval.
 */
export function decideSave(input: SaveDecisionInput): SaveDecision {
  if (input.draftRevision <= input.storedRevision) return { save: false, why: 'unchanged' };
  if (input.trigger !== 'tick') return { save: true, revision: input.draftRevision };
  if (input.pill !== 'playing') return { save: false, why: 'not-playing' };
  if (input.lastSavedAt !== null && input.now - input.lastSavedAt < SAVE_INTERVAL_MS) {
    return { save: false, why: 'interval-not-elapsed' };
  }
  return { save: true, revision: input.draftRevision };
}

/** Where a failed write is reported. The default logs; a test passes its own. */
export type SaveFailureReporter = (where: 'tick' | 'background' | 'exit', error: unknown) => void;

const reportToConsole: SaveFailureReporter = (where, error) => {
  console.error(`[world-save] ${where} write failed`, error);
};

/**
 * Runs one save step and reports a throw instead of letting it escape (review
 * finding L4). `commit` parses with the schema and throws on a bad save; a
 * throw inside `setInterval` or the AppState listener would otherwise vanish
 * and the next tick would hit the same wall with no trace. The cadence keeps
 * running after a failure.
 */
export function guardedSave(where: 'tick' | 'background' | 'exit', run: () => void, report: SaveFailureReporter = reportToConsole): void {
  try {
    run();
  } catch (error) {
    report(where, error);
  }
}
