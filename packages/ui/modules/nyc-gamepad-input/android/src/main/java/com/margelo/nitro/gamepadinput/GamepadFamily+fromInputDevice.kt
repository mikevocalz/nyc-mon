package com.margelo.nitro.gamepadinput

import android.view.InputDevice

private const val VENDOR_MICROSOFT = 0x045E
private const val VENDOR_SONY = 0x054C
private const val VENDOR_NINTENDO = 0x057E

/**
 * USB vendor id first (Bluetooth pads report it too), product name as the
 * fallback for clones that borrow a name but not an id.
 */
internal fun GamepadFamily.Companion.fromInputDevice(device: InputDevice): GamepadFamily {
  when (device.vendorId) {
    VENDOR_MICROSOFT -> return GamepadFamily.XBOX
    VENDOR_SONY -> return GamepadFamily.PLAYSTATION
    VENDOR_NINTENDO -> return GamepadFamily.NINTENDO
  }
  val name = device.name.lowercase()
  return when {
    name.contains("xbox") -> GamepadFamily.XBOX
    name.contains("dualsense") || name.contains("dualshock") || name.contains("wireless controller") -> GamepadFamily.PLAYSTATION
    name.contains("nintendo") || name.contains("switch") || name.contains("joy-con") -> GamepadFamily.NINTENDO
    else -> GamepadFamily.GENERIC
  }
}
