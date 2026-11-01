package com.margelo.nitro.gamepadinput

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Expo autolinking registers this class because it implements
 * `expo.modules.core.interfaces.Package` (expo-modules-autolinking 58.0.8
 * scans `*Package.kt` for that import). Being constructed early in
 * `ExpoModulesPackage.packageList` is what loads the Nitro C++ library and
 * registers the `GamepadInput` constructor, the same way
 * `NitroMmkvPackage`'s static block does for react-native-mmkv.
 */
class NycGamepadInputPackage : Package {
  init {
    NycGamepadInputOnLoad.initializeNative()
  }

  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> {
    return listOf(GamepadActivityLifecycleListener())
  }
}
