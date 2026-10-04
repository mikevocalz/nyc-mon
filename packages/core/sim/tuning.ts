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
  readonly energyRecoveryPerHourAsleep: number;
  /** Awake and Fullness below this means the Mon requests food. */
  readonly foodRequestBelow: number;
  /** Any meter below this is "needs you" (§4.3 M13: 25%). */
  readonly needsAttentionBelow: number;
  /** Feeding at or above this Fullness overfeeds. */
  readonly overfeedAtOrAbove: number;
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

export const DEFAULT_CARE_TUNING: CareTuning = {
  awakeDecay: {
    energy: { kind: 'linear', perHour: 1 / 12 },
    fullness: { kind: 'linear', perHour: 1 / 8 },
    social: { kind: 'exponential', halfLifeHours: 6 },
  },
  asleepDecay: {
    fullness: { kind: 'linear', perHour: 1 / 16 },
    social: { kind: 'exponential', halfLifeHours: 18 },
  },
  energyRecoveryPerHourAsleep: 1 / 3,
  foodRequestBelow: 0.4,
  needsAttentionBelow: 0.25,
  overfeedAtOrAbove: 0.9,
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

/** Initial care values for a fresh hatchling. TODO(canon): hatchling meter values. */
export const HATCHLING_CARE = { energy: 1, fullness: 0.5, social: 0.6 } as const;
