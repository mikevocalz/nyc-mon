import SwiftUI

@main
struct MonWatchApp: App {
  @WKApplicationDelegateAdaptor(MonWatchDelegate.self) private var delegate

  var body: some Scene {
    WindowGroup {
      NavigationStack { MonWatchView(store: MonWatchStore.shared) }
    }
  }
}
