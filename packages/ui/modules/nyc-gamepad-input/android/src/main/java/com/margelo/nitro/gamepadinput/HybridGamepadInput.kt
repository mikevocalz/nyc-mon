package com.margelo.nitro.gamepadinput

import android.content.Context
import android.hardware.input.InputManager
import android.os.Handler
import android.os.Looper
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules

/**
 * Android half of `GamepadInput`. Orchestration only: four listener
 * registries, an `InputDeviceListener` for connect/disconnect, and the
 * [GamepadEventSink] the window callback feeds. Raw events arrive on the
 * main thread; Nitro moves each JS callback onto the JS thread.
 */
@Keep
@DoNotStrip
class HybridGamepadInput : HybridGamepadInputSpec(), GamepadEventSink {
  private val connectionListeners = ListenerRegistry<(GamepadDevice, Boolean) -> Unit>()
  private val buttonListeners = ListenerRegistry<(GamepadButton, Boolean, String, Double) -> Unit>()
  private val axisListeners = ListenerRegistry<(GamepadAxis, Double, String, Double) -> Unit>()
  private val keyListeners = ListenerRegistry<(String, Boolean, Double) -> Unit>()

  /** Last reported value per device and axis, so only changes reach JS. */
  private val lastAxisValues = HashMap<Pair<Int, GamepadAxis>, Double>()
  private var deviceListenerRegistered = false

  private val inputManager: InputManager?
    get() {
      val context = NitroModules.applicationContext ?: return null
      return context.getSystemService(Context.INPUT_SERVICE) as? InputManager
    }

  private val deviceListener = object : InputManager.InputDeviceListener {
    override fun onInputDeviceAdded(deviceId: Int) {
      val device = InputDevice.getDevice(deviceId) ?: return
      if (!device.isGameController() && !device.isHardwareKeyboard()) return
      emitConnection(device.toGamepadDevice(), true)
    }

    override fun onInputDeviceRemoved(deviceId: Int) {
      // The InputDevice is gone by now; only the id survives. Family and
      // name come from the cache the connection path keeps.
      val known = knownDevices.remove(deviceId) ?: return
      lastAxisValues.keys.removeAll { it.first == deviceId }
      emitConnection(known, false)
    }

    override fun onInputDeviceChanged(deviceId: Int) {}
  }

  private val knownDevices = HashMap<Int, GamepadDevice>()
  private val mainHandler = Handler(Looper.getMainLooper())

  init {
    GamepadEventHub.install(this)
  }

  override val isAvailable: Boolean
    get() = inputManager != null

  override fun getConnectedDevices(): Array<GamepadDevice> {
    ensureDeviceListener()
    val manager = inputManager ?: return emptyArray()
    return manager.inputDeviceIds.asList()
      .mapNotNull { InputDevice.getDevice(it) }
      .filter { it.isGameController() || it.isHardwareKeyboard() }
      .map { it.toGamepadDevice() }
      .toTypedArray()
  }

  override fun addOnConnectionChangedListener(listener: (device: GamepadDevice, connected: Boolean) -> Unit): ListenerSubscription {
    ensureDeviceListener()
    return connectionListeners.add(listener)
  }

  override fun addOnButtonListener(listener: (button: GamepadButton, pressed: Boolean, deviceId: String, timestampMs: Double) -> Unit): ListenerSubscription {
    return buttonListeners.add(listener)
  }

  override fun addOnAxisListener(listener: (axis: GamepadAxis, value: Double, deviceId: String, timestampMs: Double) -> Unit): ListenerSubscription {
    return axisListeners.add(listener)
  }

  override fun addOnKeyListener(listener: (keyCode: String, pressed: Boolean, timestampMs: Double) -> Unit): ListenerSubscription {
    return keyListeners.add(listener)
  }

  // GamepadEventSink: main thread.

  override fun onKeyEvent(event: KeyEvent) {
    if (event.repeatCount > 0) return
    val pressed = when (event.action) {
      KeyEvent.ACTION_DOWN -> true
      KeyEvent.ACTION_UP -> false
      else -> return
    }
    val device = event.device ?: return
    val timestampMs = event.eventTime.toDouble()
    if (device.isGameController()) {
      val button = GamepadButton.fromKeyCode(event.keyCode) ?: return
      val deviceId = device.id.toString()
      for (listener in buttonListeners.snapshot()) listener(button, pressed, deviceId, timestampMs)
      return
    }
    if (device.isHardwareKeyboard()) {
      val code = WebKeyCode.fromKeyCode(event.keyCode) ?: return
      for (listener in keyListeners.snapshot()) listener(code, pressed, timestampMs)
    }
  }

  override fun onMotionEvent(event: MotionEvent) {
    if (!event.isJoystickMove()) return
    val deviceId = event.deviceId
    val deviceIdString = deviceId.toString()
    val timestampMs = event.eventTime.toDouble()
    for ((axis, value) in event.gamepadAxisValues()) {
      val key = deviceId to axis
      if (lastAxisValues[key] == value) continue
      lastAxisValues[key] = value
      for (listener in axisListeners.snapshot()) listener(axis, value, deviceIdString, timestampMs)
    }
  }

  /**
   * Called on the JS thread. The listener itself is delivered on the main
   * thread, and `knownDevices` belongs to the main thread like every other
   * map here, so the initial snapshot is posted there instead of written
   * from the caller's thread.
   */
  private fun ensureDeviceListener() {
    if (deviceListenerRegistered) return
    val manager = inputManager ?: return
    deviceListenerRegistered = true
    manager.registerInputDeviceListener(deviceListener, mainHandler)
    mainHandler.post {
      for (id in manager.inputDeviceIds) {
        val device = InputDevice.getDevice(id) ?: continue
        if (device.isGameController() || device.isHardwareKeyboard()) {
          knownDevices[id] = device.toGamepadDevice()
        }
      }
    }
  }

  /**
   * Nitro calls this when JS drops the HybridObject (a reload, or a second
   * `createHybridObject` replacing this one). Mirrors the Swift side, whose
   * `GameControllerObserver.deinit` removes its notification observers:
   * stop receiving window events, unregister from [InputManager], and drop
   * every JS callback so nothing calls into a runtime that is gone. Must not
   * throw. The main-thread maps are cleared on the main thread they belong to.
   */
  override fun dispose() {
    GamepadEventHub.clearIfCurrent(this)
    if (deviceListenerRegistered) {
      deviceListenerRegistered = false
      inputManager?.unregisterInputDeviceListener(deviceListener)
    }
    connectionListeners.clear()
    buttonListeners.clear()
    axisListeners.clear()
    keyListeners.clear()
    mainHandler.removeCallbacksAndMessages(null)
    mainHandler.post {
      knownDevices.clear()
      lastAxisValues.clear()
    }
    super.dispose()
  }

  private fun emitConnection(device: GamepadDevice, connected: Boolean) {
    if (connected) knownDevices[device.id.toInt()] = device
    for (listener in connectionListeners.snapshot()) listener(device, connected)
  }
}
