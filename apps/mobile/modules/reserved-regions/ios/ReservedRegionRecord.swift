// One reserved region as the record JS receives. Frame is in the root view's
// coordinate space, the same one `Dimensions.get('window')` describes.
// SOT-KEYWORDS: reserved region record fold occlusion
import ExpoModulesCore
import UIKit

@Record
struct ReservedRegionRecord {
  var kind: String
  var x: Double
  var y: Double
  var width: Double
  var height: Double
  var margins: ReservedRegionMargins
  var active: Bool
}

#if os(iOS) && NYCMON_HAS_UIKIT_RESERVED_REGIONS
@available(iOS 27.1, *)
extension ReservedRegionRecord {
  init(region: UIView.ReservedRegion) {
    self.init(
      kind: region.kind == .division ? "division" : "occlusion",
      x: region.frame.origin.x,
      y: region.frame.origin.y,
      width: region.frame.size.width,
      height: region.frame.size.height,
      margins: ReservedRegionMargins(insets: region.margins),
      active: region.isActive
    )
  }
}
#endif
