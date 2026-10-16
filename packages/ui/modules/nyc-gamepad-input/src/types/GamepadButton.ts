import type { GamepadAxis } from './GamepadAxis';
import type { GamepadInput } from '../specs/GamepadInput.nitro';

/**
 * A physical gamepad control, named by position so every vendor reports the
 * same value for the same thumb movement: `south` is Xbox A, PlayStation
 * Cross and Nintendo B; `east` is Xbox B, PlayStation Circle and Nintendo A.
 *
 * Follows the W3C Gamepad API standard mapping on web, Apple's
 * `GCExtendedGamepad` element positions on iOS and Android `KeyEvent`
 * gamepad key codes. Triggers arrive here only as digital presses; their
 * travel is reported through {@linkcode GamepadAxis}.
 *
 * @see {@linkcode GamepadInput.addOnButtonListener}
 */
export type GamepadButton =
  | 'south'
  | 'east'
  | 'west'
  | 'north'
  | 'left-shoulder'
  | 'right-shoulder'
  | 'left-trigger'
  | 'right-trigger'
  | 'select'
  | 'start'
  | 'left-stick'
  | 'right-stick'
  | 'dpad-up'
  | 'dpad-down'
  | 'dpad-left'
  | 'dpad-right'
  | 'home';
