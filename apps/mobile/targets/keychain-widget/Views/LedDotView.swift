import SwiftUI

/// The attention lamp: filled when the Mon is calling, a ring when it is not.
/// Shape carries the state, colour only adds to it (red lamp on the Home
/// Screen, the vibrant tint on the Lock Screen). Never blinks: a widget cannot
/// animate, and a steady lamp is the reduced-motion form anyway (D20d).
struct LedDotView: View {
  let calling: Bool
  let size: CGFloat
  var onColor: Color = .primary
  var offColor: Color = .primary

  var body: some View {
    Group {
      if calling {
        Circle().fill(onColor).widgetAccentable()
      } else {
        Circle().strokeBorder(offColor, lineWidth: max(1, size * 0.18))
      }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}
