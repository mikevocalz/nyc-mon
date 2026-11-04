import Foundation
import WatchConnectivity
import os

/// One process-wide session. The widget's persisted snapshot is also the sync outbox.
final class MonWatchSender: NSObject, WCSessionDelegate {
  static let shared = MonWatchSender()
  private let queue = DispatchQueue(label: "com.nycmon.watch.sender")
  private let logger = Logger(subsystem: "com.nycmon.app", category: "watch-sender")

  func start() {
    queue.async {
      guard WCSession.isSupported() else { return }
      let session = WCSession.default
      if session.delegate == nil {
        session.delegate = self
        session.activate()
      }
    }
  }

  func publish() {
    queue.async { self.sendLatest() }
  }

  private func sendLatest() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated,
          session.isPaired, session.isWatchAppInstalled else { return }
    // A false presence flag is a tombstone: signing out must clear the Watch too.
    let json = KeychainStore.defaults()?.string(forKey: KeychainStore.snapshotKey)
    var context: [String: Any] = ["v": 1, "hasSnapshot": json != nil]
    if let json { context["snapshot"] = json }
    do { try session.updateApplicationContext(context) }
    catch { logger.error("Snapshot transfer failed: \(error.localizedDescription, privacy: .public)") }
  }

  func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
    if let error { logger.error("Activation failed: \(error.localizedDescription, privacy: .public)") }
    publish()
  }

  func sessionWatchStateDidChange(_ session: WCSession) { publish() }
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    queue.async { session.activate() }
  }
}
