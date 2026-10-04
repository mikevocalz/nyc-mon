export { assertNever } from './assert-never.ts';
export { type BootRoute, type BootSave, type BootSnapshot, type OnboardingStep, resolveBootRoute } from './boot.ts';
export {
  CALLER_NAME_MAX_LENGTH,
  type CallerNameErrorCopyId,
  callerNameErrorCopyId,
  type CallerNameFilter,
  type CallerNameRejection,
  type CallerNameResult,
  isStoredCallerName,
  validateCallerName,
} from './caller-name.ts';
export {
  type ActResult,
  type AdvanceResult,
  advanceCare,
  applyCareAction,
  type CareOutcome,
  createInitialCareState,
  listUnmetNeeds,
} from './care.ts';
export { CONSENT_AGE_YEARS, type ConsentCheck, isConsentRequired, utcYearFromEpochMs } from './consent.ts';
export { applyEvolution, type EvolutionResult, type FeatureFlags, PHASE1_FEATURE_FLAGS } from './evolution.ts';
export {
  createEggRecord,
  type CreateEggInput,
  createHatchState,
  deriveMonInstanceId,
  HatchIntegrityError,
  type HatchEvent,
  mintMonInstance,
  resolveHatch,
  transitionHatch,
} from './hatch.ts';
export {
  acknowledgeWrites,
  applyCareWrites,
  createWriteQueue,
  enqueueCareWrite,
  reconcileWithServer,
  type ServerCareRecord,
} from './queue.ts';
export { type CreateEntry, type CreateEntryInput, resolveCreateEntry } from './onboarding.ts';
export { createRandom, hash128, mixSeed } from './random.ts';
export type { ActivitySpan, CareEvent, SimState } from './state.ts';
export { step, type StepOptions, type StepResult } from './step.ts';
export { type CareTuning, type DecayCurve, DEFAULT_CARE_TUNING, HATCHLING_CARE } from './tuning.ts';
export {
  DEFAULT_VIGNETTE_FIRE_CHANCE,
  DEFAULT_VIGNETTE_SLOT_MS,
  scheduleIdleVignettes,
  type ScheduledVignette,
  type VignetteScheduleOptions,
  vignetteWeight,
} from './vignettes.ts';
