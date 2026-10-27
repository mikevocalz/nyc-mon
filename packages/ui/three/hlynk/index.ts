// The H-Lynk in 3D: one stage and one scene on web and native, with a pluggable screen (the website's HUD, the app's egg choice).
export { DeviceStage, type DeviceCapture, type DeviceStageApi, type DeviceStageProps } from './DeviceStage';
export { HLynkHudStage, type HLynkHudStageControls, type HLynkHudStageProps } from './HLynkHudStage';
export { createHudScreen } from './hud-screen';
export {
  CHOICE_ROW, choiceModelRect, choiceSlotAt, choiceSlotRect, createChoiceScreen,
  type ChoiceItem, type ChoiceScreenOptions,
} from './choice-screen';
export type { DeviceScreen, ScreenModel, ScreenModelSource } from './screen';
export type { DeviceSceneParams } from './device-scene';
export {
  DEFAULT_HUD_TAB, HUD_BANNED, HUD_SIZE, HUD_TAB_BAR, HUD_TABS, hudCaption, hudTabAt, hudTabRect, initialHudState,
  type HudContent, type HudHover, type HudMeter, type HudState, type HudTab,
} from './hud';
export type { CanvasFont, Ctx2D } from './canvas2d-types';
