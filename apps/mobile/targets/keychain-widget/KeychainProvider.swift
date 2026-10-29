import WidgetKit

struct KeychainProvider: TimelineProvider {
  func placeholder(in context: Context) -> KeychainEntry {
    KeychainEntry(date: .now, state: .live(.sample, calling: false))
  }

  func getSnapshot(in context: Context, completion: @escaping (KeychainEntry) -> Void) {
    let stored = KeychainSnapshotStore.load()
    let entry = context.isPreview && stored == nil
      ? placeholder(in: context)
      : KeychainTimeline.entries(for: stored, now: .now)[0]
    completion(entry)
  }

  /// `.never`: the app reloads this kind whenever what the widget draws changes,
  /// and the entries already cover the next call and the stale point.
  func getTimeline(in context: Context, completion: @escaping (Timeline<KeychainEntry>) -> Void) {
    let entries = KeychainTimeline.entries(for: KeychainSnapshotStore.load(), now: .now)
    completion(Timeline(entries: entries, policy: .never))
  }
}
