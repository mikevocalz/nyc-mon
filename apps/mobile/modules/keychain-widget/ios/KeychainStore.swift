// Where the keychain snapshot lives. The keys match the widget extension's
// KeychainSnapshotStore.swift (apps/mobile/targets/keychain-widget) and the
// config plugin (apps/mobile/plugins/with-keychain-widget.js), which writes
// the App Group id into Info.plist under `NYCMonAppGroup`.
import Foundation

enum KeychainStore {
  static let snapshotKey = "keychain.snapshot.v1"
  static let widgetKind = "MonKeychain"

  static func defaults() -> UserDefaults? {
    guard let group = Bundle.main.appGroupIdentifier else { return nil }
    return UserDefaults(suiteName: group)
  }
}
