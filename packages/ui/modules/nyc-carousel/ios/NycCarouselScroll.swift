import ExpoModulesCore
import ExpoUI
import SwiftUI

/**
 The carousel: a horizontal paging ScrollView over the React Native cards.

 - Snapping is `scrollTargetBehavior(.viewAligned)` over a `scrollTargetLayout`.
 - The controlled index is bound through `scrollPosition(id:)`. JS changes
   to `props.index` scroll to that card, and the card the user lands on is
   sent back as `onIndexChange`.
 - With `parallax`, a second `scrollTransition` before the clip moves the
   card's content against the scroll inside its cut mask (image cards).
 - `scrollTransition` gives the Material strategies their look: in hero and
   multi-browse the cards outside the focus position shrink and dim, the way
   Material's keylines squeeze peeking items.
 */
@available(iOS 17.0, *)
struct NycCarouselScroll: View {
  @ObservedObject var props: NycCarouselViewProps
  @State private var position: Int?
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  /** Width of the neighbours that peek in either side of a hero card. */
  private let heroPeek: CGFloat = 40
  /** How far image content drifts inside its mask across one card of scroll. */
  private let parallaxShift: CGFloat = 28

  var body: some View {
    let children = props.children ?? []
    let shape = CornerCutShape(corner: props.cutCorner, cut: CGFloat(props.cut))
    let spacing = CGFloat(props.itemSpacing)

    ScrollView(.horizontal) {
      LazyHStack(alignment: .top, spacing: spacing) {
        ForEach(Array(children.enumerated()), id: \.element.childIdentity) { index, child in
          card(child, index: index, shape: shape, spacing: spacing)
        }
      }
      .scrollTargetLayout()
    }
    .scrollIndicators(.hidden)
    .scrollDisabled(!props.userScrollEnabled)
    .contentMargins(.horizontal, horizontalMargin(spacing: spacing), for: .scrollContent)
    .modifier(NycCarouselSnap(snap: props.snap))
    .scrollPosition(id: $position, anchor: props.variant == .hero ? .center : .leading)
    .onAppear {
      position = clamped(props.index, count: children.count)
    }
    .onChange(of: props.index) { _, next in
      scroll(to: next, count: children.count)
    }
    .onChange(of: position) { _, settled in
      guard let settled else {
        return
      }
      props.onIndexChange(["index": settled])
    }
  }

  @ViewBuilder
  private func card(_ child: any ExpoSwiftUI.AnyChild, index: Int, shape: CornerCutShape, spacing: CGFloat) -> some View {
    let view: any View = child.childView
    let keyline = props.keylineColor
    // Read on the main actor here; scrollTransition's closure is Sendable.
    let squeezes = props.variant != .uncontained && !reduceMotion
    let drifts = props.parallax && !reduceMotion
    AnyView(view)
      .modifier(
        NycCarouselItemFrame(
          variant: props.variant,
          visibleCount: props.visibleCount,
          itemWidth: CGFloat(props.itemWidth),
          maxItemWidth: CGFloat(props.maxItemWidth),
          spacing: spacing
        )
      )
      // Parallax runs before the clip, so the content moves inside the cut
      // shape. The 1.12 overscan keeps the shifted edge out of view.
      .scrollTransition(axis: .horizontal) { content, phase in
        content
          .offset(x: drifts ? phase.value * -parallaxShift : 0)
          .scaleEffect(drifts ? 1.12 : 1)
      }
      .clipShape(shape)
      .overlay {
        if let keyline {
          shape.stroke(keyline, lineWidth: CGFloat(props.keylineWidth))
        }
      }
      .scrollTransition(axis: .horizontal) { content, phase in
        content
          .scaleEffect(squeezes && !phase.isIdentity ? 0.86 : 1, anchor: phase.value < 0 ? .trailing : .leading)
          .opacity(squeezes && !phase.isIdentity ? 0.7 : 1)
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel(index < props.itemLabels.count ? props.itemLabels[index] : "")
      .id(index)
  }

  private func horizontalMargin(spacing: CGFloat) -> CGFloat {
    let base = CGFloat(props.contentPadding)
    return props.variant == .hero ? base + heroPeek + spacing : base
  }

  private func clamped(_ index: Int, count: Int) -> Int {
    return max(0, min(index, max(0, count - 1)))
  }

  private func scroll(to index: Int, count: Int) {
    let target = clamped(index, count: count)
    guard count > 0, target != position else {
      return
    }
    if props.animated && !reduceMotion {
      withAnimation(.snappy) {
        position = target
      }
    } else {
      position = target
    }
  }
}
