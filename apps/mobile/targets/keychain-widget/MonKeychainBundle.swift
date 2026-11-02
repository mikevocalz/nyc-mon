// The Mon keychain: a Lock Screen and Home Screen widget showing the active
// Mon's hearts and whether it is calling (canon Decision #36, design D20).
// Data comes from the app through the App Group (KeychainSnapshotStore);
// the widget has no care buttons.
// SOT: packages/app/features/mon-space/keychain-snapshot.ts
import SwiftUI
import WidgetKit

@main
struct MonKeychainBundle: WidgetBundle {
  var body: some Widget {
    MonKeychainWidget()
  }
}
