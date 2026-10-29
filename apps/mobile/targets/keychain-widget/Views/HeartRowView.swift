import SwiftUI

/// Four hearts, `lit` of them filled (D20a). Unlit hearts are outlines, so the
/// count reads without colour. Lit hearts take the accent in tinted mode.
/// Decorative: the widget's one accessibility label speaks the counts.
struct HeartRowView: View {
  let lit: Int
  let cell: CGFloat

  var body: some View {
    HStack(spacing: cell) {
      ForEach(0..<4, id: \.self) { index in
        if index < lit {
          PixelGlyphShape(glyph: .heart)
            .frame(width: cell * 7, height: cell * 6)
            .widgetAccentable()
        } else {
          PixelGlyphShape(glyph: .heartEmpty)
            .frame(width: cell * 7, height: cell * 6)
        }
      }
    }
    .accessibilityHidden(true)
  }
}
