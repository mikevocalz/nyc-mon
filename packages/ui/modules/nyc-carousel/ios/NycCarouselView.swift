import ExpoModulesCore
import ExpoUI
import SwiftUI

/**
 Entry view registered with ExpoUIView. The scroll implementation needs
 iOS 17; JS reads the module's `isSupported` constant and never mounts this
 view on older systems, so the fallback branch is empty.
 */
struct NycCarouselView: ExpoSwiftUI.View {
  @ObservedObject var props: NycCarouselViewProps

  init(props: NycCarouselViewProps) {
    self.props = props
  }

  var body: some View {
    if #available(iOS 17.0, *) {
      NycCarouselScroll(props: props)
    } else {
      EmptyView()
    }
  }
}
