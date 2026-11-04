import Foundation
import Combine
import WatchConnectivity
import os

/// UI state belongs to the main queue; connectivity callbacks cross that boundary once.
final class MonWatchStore: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = MonWatchStore()
  @Published private(set) var snapshot: KeychainSnapshot?
  private let snapshotKey = "keychain.snapshot.v1"
  private let logger = Logger(subsystem: "com.nycmon.app", category: "watch-receiver")

  private override init() {
    super.init()
    if let json = UserDefaults.standard.string(forKey: snapshotKey) {
      snapshot = decode(json)
    }
    if WCSession.isSupported() {
      WCSession.default.delegate = self
      WCSession.default.activate()
    }
  }

  private func decode(_ json: String) -> KeychainSnapshot? {
    guard let data = json.data(using: .utf8),
          let value = try? JSONDecoder().decode(KeychainSnapshot.self, from: data),
          value.v == KeychainSnapshot.supportedVersion,
          value.updatedAt.isFinite, value.staleAt.isFinite,
          value.staleAt >= value.updatedAt,
          [value.hearts.fullness, value.hearts.energy, value.hearts.social].allSatisfy({ (0...4).contains($0) })
    else { return nil }
    return value
  }

  private func receive(_ context: [String: Any]) {
    guard context["v"] as? Int == 1, let present = context["hasSnapshot"] as? Bool else { return }
    let json = context["snapshot"] as? String
    let value = json.flatMap(decode)
    guard !present || value != nil else {
      logger.error("Rejected unsupported Mon snapshot")
      return
    }
    DispatchQueue.main.async {
      self.snapshot = present ? value : nil
      if present, let json { UserDefaults.standard.set(json, forKey: self.snapshotKey) }
      else { UserDefaults.standard.removeObject(forKey: self.snapshotKey) }
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
    if let error { logger.error("Activation failed: \(error.localizedDescription, privacy: .public)") }
    if state == .activated { receive(session.receivedApplicationContext) }
  }

  func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) { receive(context) }
}
