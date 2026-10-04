// The interactive-content margins UIKit folds into a reserved region's frame.
// SOT-KEYWORDS: reserved region margins
import ExpoModulesCore
import UIKit

@Record
struct ReservedRegionMargins {
  var top: Double
  var left: Double
  var bottom: Double
  var right: Double
}

extension ReservedRegionMargins {
  init(insets: UIEdgeInsets) {
    self.init(top: insets.top, left: insets.left, bottom: insets.bottom, right: insets.right)
  }
}
