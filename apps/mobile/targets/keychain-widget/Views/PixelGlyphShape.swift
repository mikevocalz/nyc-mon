import SwiftUI

/// Draws a `PixelGlyph` as square cells filling the frame, with a hairline gap
/// between cells so it reads as dot-matrix. One path, one fill: it renders as a
/// single shape in the Lock Screen's vibrant (monochrome) mode.
struct PixelGlyphShape: Shape {
  let glyph: PixelGlyph

  func path(in rect: CGRect) -> Path {
    let cell = min(rect.width / CGFloat(glyph.width), rect.height / CGFloat(glyph.height))
    let gap = cell * 0.12
    var path = Path()
    for (y, row) in glyph.rows.enumerated() {
      for (x, char) in row.enumerated() where char == "#" {
        path.addRect(CGRect(x: rect.minX + CGFloat(x) * cell, y: rect.minY + CGFloat(y) * cell, width: cell - gap, height: cell - gap))
      }
    }
    return path
  }
}
