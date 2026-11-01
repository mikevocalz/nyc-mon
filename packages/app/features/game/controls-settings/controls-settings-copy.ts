// Every string on the game-control settings screen, keyed as G03 05-copy.md
// names them (`g03.*`), plus the pure value formatters the sliders speak and
// print. No react-native import, so node --test covers the formatters and
// the preview label. Sentence case everywhere; values in units a person uses.
import type { ControllerProfile, Handedness, HapticStrength, StickMode, StickPlacement } from '@acme/ui/game-controls/parts';

export const G03 = {
  title: 'Game controls',
  intro: 'Changes apply as you make them.',
  section: { stick: 'Stick', layout: 'Layout', feel: 'Feel', buttons: 'Buttons' },
  preview: { hint: 'Tap a button to feel the haptic strength.' },
  stick: {
    mode: {
      label: 'Mode',
      a11y: 'Stick mode',
      analog: 'Analog',
      dpad: 'D-pad',
      caption: 'Analog moves at any angle and speed. D-pad snaps to eight directions.',
    },
    placement: {
      label: 'Placement',
      a11y: 'Stick placement',
      fixed: 'Fixed',
      floating: 'Floating',
      caption: 'Floating puts the stick wherever your thumb lands.',
    },
    deadzone: { label: 'Dead zone', caption: 'How far the stick moves before the game notices.' },
    sensitivity: { label: 'Sensitivity', caption: 'How fast a small push turns into a big move.' },
  },
  hand: {
    label: 'Hand',
    a11y: 'Hand',
    left: 'Left',
    right: 'Right',
    caption: 'Left puts the buttons under your left thumb and the stick under your right.',
  },
  size: { label: 'Size' },
  opacity: { label: 'Opacity', caption: 'Lower lets more of the city show through the controls.' },
  haptics: {
    label: 'Haptics',
    a11y: 'Haptic strength',
    off: 'Off',
    light: 'Light',
    medium: 'Medium',
    strong: 'Strong',
  },
  icons: {
    label: 'Show icons on buttons',
    caption: 'Buttons show a picture of what they do instead of a letter, when one exists.',
  },
  bindings: { caption: 'What each button does on this screen. Remapping comes with the game rules.' },
  reduced: {
    on: 'Reduced motion is on in your system settings. The controls use their steady versions.',
    action: 'Change',
    hint: 'Opens system settings',
  },
  restore: {
    button: 'Restore defaults',
    title: 'Restore default controls?',
    body: 'Every control goes back to how it started. Your saved game is not affected.',
    confirm: 'Restore',
    cancel: 'Keep my settings',
    done: 'Controls restored to defaults.',
  },
} as const;

export const STICK_MODE_OPTIONS: readonly { value: StickMode; label: string }[] = [
  { value: 'analog', label: G03.stick.mode.analog },
  { value: 'dpad', label: G03.stick.mode.dpad },
];
export const STICK_PLACEMENT_OPTIONS: readonly { value: StickPlacement; label: string }[] = [
  { value: 'fixed', label: G03.stick.placement.fixed },
  { value: 'floating', label: G03.stick.placement.floating },
];
export const HANDEDNESS_OPTIONS: readonly { value: Handedness; label: string }[] = [
  { value: 'left', label: G03.hand.left },
  { value: 'right', label: G03.hand.right },
];
export const HAPTICS_OPTIONS: readonly { value: HapticStrength; label: string }[] = [
  { value: 'off', label: G03.haptics.off },
  { value: 'light', label: G03.haptics.light },
  { value: 'medium', label: G03.haptics.medium },
  { value: 'strong', label: G03.haptics.strong },
];

/** Slider ranges, the contract's (controller-profile.schema.ts encodes the same numbers). */
export const SLIDER_RANGES = {
  deadZone: { min: 0, max: 0.5, step: 0.05 },
  sensitivity: { min: 0.5, max: 2, step: 0.1 },
  scale: { min: 0.8, max: 1.4, step: 0.1 },
  opacity: { min: 0.3, max: 1, step: 0.05 },
} as const;

/** Whole percent of a 0…1 fraction: 0.15 → 15. */
export function toPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

/** Visible value: "15%" (`g03.*.value` visible form). */
export function percentLabel(fraction: number): string {
  return `${toPercent(fraction)}%`;
}

/** Spoken value: "15 percent" (`g03.*.value` spoken form). */
export function percentSpoken(fraction: number): string {
  return `${toPercent(fraction)} percent`;
}

/** Visible sensitivity: "1×", "1.5×" (`g03.stick.sensitivity.value` visible form). */
export function timesLabel(factor: number): string {
  return `${trimFactor(factor)}×`;
}

/** Spoken sensitivity: "1 times", "1.5 times" (`g03.stick.sensitivity.value` spoken form). */
export function timesSpoken(factor: number): string {
  return `${trimFactor(factor)} times`;
}

/** One decimal at most, no trailing zero: 1 → "1", 1.5 → "1.5", 0.7000001 → "0.7". */
function trimFactor(factor: number): string {
  return String(Math.round(factor * 10) / 10);
}

/**
 * Snaps a slider value to its step from `min`, so a float drag never writes
 * 0.15000000000000002 into the profile.
 */
export function snapToStep(value: number, range: { min: number; max: number; step: number }): number {
  const steps = Math.round((value - range.min) / range.step);
  const snapped = range.min + steps * range.step;
  const decimals = String(range.step).split('.')[1]?.length ?? 0;
  return Math.min(range.max, Math.max(range.min, Number(snapped.toFixed(decimals))));
}

/** The preview's accessibility label (`g03.preview.a11y`), rebuilt on every change. */
export function previewAccessibilityLabel(profile: ControllerProfile): string {
  const hand = profile.handedness === 'left' ? G03.hand.left : G03.hand.right;
  const mode = profile.stickMode === 'analog' ? 'analog' : 'D-pad';
  return `Controller preview. ${hand}, size ${toPercent(profile.scale)} percent, opacity ${toPercent(profile.opacity)} percent, ${mode} stick.`;
}

/**
 * One accessibility increment or decrement of a slider (review finding M11):
 * a step from the snapped current value, clamped to the range. The settings
 * screen exposes each slider as an `adjustable` element with this step, so a
 * screen reader hears the deck's spoken value instead of the raw fraction.
 */
export function stepSlider(value: number, range: { min: number; max: number; step: number }, direction: 'increment' | 'decrement'): number {
  const delta = direction === 'increment' ? range.step : -range.step;
  return snapToStep(snapToStep(value, range) + delta, range);
}
