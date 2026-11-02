import SwiftUI
import WidgetKit

/// Home Screen small: the LCD panel. Daylit paper or backlit night following
/// the system appearance; in tinted or clear Home Screen modes the system
/// recolours it and the shapes (outline vs filled) still carry the state.
struct KeychainSmallView: View {
  @Environment(\.colorScheme) private var scheme
  let state: KeychainState

  var body: some View {
    let palette = LcdPalette.forScheme(scheme)
    VStack(alignment: .leading, spacing: 6) {
      switch state {
      case .empty:
        Text("NYC-MON").font(.system(size: 13, weight: .bold, design: .monospaced))
        Spacer(minLength: 0)
        Text(KeychainCopy.empty).font(.system(size: 13, design: .monospaced))
      case let .stale(snapshot):
        Text(snapshot.text.title).font(.system(size: 14, weight: .bold, design: .monospaced)).lineLimit(1)
        Spacer(minLength: 0)
        Text(snapshot.text.stale).font(.system(size: 12, design: .monospaced))
      case let .live(snapshot, calling):
        HStack(spacing: 6) {
          LedDotView(calling: calling, size: 9, onColor: palette.lampOn, offColor: palette.lampOff)
          Text(snapshot.text.title)
            .font(.system(size: 14, weight: .bold, design: .monospaced))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        VStack(spacing: 3) {
          MeterRowView(label: snapshot.text.meters.fullness, lit: snapshot.hearts.fullness, cell: 1.4, fontSize: 11)
          MeterRowView(label: snapshot.text.meters.energy, lit: snapshot.hearts.energy, cell: 1.4, fontSize: 11)
          MeterRowView(label: snapshot.text.meters.social, lit: snapshot.hearts.social, cell: 1.4, fontSize: 11)
        }
        Spacer(minLength: 0)
        Text(calling ? snapshot.text.calling : snapshot.text.status)
          .font(.system(size: 11, weight: .semibold, design: .monospaced))
          .lineLimit(1)
          .minimumScaleFactor(0.75)
        if let detail = snapshot.text.detail {
          Text(detail).font(.system(size: 10, design: .monospaced)).lineLimit(1)
        }
      }
    }
    .foregroundStyle(palette.ink)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .containerBackground(for: .widget) { palette.ground }
  }
}
