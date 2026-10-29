// Bridges the Mon keychain snapshot from JS to the WidgetKit extension.
//
// The app resolves every string and number in JS (packages/app/features/
// mon-space/keychain-snapshot.ts) and hands one JSON string here. This module
// stores it in the App Group's UserDefaults suite, where the extension's
// TimelineProvider reads it, then asks WidgetKit to reload that one widget
// kind. Both calls are cheap and thread-safe (UserDefaults and WidgetCenter
// document any-thread use), so the functions stay synchronous.
// SOT: packages/app/features/mon-space/keychain-widget.native.ts
// SOT-KEYWORDS: keychain widget app group widgetkit reload snapshot
import ExpoModulesCore
import WidgetKit

public final class KeychainWidgetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KeychainWidget")

    /// Writes the snapshot and reloads the widget. Returns false when the App Group is missing (a build without the plugin).
    Function("write") { (json: String) -> Bool in
      guard let defaults = KeychainStore.defaults() else { return false }
      defaults.set(json, forKey: KeychainStore.snapshotKey)
      WidgetCenter.shared.reloadTimelines(ofKind: KeychainStore.widgetKind)
      return true
    }

    /// Removes the snapshot (no active Mon, signed out) so the widget shows its empty state.
    Function("clear") { () -> Bool in
      guard let defaults = KeychainStore.defaults() else { return false }
      defaults.removeObject(forKey: KeychainStore.snapshotKey)
      WidgetCenter.shared.reloadTimelines(ofKind: KeychainStore.widgetKind)
      return true
    }
  }
}
