package com.margelo.nitro.gamepadinput

import android.view.KeyEvent
import android.view.MotionEvent

/**
 * What the activity's `Window.Callback` hands raw events to. Implemented by
 * [HybridGamepadInput]; published through [GamepadEventHub] because the
 * callback is installed by the Expo lifecycle listener, which never sees
 * the HybridObject instance.
 */
internal interface GamepadEventSink {
  /** Observes only; the return value never consumes the event. */
  fun onKeyEvent(event: KeyEvent)
  fun onMotionEvent(event: MotionEvent)
}
