/// 1-bit glyphs shared with the in-app LCD (packages/ui/care/pixel-glyphs.ts,
/// lane c). `#` is a lit cell. Same bitmaps, so a heart on the Lock Screen is
/// the heart on the Mon Space screen.
enum PixelGlyph {
  case heart
  case heartEmpty

  var rows: [String] {
    switch self {
    case .heart:
      return [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."]
    case .heartEmpty:
      return [".##.##.", "#..#..#", "#.....#", ".#...#.", "..#.#..", "...#..."]
    }
  }

  var width: Int { rows.first?.count ?? 0 }
  var height: Int { rows.count }
}
