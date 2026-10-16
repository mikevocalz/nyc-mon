import Foundation
import GameController

/// Owns the GameController side: connection notifications, the id each
/// controller gets for its connection, and the handler bindings. Everything
/// mutable here is touched only on `queue`; notifications are observed on
/// that queue too, so there is one owner and no lock.
final class GameControllerObserver {
  struct Callbacks {
    let onConnection: (GamepadDevice, Bool) -> Void
    let onButton: (GamepadButton, Bool, String, Double) -> Void
    let onAxis: (GamepadAxis, Double, String, Double) -> Void
    let onKey: (String, Bool, Double) -> Void
  }

  static let keyboardId = "keyboard"

  private let queue: DispatchQueue
  private let callbacks: Callbacks
  private let operationQueue = OperationQueue()
  private var controllerIds: [ObjectIdentifier: String] = [:]
  private var observers: [NSObjectProtocol] = []
  /// Written on `queue`, read from the JS thread by `connectedDevices()`.
  /// The one value two threads share, so the one place a lock is justified.
  private let devicesLock = NSLock()
  private var devices: [String: GamepadDevice] = [:]

  init(queue: DispatchQueue, callbacks: Callbacks) {
    self.queue = queue
    self.callbacks = callbacks
    operationQueue.underlyingQueue = queue
    operationQueue.maxConcurrentOperationCount = 1
    queue.async { self.start() }
  }

  deinit {
    for observer in observers {
      NotificationCenter.default.removeObserver(observer)
    }
  }

  /// Snapshot for `getConnectedDevices`, called from the JS thread.
  func connectedDevices() -> [GamepadDevice] {
    devicesLock.lock()
    defer { devicesLock.unlock() }
    return Array(devices.values)
  }

  private func storeDevice(_ device: GamepadDevice) {
    devicesLock.lock()
    devices[device.id] = device
    devicesLock.unlock()
  }

  private func removeDevice(id: String) -> GamepadDevice? {
    devicesLock.lock()
    defer { devicesLock.unlock() }
    return devices.removeValue(forKey: id)
  }

  private func hasDevice(id: String) -> Bool {
    devicesLock.lock()
    defer { devicesLock.unlock() }
    return devices[id] != nil
  }

  private func start() {
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: .GCControllerDidConnect, object: nil, queue: operationQueue) { [weak self] note in
      guard let controller = note.object as? GCController else { return }
      self?.attach(controller)
    })
    observers.append(center.addObserver(forName: .GCControllerDidDisconnect, object: nil, queue: operationQueue) { [weak self] note in
      guard let controller = note.object as? GCController else { return }
      self?.detach(controller)
    })
    observers.append(center.addObserver(forName: .GCKeyboardDidConnect, object: nil, queue: operationQueue) { [weak self] note in
      guard let keyboard = note.object as? GCKeyboard else { return }
      self?.attach(keyboard)
    })
    observers.append(center.addObserver(forName: .GCKeyboardDidDisconnect, object: nil, queue: operationQueue) { [weak self] _ in
      self?.detachKeyboard()
    })

    for controller in GCController.controllers() {
      attach(controller)
    }
    if let keyboard = GCKeyboard.coalesced {
      attach(keyboard)
    }
  }

  private func attach(_ controller: GCController) {
    guard let gamepad = controller.extendedGamepad else { return }
    let key = ObjectIdentifier(controller)
    guard controllerIds[key] == nil else { return }
    let id = UUID().uuidString
    controllerIds[key] = id
    controller.handlerQueue = queue
    gamepad.bindGamepadHandlers(deviceId: id, onButton: callbacks.onButton, onAxis: callbacks.onAxis)
    let device = controller.gamepadDevice(id: id)
    storeDevice(device)
    callbacks.onConnection(device, true)
  }

  private func detach(_ controller: GCController) {
    let key = ObjectIdentifier(controller)
    guard let id = controllerIds.removeValue(forKey: key), let device = removeDevice(id: id) else { return }
    callbacks.onConnection(device, false)
  }

  private func attach(_ keyboard: GCKeyboard) {
    guard !hasDevice(id: Self.keyboardId) else { return }
    keyboard.handlerQueue = queue
    keyboard.bindKeyHandlers(onKey: callbacks.onKey)
    let device = GamepadDevice(id: Self.keyboardId, name: keyboard.vendorName ?? "Keyboard", family: .keyboard)
    storeDevice(device)
    callbacks.onConnection(device, true)
  }

  private func detachKeyboard() {
    guard let device = removeDevice(id: Self.keyboardId) else { return }
    callbacks.onConnection(device, false)
  }
}
