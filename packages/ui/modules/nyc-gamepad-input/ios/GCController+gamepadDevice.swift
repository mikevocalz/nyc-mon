import GameController

extension GCController {
  /// The JS-facing record for this controller under the id the observer
  /// assigned on connect. `vendorName` is nil for some generic HID pads;
  /// the product category stands in so the diagnostics overlay has a name.
  func gamepadDevice(id: String) -> GamepadDevice {
    let family = GamepadFamily.from(productCategory: productCategory, vendorName: vendorName)
    return GamepadDevice(id: id, name: vendorName ?? productCategory, family: family)
  }
}
