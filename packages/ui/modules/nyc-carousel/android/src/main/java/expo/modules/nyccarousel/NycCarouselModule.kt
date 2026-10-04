package expo.modules.nyccarousel

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.ui.ExpoUIView

/**
 * NYC-MON's card carousel on Android: Material 3's carousels (centred hero,
 * multi-browse, uncontained) with a controlled index, which @expo/ui's own
 * carousel views do not expose. Registered through @expo/ui's ExpoUIView so
 * it lives inside an @expo/ui `Host` and takes `RNHostView` children.
 */
class NycCarouselModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NycCarousel")

    // Material 3 carousels need nothing beyond the Compose libraries @expo/ui
    // already ships. iOS reports false below iOS 17 so JS can fall back.
    Constant("isSupported") { true }

    ExpoUIView<NycCarouselProps>("NycCarouselView") {
      val onIndexChange by Event<NycCarouselIndexChangeEvent>()

      Content { props ->
        NycCarouselContent(props) { onIndexChange(it) }
      }
    }
  }
}
