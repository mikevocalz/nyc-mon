import SwiftUI

/// Home Screen LCD colours, the same primitives as the in-app LCD
/// (packages/ui/care/lcd-model.ts `lcdColors`): daylit paper is concrete-200
/// with ink-900 cells (13.0:1); night is brand night with carolina-300 cells
/// (12.6:1). The lamp is `led.on` / `led.off` (packages/theme/tokens.ts).
struct LcdPalette {
  let ground: Color
  let ink: Color
  let unlit: Color
  let lampOn: Color
  let lampOff: Color

  static func forScheme(_ scheme: ColorScheme) -> LcdPalette {
    scheme == .dark
      ? LcdPalette(ground: Color(hex: 0x00041C), ink: Color(hex: 0xA5D4F8), unlit: Color(hex: 0x25293D), lampOn: Color(hex: 0xF80000), lampOff: Color(hex: 0x5E0000))
      : LcdPalette(ground: Color(hex: 0xD2D4D6), ink: Color(hex: 0x14182E), unlit: Color(hex: 0xB8BBBE), lampOn: Color(hex: 0xF80000), lampOff: Color(hex: 0x5E0000))
  }
}
