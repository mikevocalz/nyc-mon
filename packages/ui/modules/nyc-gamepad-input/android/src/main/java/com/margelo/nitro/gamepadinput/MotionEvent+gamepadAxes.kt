package com.margelo.nitro.gamepadinput

import android.view.InputDevice
import android.view.MotionEvent

/**
 * Reads every axis the game cares about from one joystick `MotionEvent`,
 * normalized to the JS contract: sticks and hat −1…1 with +y up (Android
 * reports +y down), triggers 0…1. Android sends `AXIS_LTRIGGER`/`AXIS_BRAKE`
 * and `AXIS_RTRIGGER`/`AXIS_GAS` depending on the pad; whichever is nonzero
 * wins. The caller diffs against the last value per device, because Android
 * reports all axes on every move.
 */
internal fun MotionEvent.gamepadAxisValues(): List<Pair<GamepadAxis, Double>> {
  val device = device ?: return emptyList()
  fun axis(axis: Int): Float {
    val range = device.getMotionRange(axis, source) ?: return 0f
        val raw = getAxisValue(axis)
    // Flatten the hardware's own centre dead band so a resting stick reads 0.
    return if (kotlin.math.abs(raw) <= range.flat) 0f else raw
  }
  val leftTrigger = maxOf(axis(MotionEvent.AXIS_LTRIGGER), axis(MotionEvent.AXIS_BRAKE))
  val rightTrigger = maxOf(axis(MotionEvent.AXIS_RTRIGGER), axis(MotionEvent.AXIS_GAS))
  return listOf(
    GamepadAxis.LEFT_X to axis(MotionEvent.AXIS_X).toDouble(),
    GamepadAxis.LEFT_Y to -axis(MotionEvent.AXIS_Y).toDouble(),
    GamepadAxis.RIGHT_X to axis(MotionEvent.AXIS_Z).toDouble(),
    GamepadAxis.RIGHT_Y to -axis(MotionEvent.AXIS_RZ).toDouble(),
    GamepadAxis.DPAD_X to axis(MotionEvent.AXIS_HAT_X).toDouble(),
    GamepadAxis.DPAD_Y to -axis(MotionEvent.AXIS_HAT_Y).toDouble(),
    GamepadAxis.LEFT_TRIGGER to leftTrigger.toDouble(),
    GamepadAxis.RIGHT_TRIGGER to rightTrigger.toDouble(),
  )
}

internal fun MotionEvent.isJoystickMove(): Boolean {
  return isFromSource(InputDevice.SOURCE_JOYSTICK) && action == MotionEvent.ACTION_MOVE
}
