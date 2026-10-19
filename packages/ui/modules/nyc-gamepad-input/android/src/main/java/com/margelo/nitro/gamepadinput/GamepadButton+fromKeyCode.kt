package com.margelo.nitro.gamepadinput

import android.view.KeyEvent

/**
 * Android gamepad key code → physical position. `KEYCODE_BUTTON_A` is the
 * bottom face button in Android's generic HID layout, so it is `SOUTH`
 * whatever the vendor prints on the cap. The d-pad arrives as
 * `KEYCODE_DPAD_*` for pads that report it as keys; pads that report it as
 * `AXIS_HAT_X/Y` go through the motion path instead.
 */
internal fun GamepadButton.Companion.fromKeyCode(keyCode: Int): GamepadButton? {
  return when (keyCode) {
    KeyEvent.KEYCODE_BUTTON_A -> GamepadButton.SOUTH
    KeyEvent.KEYCODE_BUTTON_B -> GamepadButton.EAST
    KeyEvent.KEYCODE_BUTTON_X -> GamepadButton.WEST
    KeyEvent.KEYCODE_BUTTON_Y -> GamepadButton.NORTH
    KeyEvent.KEYCODE_BUTTON_L1 -> GamepadButton.LEFT_SHOULDER
    KeyEvent.KEYCODE_BUTTON_R1 -> GamepadButton.RIGHT_SHOULDER
    KeyEvent.KEYCODE_BUTTON_L2 -> GamepadButton.LEFT_TRIGGER
    KeyEvent.KEYCODE_BUTTON_R2 -> GamepadButton.RIGHT_TRIGGER
    KeyEvent.KEYCODE_BUTTON_SELECT -> GamepadButton.SELECT
    KeyEvent.KEYCODE_BUTTON_START -> GamepadButton.START
    KeyEvent.KEYCODE_BUTTON_THUMBL -> GamepadButton.LEFT_STICK
    KeyEvent.KEYCODE_BUTTON_THUMBR -> GamepadButton.RIGHT_STICK
    KeyEvent.KEYCODE_DPAD_UP -> GamepadButton.DPAD_UP
    KeyEvent.KEYCODE_DPAD_DOWN -> GamepadButton.DPAD_DOWN
    KeyEvent.KEYCODE_DPAD_LEFT -> GamepadButton.DPAD_LEFT
    KeyEvent.KEYCODE_DPAD_RIGHT -> GamepadButton.DPAD_RIGHT
    KeyEvent.KEYCODE_BUTTON_MODE -> GamepadButton.HOME
    else -> null
  }
}
