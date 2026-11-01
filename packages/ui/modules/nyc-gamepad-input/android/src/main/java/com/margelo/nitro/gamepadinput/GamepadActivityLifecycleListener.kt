package com.margelo.nitro.gamepadinput

import android.app.Activity
import android.os.Bundle
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Installs [GamepadWindowCallback] on each `ReactActivity` Expo creates.
 * `ReactActivityDelegateWrapper.onCreate` (expo 58.0.3,
 * android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt) calls
 * this after the activity's window exists. Idempotent: an activity recreated
 * after a configuration change gets a fresh window and a fresh wrapper, and
 * a window already wrapped is left alone.
 */
internal class GamepadActivityLifecycleListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    val window = activity.window ?: return
    val current = window.callback ?: return
    if (current is GamepadWindowCallback) return
    window.callback = GamepadWindowCallback(current)
  }
}
