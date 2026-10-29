import type { LifecycleStage } from '../types/index.ts';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Rates for the classic care layer (Mike, 2026-10-29; Decisions 33-37).
 * Every number here is game feel. TODO(canon): none of these values is named
 * in the v12 Bible; they stay tunable.
 */
export interface ClassicTuning {
  /** Unpaused ms an attention call stays open before it counts as a care mistake. */
  readonly callWindowMs: number;
  /** One pile per this many awake, unpaused ms. */
  readonly poopIntervalMs: number;
  /** Seeded jitter on each poop interval, plus or minus. */
  readonly poopJitterMs: number;
  readonly maxPoop: number;
  /** A pile left longer than this adds cold risk. */
  readonly pileRiskAfterMs: number;
  /** Cold chance per poop interval with no risk factors. */
  readonly coldBaseChance: number;
  /** Added per pile left longer than `pileRiskAfterMs`. */
  readonly coldChancePerOldPile: number;
  /** Added while the weight band is 'over'. */
  readonly coldChanceOverweight: number;
  /** False calls: at most one per this many awake ms (one draw per slot). */
  readonly falseCallSlotMs: number;
  /** Chance a false-call slot opens a false call. */
  readonly falseCallChance: number;
  /** Starting and base weight per stage. weightBand: under < base-2, over > base+4. */
  readonly baseWeight: Readonly<Record<LifecycleStage, number>>;
  readonly underWeightBelowBase: number;
  readonly overWeightAboveBase: number;
  readonly mealWeight: number;
  readonly snackWeight: number;
  readonly playWeight: number;
  /** Local minute of day the Mon goes to sleep on its own. */
  readonly bedtimeMinute: number;
  /** Local minute of day the Mon wakes on its own. */
  readonly wakeMinute: number;
  /** Unpaused stage age before the next stage may fire (Q43 triggers). Null: no next stage. */
  readonly stageMinAgeMs: Readonly<Record<LifecycleStage, number | null>>;
}

export const DEFAULT_CLASSIC_TUNING: ClassicTuning = {
  callWindowMs: 15 * MINUTE_MS,
  poopIntervalMs: 3 * HOUR_MS,
  poopJitterMs: 30 * MINUTE_MS,
  maxPoop: 4,
  pileRiskAfterMs: 2 * HOUR_MS,
  coldBaseChance: 0.02,
  coldChancePerOldPile: 0.08,
  coldChanceOverweight: 0.05,
  falseCallSlotMs: 4 * HOUR_MS,
  falseCallChance: 0.5,
  baseWeight: { Egg: 5, Baby: 5, Small: 10, Mid: 20, Max: 30 },
  underWeightBelowBase: 2,
  overWeightAboveBase: 4,
  mealWeight: 1,
  snackWeight: 2,
  playWeight: 1,
  bedtimeMinute: 21 * 60,
  wakeMinute: 8 * 60,
  stageMinAgeMs: { Egg: null, Baby: 2 * DAY_MS, Small: 5 * DAY_MS, Mid: 10 * DAY_MS, Max: null },
};

/** The food class id that marks a `feed` as a snack (contract §1). */
export const SNACK_FOOD_CLASS_ID = 'snack';

/**
 * Fullness a snack adds. Smaller than a meal (0.35), heavier on weight. Its
 * happy effect rides the server-replayed feed path only (bond gain on feed),
 * so client, server and queue replay agree.
 */
export const SNACK_NUTRITION = 0.1;
