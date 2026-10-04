import SwiftUI

/** Card-edge snapping when `snap` is on; free scrolling otherwise. */
@available(iOS 17.0, *)
struct NycCarouselSnap: ViewModifier {
  let snap: Bool

  @ViewBuilder
  func body(content: Content) -> some View {
    if snap {
      content.scrollTargetBehavior(.viewAligned(limitBehavior: .always))
    } else {
      content
    }
  }
}
