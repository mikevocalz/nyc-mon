// H-Lynk chrome (canon Decision #16; docs/design/hlynk/DIRECTION.md). Barrel only.
export { HLynkShell, SHELL_HANDOFF_MS } from './HLynkShell';
export type { HLynkShellProps, HLynkStatus, HLynkPower, ShellTrackpadProps, ShellKeyProps } from './HLynkShell.types';
export { HLynkScreen, type HLynkScreenProps } from './HLynkScreen';
export { ScannerLed } from './ScannerLed';
export type { ScannerLedProps } from './ScannerLed.types';
export { Trackpad } from './Trackpad';
export type { TrackpadProps, TrackpadCommit } from './Trackpad.types';
export { TrackpadActions, type TrackpadActionsProps } from './TrackpadActions';
export { HLynkKey } from './HLynkKey';
export type { HLynkKeyProps, HLynkKeyRole } from './HLynkKey.types';
export { HLYNK_COPY, ledAccessibilityLabel, type HLynkCopyId } from './copy';
export { HLYNK_GEOMETRY, measureShell, resolveForcedLayout, type ShellLayout, type ShellGeometry, type ShellViewport } from './layout';
export { resolveLedRhythm, type LedState, type LedRhythm, type SteadyCue } from './led-rhythm';
export type { HLynkTier } from './tier';
export { useLedBreathPhase } from './use-led-breath-phase';
export {
  LED_BREATH_PERIOD_MS, breathPhaseAt, breathIntensity, padGlowAt, inhaleStarted, canPulse,
} from './breath-clock';
export { TRACKPAD_GESTURE } from './trackpad-gesture';
export { HLynkStage, HLYNK_STAGE_WIDE_PT, useHLynkStageWide, type HLynkStageProps } from './HLynkStage';
