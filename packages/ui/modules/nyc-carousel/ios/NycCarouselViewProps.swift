import ExpoModulesCore
import ExpoUI
import SwiftUI

final class NycCarouselViewProps: UIBaseViewProps {
  @Field var variant: NycCarouselVariant = .uncontained
  /** Controlled index. When it differs from the card on screen, the carousel scrolls to it. */
  @Field var index: Int = 0
  /** Animate those scrolls. JS passes false under reduced motion. */
  @Field var animated: Bool = true
  /** Uncontained: equal cards per page. */
  @Field var visibleCount: Int = 1
  /** Multi-browse: width of the large card, points. */
  @Field var itemWidth: Double = 280
  /** Hero: the widest the centred card may grow, points. 0 lets it fill. */
  @Field var maxItemWidth: Double = 0
  @Field var itemSpacing: Double = 16
  /** Horizontal content margin, points. Hero adds its peek width to this. */
  @Field var contentPadding: Double = 0
  /** Snap to card edges (true) or scroll freely (false). */
  @Field var snap: Bool = true
  @Field var userScrollEnabled: Bool = true
  @Field var cutCorner: NycCutCorner = .bottomRight
  /** Corner cut length, points. 0 leaves square corners. */
  @Field var cut: Double = 16
  /** Keyline around each card's cut shape, in the slider tone. */
  @Field var keylineColor: Color?
  @Field var keylineWidth: Double = 2
  /** Spoken name for each card, e.g. "Card 2 of 6". */
  @Field var itemLabels: [String] = []

  var onIndexChange = EventDispatcher()
}
