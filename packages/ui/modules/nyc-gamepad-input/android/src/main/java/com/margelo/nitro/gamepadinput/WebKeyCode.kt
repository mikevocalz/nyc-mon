package com.margelo.nitro.gamepadinput

import android.view.KeyEvent

/**
 * Android keyboard key code → W3C `KeyboardEvent.code`, so one keyboard
 * mapping serves native and web. Letters, digits, arrows and the editing
 * keys the game binds; anything else is null and the module drops it.
 */
internal object WebKeyCode {
  fun fromKeyCode(keyCode: Int): String? {
    if (keyCode in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z) {
      return "Key" + ('A' + (keyCode - KeyEvent.KEYCODE_A))
    }
    if (keyCode in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9) {
      return "Digit" + (keyCode - KeyEvent.KEYCODE_0)
    }
    return when (keyCode) {
      KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> "Enter"
      KeyEvent.KEYCODE_ESCAPE -> "Escape"
      KeyEvent.KEYCODE_DEL -> "Backspace"
      KeyEvent.KEYCODE_TAB -> "Tab"
      KeyEvent.KEYCODE_SPACE -> "Space"
      KeyEvent.KEYCODE_DPAD_UP -> "ArrowUp"
      KeyEvent.KEYCODE_DPAD_DOWN -> "ArrowDown"
      KeyEvent.KEYCODE_DPAD_LEFT -> "ArrowLeft"
      KeyEvent.KEYCODE_DPAD_RIGHT -> "ArrowRight"
      KeyEvent.KEYCODE_SHIFT_LEFT -> "ShiftLeft"
      KeyEvent.KEYCODE_SHIFT_RIGHT -> "ShiftRight"
      KeyEvent.KEYCODE_CTRL_LEFT -> "ControlLeft"
      KeyEvent.KEYCODE_CTRL_RIGHT -> "ControlRight"
      KeyEvent.KEYCODE_ALT_LEFT -> "AltLeft"
      KeyEvent.KEYCODE_ALT_RIGHT -> "AltRight"
      KeyEvent.KEYCODE_META_LEFT -> "MetaLeft"
      KeyEvent.KEYCODE_META_RIGHT -> "MetaRight"
      else -> null
    }
  }
}
