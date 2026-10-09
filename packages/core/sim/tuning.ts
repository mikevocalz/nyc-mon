import type { CareNeed } from '../types/index.ts';

/** How a meter falls over time. Both shapes compose exactly across split steps. */
export type DecayCurve =
  | { readonly kind: 'linear'; readonly perHour: number }
  | { readonly kind: 'exponential'; readonly halfLifeHours: number };

/**
 * Every number here is a tunable game-feel parameter, not a canon claim.
 * TODO(canon): the Bible names the three meters and food requests but publishes
 * no rates, thresholds or bond values. Design tunes these; canon may override.
 */
export interface CareTuning {
  readonly awakeDecay: Readonly<Record<CareNeed, DecayCurve>>;
  readonly asleepDecay: Readonly<Record<'fullness' | 'social', DecayCurve>>;
  /**
   * Decay never takes a meter below this "return floor" (D-15d): a Caller
   * who comes back after a day away finds requests, not empty meters. A
   * meter an action already put below the floor stays where it is; decay
   * never raises a value.
   */
  readonly returnFloor: number;
  readonly energyRecoveryPerHourAsleep: number;
  /** Awake and Fullness below this means the Mon requests food. */
  readonly foodRequestBelow: number;
  /** Any meter below this is "needs you" (§4.3 M13: 25%). */
  readonly needsAttentionBelow: number;
  /**
   * A meal overfeeds when Fullness after it (before clamping) would be above
   * this (D-15d: judged on the after-meal value, so M14 can predict "full").
   */
  readonly overfeedAfterMealAbove: number;
  /** Fullness a "Share a meal" feed adds (D-15e: no named foods until `content/food`). */
  readonly sharedMealNutrition: number;
  readonly sluggishDurationMs: number;
  /** Energy drains this many times faster while sluggish. */
  readonly sluggishEnergyDecayMultiplier: number;
  /** Waking with Energy below this is "waking early" (§4.3 M15). */
  readonly earlyWakeEnergyBelow: number;
  readonly earlyWakeSocialCost: number;
  readonly feedBondGain: number;
  readonly answeredRequestBondGain: number;
  readonly playSocialGain: number;
  readonly playBondGain: number;
  readonly playEnergyCost: number;
  readonly playMinEnergy: number;
}

/**
 * Interim Phase-1 tuning (D-15d): slow enough that "needs you" is not the
 * normal state between ordinary check-ins. With the v1 rates Fullness reached
 * needs-you about 2 h after the hatch; with these a fresh Baby (Fullness 0.5)
 * takes 5 h, and a full meter takes 15 h.
 *
 * TODO(canon) Q19: decay rates, recovery, gains and costs.
 * TODO(canon) Q20: `needsAttentionBelow` (kept at the prompt's 25%) and `foodRequestBelow`.
 * TODO(canon) Q21: `returnFloor` (v7 proposes 35 on return; interim 0.2 keeps a
 *   long absence visible as a request, below the needs-you line).
 * TODO(canon) Q25: sleep is manual; `energyRecoveryPerHourAsleep` and the early-wake cost.
 * TODO(canon) Q22–Q24: `sharedMealNutrition` stands in for food content.
 */
export const DEFAULT_CARE_TUNING: CareTuning = {
  awakeDecay: {
    energy: { kind: 'linear', perHour: 1 / 16 },
    fullness: { kind: 'linear', perHour: 1 / 20 },
    social: { kind: 'exponential', halfLifeHours: 12 },
  },
  asleepDecay: {
    fullness: { kind: 'linear', perHour: 1 / 40 },
    social: { kind: 'exponential', halfLifeHours: 36 },
  },
  returnFloor: 0.2,
  energyRecoveryPerHourAsleep: 1 / 3,
  foodRequestBelow: 0.4,
  needsAttentionBelow: 0.25,
  overfeedAfterMealAbove: 1,
  sharedMealNutrition: 0.35,
  sluggishDurationMs: 45 * 60_000,
  sluggishEnergyDecayMultiplier: 2,
  earlyWakeEnergyBelow: 0.6,
  earlyWakeSocialCost: 0.05,
  feedBondGain: 0.005,
  answeredRequestBondGain: 0.01,
  playSocialGain: 0.3,
  playBondGain: 0.02,
  playEnergyCost: 0.1,
  playMinEnergy: 0.1,
};

/** Initial care values for a fresh hatchling. TODO(canon) Q19: hatchling meter values. */
export const HATCHLING_CARE = { energy: 1, fullness: 0.5, social: 0.6 } as const;
