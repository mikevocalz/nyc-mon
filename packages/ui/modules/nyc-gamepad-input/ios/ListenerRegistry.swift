import Foundation

/// Additive listener list behind every `addOn…Listener` method.
///
/// Mutated from the JS thread (add/remove) and read from the module's
/// GameController queue (emit), so the dictionary is guarded by a lock.
/// The lock is never held while a listener runs: `snapshot()` copies the
/// closures out and the caller invokes them afterwards. A listener removed
/// during an in-flight emission may still receive that one event. Listeners
/// are kept in insertion order, so delivery order is the order they were added
/// (matching Android's list).
final class ListenerRegistry<Listener> {
  private let lock = NSLock()
  private var listeners: [(key: UUID, listener: Listener)] = []

  func add(_ listener: Listener) -> ListenerSubscription {
    let key = UUID()
    lock.lock()
    listeners.append((key: key, listener: listener))
    lock.unlock()
    return ListenerSubscription(remove: { [weak self] in
      guard let self else { return }
      self.lock.lock()
      self.listeners.removeAll { $0.key == key }
      self.lock.unlock()
    })
  }

  func snapshot() -> [Listener] {
    lock.lock()
    defer { lock.unlock() }
    return listeners.map { $0.listener }
  }
}
