import SwiftUI

/// The circular widget's top mark: the lamp, or "z" asleep, or a pause bar pair.
struct StatusGlyphView: View {
  let snapshot: KeychainSnapshot
  let calling: Bool

  var body: some View {
    Group {
      if snapshot.paused {
        HStack(spacing: 2) {
          Rectangle().frame(width: 2.5, height: 8)
          Rectangle().frame(width: 2.5, height: 8)
        }
      } else if calling {
        LedDotView(calling: true, size: 8)
      } else if snapshot.asleep {
        Text("z").font(.system(size: 10, weight: .bold, design: .monospaced))
      } else {
        LedDotView(calling: false, size: 8)
      }
    }
    .frame(height: 10)
    .accessibilityHidden(true)
  }
}
