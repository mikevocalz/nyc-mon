import Foundation
import NitroModules

/// iOS half of `GamepadInput`. Orchestration only: four listener registries
/// and one `GameControllerObserver` that feeds them from the module's
/// serial queue. Nitro moves each callback onto the JS thread.
final class HybridGamepadInput: HybridGamepadInputSpec {
  private static let queue = DispatchQueue(label: "com.nycmon.gamepad-input")

  private let connectionListeners = ListenerRegistry<(GamepadDevice, Bool) -> Void>()
  private let buttonListeners = ListenerRegistry<(GamepadButton, Bool, String, Double) -> Void>()
  private let axisListeners = ListenerRegistry<(GamepadAxis, Double, String, Double) -> Void>()
  private let keyListeners = ListenerRegistry<(String, Bool, Double) -> Void>()
  private var observer: GameControllerObserver?

  override init() {
    super.init()
    observer = GameControllerObserver(
      queue: Self.queue,
      callbacks: GameControllerObserver.Callbacks(
        onConnection: { [connectionListeners] device, connected in
          for listener in connectionListeners.snapshot() { listener(device, connected) }
        },
        onButton: { [buttonListeners] button, pressed, deviceId, timestampMs in
          for listener in buttonListeners.snapshot() { listener(button, pressed, deviceId, timestampMs) }
        },
        onAxis: { [axisListeners] axis, value, deviceId, timestampMs in
          for listener in axisListeners.snapshot() { listener(axis, value, deviceId, timestampMs) }
        },
        onKey: { [keyListeners] keyCode, pressed, timestampMs in
          for listener in keyListeners.snapshot() { listener(keyCode, pressed, timestampMs) }
        }
      )
    )
  }

  // GameController is always present on iOS 14+; the podspec links it.
  var isAvailable: Bool { true }

  func getConnectedDevices() throws -> [GamepadDevice] {
    return observer?.connectedDevices() ?? []
  }

  func addOnConnectionChangedListener(listener: @escaping (_ device: GamepadDevice, _ connected: Bool) -> Void) throws -> ListenerSubscription {
    return connectionListeners.add(listener)
  }

  func addOnButtonListener(listener: @escaping (_ button: GamepadButton, _ pressed: Bool, _ deviceId: String, _ timestampMs: Double) -> Void) throws -> ListenerSubscription {
    return buttonListeners.add(listener)
  }

  func addOnAxisListener(listener: @escaping (_ axis: GamepadAxis, _ value: Double, _ deviceId: String, _ timestampMs: Double) -> Void) throws -> ListenerSubscription {
    return axisListeners.add(listener)
  }

  func addOnKeyListener(listener: @escaping (_ keyCode: String, _ pressed: Bool, _ timestampMs: Double) -> Void) throws -> ListenerSubscription {
    return keyListeners.add(listener)
  }
}
