import SwiftUI
import WidgetKit

/// Picks the family layout, sets the one VoiceOver label for the whole widget,
/// and deep-links a tap to Mon Space (`nycmon://mon-space`, Decision #23).
struct KeychainEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: KeychainEntry

  var body: some View {
    content
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(entry.state.accessibilityLabel)
      .widgetURL(URL(string: "nycmon://mon-space"))
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryCircular:
      KeychainCircularView(state: entry.state)
        .containerBackground(for: .widget) { AccessoryWidgetBackground() }
    case .accessoryRectangular:
      KeychainRectangularView(state: entry.state)
        .containerBackground(for: .widget) { Color.clear }
    default:
      KeychainSmallView(state: entry.state)
    }
  }
}
