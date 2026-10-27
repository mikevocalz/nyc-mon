// The H-Lynk in 3D: one stage and one scene on web and native, with a pluggable screen (the website's HUD, the app's egg choice).
export { DeviceStage, type DeviceCapture, type DeviceStageApi, type DeviceStageProps } from './DeviceStage';
export { HLynkHudStage, type HLynkHudStageControls, type HLynkHudStageProps } from './HLynkHudStage';
export { createHudScreen } from './hud-screen';
export {
  ACTION_ROW, CHOICE_ROW, choiceActionRect, choiceModelRect, choiceSlotAt, choiceSlotRect, createChoiceScreen,
  type ChoiceAction, type ChoiceItem, type ChoicePanel, type ChoiceScreenOptions,
} from './choice-screen';
export {
  createIncubateScreen, INCUBATE_EGG_TARGET, incubateOptionRect, INCUBATE_START_TARGET, incubateOptionTarget,
  type IncubateScreenOptions,
} from './incubate-screen';
export {
  createIncubatingScreen, INCUBATING_ACTION_TARGET, INCUBATING_EGG_TARGET, INCUBATING_NOTIFY_TARGET,
  type IncubatingScreenOptions, type IncubatingView,
} from './incubating-screen';
export { buttonAt, drawButton, inRect, type ScreenButton, type ScreenRect } from './screen-actions';
export { keyFromTarget, keyTarget, type DeviceKey } from './stage-state';
export { createStageReady, type StageReadyResource } from './stage-ready';
export { StageReadyGate } from './StageReadyGate';
export type { DeviceScreen, ScreenModel, ScreenModelSource } from './screen';
export type { DeviceSceneParams } from './device-scene';
export {
  DEFAULT_HUD_TAB, HUD_BANNED, HUD_SIZE, HUD_TAB_BAR, HUD_TABS, hudCaption, hudTabAt, hudTabRect, initialHudState,
  type HudContent, type HudHover, type HudMeter, type HudState, type HudTab,
} from './hud';
export type { CanvasFont, Ctx2D } from './canvas2d-types';
