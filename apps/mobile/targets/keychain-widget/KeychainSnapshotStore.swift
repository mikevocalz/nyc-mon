import Foundation

/// Reads the snapshot the app writes. Keys match the app's
/// modules/keychain-widget/ios/KeychainStore.swift.
enum KeychainSnapshotStore {
  static let snapshotKey = "keychain.snapshot.v1"

  /// The snapshot, or nil when the app has not written one, the App Group is
  /// missing, or the JSON is from a version this widget does not read.
  static func load() -> KeychainSnapshot? {
    guard
      let group = Bundle.main.appGroupIdentifier,
      let json = UserDefaults(suiteName: group)?.string(forKey: snapshotKey),
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(KeychainSnapshot.self, from: data),
      snapshot.v == KeychainSnapshot.supportedVersion
    else { return nil }
    return snapshot
  }
}
