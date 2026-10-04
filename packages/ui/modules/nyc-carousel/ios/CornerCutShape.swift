import SwiftUI

/**
 The kit's corner-cut card outline: a rectangle with one corner (or the
 top-left and bottom-right pair) cut at 45 degrees. Same geometry as
 `cornerCutPolygon` in packages/ui/neon/corner-cut.ts.
 */
struct CornerCutShape: Shape {
  let corner: NycCutCorner
  let cut: CGFloat

  func path(in rect: CGRect) -> Path {
    let c = max(0, min(cut, rect.width / 2, rect.height / 2))
    let cutsTopLeft = corner == .topLeft || corner == .all
    let cutsTopRight = corner == .topRight
    let cutsBottomRight = corner == .bottomRight || corner == .all
    let cutsBottomLeft = corner == .bottomLeft

    var path = Path()
    path.move(to: CGPoint(x: rect.minX, y: rect.minY + (cutsTopLeft ? c : 0)))
    if cutsTopLeft {
      path.addLine(to: CGPoint(x: rect.minX + c, y: rect.minY))
    }
    path.addLine(to: CGPoint(x: rect.maxX - (cutsTopRight ? c : 0), y: rect.minY))
    if cutsTopRight {
      path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + c))
    }
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - (cutsBottomRight ? c : 0)))
    if cutsBottomRight {
      path.addLine(to: CGPoint(x: rect.maxX - c, y: rect.maxY))
    }
    path.addLine(to: CGPoint(x: rect.minX + (cutsBottomLeft ? c : 0), y: rect.maxY))
    if cutsBottomLeft {
      path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - c))
    }
    path.closeSubpath()
    return path
  }
}
