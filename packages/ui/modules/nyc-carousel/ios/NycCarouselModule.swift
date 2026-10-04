import ExpoModulesCore
import ExpoUI

/**
 NYC-MON's card carousel on iOS: a SwiftUI paging scroll view whose cards
 are React Native views hosted through @expo/ui's `RNHostView`. Registered
 with `ExpoUIView`, so it sits inside an @expo/ui `Host` and accepts the
 shared `modifiers` prop.

 This module only registers a view. The Expo Modules 2.0 macros
 (`@ExpoModule`, `@JS`, `@Event`) in expo-modules-core 58 cover module
 functions, properties and events but not views, so it uses the
 `ModuleDefinition` DSL.
 */
public final class NycCarouselModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NycCarousel")

    // scrollPosition(id:), scrollTargetBehavior and containerRelativeFrame
    // need iOS 17. Below it JS keeps the React Native list slider.
    Constant("isSupported") { () -> Bool in
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    }

    ExpoUIView(NycCarouselView.self)
  }
}
