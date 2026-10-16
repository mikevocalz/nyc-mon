package com.margelo.nitro.gamepadinput

import android.view.InputDevice

/** Sources that mark a device as a game controller rather than a keyboard, mouse or touch screen. */
private const val GAME_CONTROLLER_SOURCES = InputDevice.SOURCE_GAMEPAD or InputDevice.SOURCE_JOYSTICK

internal fun InputDevice.isGameController(): Boolean {
  return (sources and GAME_CONTROLLER_SOURCES) != 0
}

/** A real keyboard, not a pad that also claims `SOURCE_KEYBOARD` for its buttons. */
internal fun InputDevice.isHardwareKeyboard(): Boolean {
  return (sources and InputDevice.SOURCE_KEYBOARD) == InputDevice.SOURCE_KEYBOARD &&
    keyboardType == InputDevice.KEYBOARD_TYPE_ALPHABETIC &&
    !isVirtual
}

internal fun InputDevice.toGamepadDevice(): GamepadDevice {
  val family = if (isHardwareKeyboard()) GamepadFamily.KEYBOARD else GamepadFamily.fromInputDevice(this)
  return GamepadDevice(id = id.toString(), name = name, family = family)
}
