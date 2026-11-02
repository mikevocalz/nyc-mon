import SwiftUI

/// One labelled heart row: the meter word, then four hearts.
struct MeterRowView: View {
  let label: String
  let lit: Int
  let cell: CGFloat
  let fontSize: CGFloat

  var body: some View {
    HStack(spacing: 4) {
      Text(label)
        .font(.system(size: fontSize, weight: .medium, design: .monospaced))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .frame(maxWidth: .infinity, alignment: .leading)
      HeartRowView(lit: lit, cell: cell)
    }
  }
}
