package com.margelo.nitro.gamepadinput

import android.view.KeyEvent
import android.view.MotionEvent
import android.view.Window

/**
 * Wraps the activity's own `Window.Callback` (the `ReactActivity`) so key and
 * generic-motion events are observed before the view hierarchy sees them.
 * Expo's `ReactActivityHandler` only forwards `onKeyDown`/`onKeyUp`, which
 * fire after a view had the chance to consume the key, and nothing forwards
 * joystick `MotionEvent`s at all; the window callback is the one seam that
 * carries both without a `MainActivity` change.
 *
 * Every method the sink does not care about is delegated untouched, and the
 * two it does care about still return the wrapped callback's verdict, so
 * React Native's focus navigation and back handling behave as before.
 */
internal class GamepadWindowCallback(
  private val wrapped: Window.Callback,
) : Window.Callback by wrapped {
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    GamepadEventHub.sink?.onKeyEvent(event)
    return wrapped.dispatchKeyEvent(event)
  }

  override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
    GamepadEventHub.sink?.onMotionEvent(event)
    return wrapped.dispatchGenericMotionEvent(event)
  }
}
