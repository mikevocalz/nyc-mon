import SwiftUI

/// Lock Screen circle: the status mark on top, then Fullness, Energy and Social
/// as three rows of four pixel hearts. A ring around the edge while calling.
struct KeychainCircularView: View {
  let state: KeychainState

  var body: some View {
    ZStack {
      switch state {
      case .empty:
        Text("?").font(.system(size: 20, weight: .bold, design: .monospaced))
      case let .stale(snapshot):
        Text(String(snapshot.monName.prefix(1)).uppercased())
          .font(.system(size: 20, weight: .bold, design: .monospaced))
      case let .live(snapshot, calling):
        if calling {
          Circle().strokeBorder(lineWidth: 2).widgetAccentable()
        }
        VStack(spacing: 2) {
          StatusGlyphView(snapshot: snapshot, calling: calling)
          HeartRowView(lit: snapshot.hearts.fullness, cell: 0.9)
          HeartRowView(lit: snapshot.hearts.energy, cell: 0.9)
          HeartRowView(lit: snapshot.hearts.social, cell: 0.9)
        }
      }
    }
  }
}
