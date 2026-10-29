import type { ClassicCareState, MonInstance } from '../types/index.ts';
import { type ClassicTuning, DEFAULT_CLASSIC_TUNING } from './classic-tuning.ts';

/**
 * A fresh classic-care record: no poop, no cold, no calls, no mistakes, lights
 * on, the stage's base weight, and the stage-age clock starting at `at`.
 */
export function createInitialClassicCare(
  mon: MonInstance,
  at: number,
  tuning: ClassicTuning = DEFAULT_CLASSIC_TUNING,
): ClassicCareState {
  return {
    monInstanceId: mon.monInstanceId,
    updatedAt: at,
    poop: 0,
    nextPoopAt: at + tuning.poopIntervalMs,
    cold: null,
    discipline: 0,
    weight: tuning.baseWeight[mon.stage],
    lights: 'on',
    calls: [],
    mistakes: 0,
    mistakesLifetime: 0,
    stageStartedAt: at,
    stageActiveMs: 0,
  };
}
