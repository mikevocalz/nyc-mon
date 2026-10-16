package com.margelo.nitro.gamepadinput

/**
 * Process-wide handoff between the window callback (installed once per
 * activity) and the one [HybridGamepadInput] JS creates. Events that arrive
 * before JS has created the HybridObject are dropped: there is nobody to
 * tell yet, and a button pressed during startup is not gameplay.
 */
internal object GamepadEventHub {
  @Volatile
  var sink: GamepadEventSink? = null
    private set

  /** Makes [owner] the receiver; the newest HybridObject wins. */
  @Synchronized
  fun install(owner: GamepadEventSink) {
    sink = owner
  }

  /**
   * Clears [sink] only when it is still [owner]. A newer HybridObject may
   * already have replaced it; disposing the old one must not unhook the new.
   */
  @Synchronized
  fun clearIfCurrent(owner: GamepadEventSink) {
    if (sink === owner) sink = null
  }
}
