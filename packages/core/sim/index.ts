export { assertNever } from './assert-never.ts';
export {
  type BootRoute,
  type BootSave,
  type BootSnapshot,
  type OnboardingStep,
  pendingEggs,
  resolveBootRoute,
} from './boot.ts';
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
  mealNutrition,
  wouldOverfeed,
} from './care.ts';
export {
  CONSENT_AGE_YEARS,
  type ConsentCheck,
  isCallerUnder13,
  isConsentRequired,
  utcYearFromEpochMs,
} from './consent.ts';
export { deriveFirstLook, type FirstLook } from './first-look.ts';
export {
  appendCareToJournal,
  appendJournalEntry,
  countDaysTogether,
  type JournalAppend,
  journalEntryId,
  journalKindForOutcome,
} from './journal.ts';
export {
  isStoredMonName,
  MON_NAME_MAX_LENGTH,
  type MonNameErrorCopyId,
  monNameErrorCopyId,
  type MonNameFilter,
  type MonNameRejection,
  type MonNameResult,
  RESERVED_MON_NAMES,
  validateMonName,
} from './mon-name.ts';
export { PEEK_MIN_QUALITY, peekQuality } from './play.ts';
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
  acknowledgeEggCreate,
  acknowledgeWrites,
  applyCareWrites,
  createWriteQueue,
  enqueueCareWrite,
  enqueueEggCreate,
  reconcileWithServer,
  type ServerCareRecord,
  toCreateEggRequest,
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
export {
  type ApproachConfig,
  type ApproachEndReason,
  type ApproachEvent,
  type ApproachFrame,
  type ApproachMachine,
  type ApproachRadii,
  type ApproachState,
  type ApproachStep,
  type ApproachSuppression,
  type ApproachTarget,
  type ApproachTier,
  type ApproachViewer,
  APPROACH_TIERS,
  createApproachMachine,
  DEFAULT_APPROACH_CONFIG,
} from './approach.ts';
export {
  type ActionCue,
  buildMonSceneInput,
  deriveAnimationIntent,
  deriveMonMood,
  emptyModelSlots,
  IDLE_PRESENCE,
  MODEL_SLOT_STAGES,
  type MonSceneSource,
  type ScenePresence,
} from './scene-input.ts';
export {
  type ResolvedSceneMode,
  resolveSceneMode,
  type SceneModeInput,
  type SceneModeReason,
  type ScenePlatform,
  type ScenePreference,
  type SceneRuntimeCapabilities,
  usableAnchors,
} from './scene-mode.ts';
