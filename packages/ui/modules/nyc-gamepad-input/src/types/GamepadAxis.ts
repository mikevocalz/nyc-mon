import type { GamepadButton } from './GamepadButton';
import type { GamepadInput } from '../specs/GamepadInput.nitro';

/**
 * A continuous gamepad control. Values are normalized before they reach JS:
 * sticks and the d-pad run −1…1 on each axis with +y up (the platforms
 * disagree: web and Android report +y down, GameController reports +y up),
 * triggers run 0…1.
 *
 * `dpad-x` / `dpad-y` carry the digital pad as an axis pair so the stick
 * math treats both the same; the pad also arrives as
 * {@linkcode GamepadButton} presses for diagnostics.
 *
 * @see {@linkcode GamepadInput.addOnAxisListener}
 */
export type GamepadAxis =
  | 'left-x'
  | 'left-y'
  | 'right-x'
  | 'right-y'
  | 'dpad-x'
  | 'dpad-y'
  | 'left-trigger'
  | 'right-trigger';
