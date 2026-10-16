import GameController

extension GamepadFamily {
  /// Classifies a `GCDevice.productCategory` string. Apple names Xbox,
  /// DualShock 4, DualSense and MFi; Nintendo pads arrive as the generic HID
  /// category, so the vendor name is the only signal for them.
  static func from(productCategory: String, vendorName: String?) -> GamepadFamily {
    switch productCategory {
    case GCProductCategoryXboxOne:
      return .xbox
    case GCProductCategoryDualShock4, GCProductCategoryDualSense:
      return .playstation
    case GCProductCategoryKeyboard:
      return .keyboard
    default:
      let name = (vendorName ?? "").lowercased()
      if name.contains("nintendo") || name.contains("switch") || name.contains("joy-con") {
        return .nintendo
      }
      return .generic
    }
  }
}
