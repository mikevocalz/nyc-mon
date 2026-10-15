// Egg, case and hatch primitives for M08–M12 (docs/design/screens/M08–M12).
export { IncubationRing } from './IncubationRing';
export type {
  IncubationRingProps, IncubationRingChoiceProps, IncubationRingCountdownProps, IncubationRingStop,
} from './IncubationRing.types';
export { CaptureCase, type CaptureCaseProps } from './CaptureCase';
export { EggCase, CASE_TRANSITION_MS, type EggCaseProps } from './EggCase';
export { HatchEgg, type HatchEggProps } from './HatchEgg';
export { HatchBurst, type HatchBurstProps } from './HatchBurst';
export { CreatureStage, type CreatureStageProps, type CreaturePerformance } from './CreatureStage';
export { MonStillReaction, type MonStillReactionProps } from './MonStillReaction';
export { ChoiceTriptych, type ChoiceTriptychProps, type ChoiceTriptychItem } from './ChoiceTriptych';
export {
  CRACK_AT, crackStage, burstOpacity, BURST_PEAK_AT, lidAngle, LID_OPEN_DEG, FRAMING, firstLookPose, reactionPose,
  triptychKey, type CreatureFraming, type StillReaction,
} from './hatch-model';
export { ChoiceRows, type ChoiceRowsProps, type ChoiceRow } from './ChoiceRows';
