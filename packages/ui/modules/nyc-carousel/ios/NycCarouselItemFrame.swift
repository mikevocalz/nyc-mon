import SwiftUI

/**
 Sizes one card for the strategy, relative to the scroll view's visible
 width (content margins already taken out).
 */
@available(iOS 17.0, *)
struct NycCarouselItemFrame: ViewModifier {
  let variant: NycCarouselVariant
  let visibleCount: Int
  let itemWidth: CGFloat
  let maxItemWidth: CGFloat
  let spacing: CGFloat

  @ViewBuilder
  func body(content: Content) -> some View {
    switch variant {
    case .uncontained:
      content.containerRelativeFrame(.horizontal, count: max(1, visibleCount), span: 1, spacing: spacing)
    case .hero:
      content.containerRelativeFrame(.horizontal) { width, _ in
        maxItemWidth > 0 ? min(width, maxItemWidth) : width
      }
    case .multiBrowse:
      content.containerRelativeFrame(.horizontal) { width, _ in
        min(width, itemWidth)
      }
    }
  }
}
