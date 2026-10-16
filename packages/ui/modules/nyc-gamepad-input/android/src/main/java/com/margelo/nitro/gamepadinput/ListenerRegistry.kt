package com.margelo.nitro.gamepadinput

import java.util.concurrent.CopyOnWriteArrayList

/**
 * Additive listener list behind every `addOn…Listener` method.
 *
 * Added and removed from the JS thread, iterated on the main thread where
 * `KeyEvent` and `MotionEvent` arrive. `CopyOnWriteArrayList` gives the
 * emitter an immutable snapshot per iteration, so no lock is held while a
 * listener runs. A listener removed mid-emission may still get that event.
 */
internal class ListenerRegistry<Listener : Any> {
  private val listeners = CopyOnWriteArrayList<Listener>()

  fun add(listener: Listener): ListenerSubscription {
    listeners.add(listener)
    return ListenerSubscription { listeners.remove(listener) }
  }

  fun snapshot(): List<Listener> = listeners

  /** Drops every listener; the owner calls this when it is disposed. */
  fun clear() {
    listeners.clear()
  }
}
