// The arcade-control surface without the components: contract, profile
// schema, stick maths, router, cluster geometry, Rive binding. No
// react-native import anywhere below, so the app's stores and node tests can
// import this path (mirrors `./layout/parts`). `LayoutProfile` is left to
// `./layout/parts`, which re-exports it from the contract, so the barrel
// in ./index.ts can spread both without a duplicate name.
export {
  BUTTON_IDS,
  DEFAULT_CONTROLLER_PROFILE,
  STOP_HOLD_MS,
  type ActionBinding,
  type ButtonId,
  type ButtonVisualState,
  type CancelReason,
  type ControllerBindings,
  type ControllerProfile,
  type Direction8,
  type GameInputRouter,
  type Handedness,
  type HapticStrength,
  type InputDiagnostics,
  type InputEvent,
  type InputSource,
  type LeaderboardStatus,
  type ListenerSubscription,
  type Phase,
  type PillState,
  type StickMode,
  type StickPlacement,
  type StickReading,
  type StickTuning,
} from './contract.ts';
export {
  VALID_DEFAULT_CONTROLLER_PROFILE,
  controllerProfileSchema,
  parseControllerProfile,
  patchControllerProfile,
  stickTuningSchema,
} from './controller-profile.schema.ts';
export {
  DIRECTION_VECTORS,
  NEUTRAL_STICK,
  direction8,
  isSameReading,
  readStick,
  stickOrigin,
  thumbOffsetDp,
  toDigitalReading,
} from './stick-math.ts';
export {
  createGameInputRouter,
  type CreatedGameInputRouter,
  type GameInputRouterOptions,
} from './create-game-input-router.ts';
export {
  SIX_BUTTON_BOX_DP,
  SIX_BUTTON_CENTRES_DP,
  SIX_BUTTON_DIAMETER_DP,
  SIX_BUTTON_MIN_TARGET_DP,
  sixButtonArch,
  type ButtonSlot,
  type SixButtonArch,
  type SixButtonArchOptions,
} from './six-button-arch.ts';
export {
  ARCADE_VM_PATHS,
  createArcadeRiveBinding,
  type ArcadeRiveBinding,
  type ArcadeRiveBindingOptions,
  type ArcadeViewModelInstance,
  type RivePropertySetter,
} from './rive-binding.ts';
export {
  RIVE_ERROR_LIMIT,
  riveDiagnosticsConfig,
  riveDiagnosticsStore,
  type RiveDiagnosticsState,
  type RiveErrorRecord,
} from './rive-diagnostics.ts';
export { DIRECTION_WORDS, PILL_GEOMETRY_DP, STICK_GEOMETRY_DP, insideCircle } from './touch-geometry.ts';
export {
  ACCESSIBILITY_PRESS_MS,
  createTouchInputGate,
  type GateTimers,
  type TouchInputGate,
  type TouchInputGateOptions,
} from './touch-input-gate.ts';
export {
  PILL_STOP_CONFIRM,
  holdDurationSpoken,
  holdProgressSteps,
  pillHint,
  quantizeHoldProgress,
  stopHoldHint,
} from './start-stop-pill-copy.ts';
export { DEFAULT_CALLER_BINDINGS, DEFAULT_CALLER_SPOKEN_LABELS, DEFAULT_CAMERA_BINDINGS, DEFAULT_CAMERA_SPOKEN_LABELS, type DefaultCallerAction, type DefaultCameraAction } from './default-bindings.ts';
