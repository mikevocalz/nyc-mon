import SwiftUI
import WidgetKit

struct MonKeychainWidget: Widget {
  /// Matches `KeychainStore.widgetKind` in the app's keychain-widget module, which reloads this kind.
  static let kind = "MonKeychain"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: KeychainProvider()) { entry in
      KeychainEntryView(entry: entry)
    }
    // COPY_DECK keychain.gallery.title / keychain.gallery.body. The gallery is drawn
    // before the app has written anything, so these two strings live here.
    .configurationDisplayName("Mon keychain")
    .description("See your Mon's hearts, and whether your Mon is calling.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .systemSmall])
  }
}
