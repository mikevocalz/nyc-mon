import SwiftUI

/// Lock Screen rectangle: the lamp and the status line ("Squeaklet is
/// calling"), then the three labelled heart rows.
struct KeychainRectangularView: View {
  let state: KeychainState

  var body: some View {
    switch state {
    case .empty:
      Text(KeychainCopy.empty)
        .font(.system(size: 13, weight: .semibold, design: .monospaced))
        .frame(maxWidth: .infinity, alignment: .leading)
    case let .stale(snapshot):
      VStack(alignment: .leading, spacing: 2) {
        Text(snapshot.text.title).font(.system(size: 13, weight: .bold, design: .monospaced)).lineLimit(1)
        Text(snapshot.text.stale).font(.system(size: 11, design: .monospaced)).lineLimit(2)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    case let .live(snapshot, calling):
      VStack(alignment: .leading, spacing: 1) {
        HStack(spacing: 4) {
          LedDotView(calling: calling, size: 7)
          Text(calling ? snapshot.text.calling : snapshot.text.status)
            .font(.system(size: 12, weight: .bold, design: .monospaced))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        }
        MeterRowView(label: snapshot.text.meters.fullness, lit: snapshot.hearts.fullness, cell: 1.1, fontSize: 10)
        MeterRowView(label: snapshot.text.meters.energy, lit: snapshot.hearts.energy, cell: 1.1, fontSize: 10)
        MeterRowView(label: snapshot.text.meters.social, lit: snapshot.hearts.social, cell: 1.1, fontSize: 10)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}
