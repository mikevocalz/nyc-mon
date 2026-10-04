// The app window's reserved regions — where a fold divides the display and
// where the camera occludes it — for React to lay out around.
//
// Why it exists: iPhone Duo. Safe-area insets say where the system-owned
// COLUMN is, but not where the fold runs or where the camera circle sits, and
// a card that straddles the fold in book pose is exactly what Apple says not to
// do. iOS 27.1 exposes both as `UIView.reservedRegions(kind:)`; nothing in the
// React Native or Expo tree bridges it, so this does — as a query, not a
// stream. UIKit publishes no change notification for these regions; the JS
// side re-queries when the window resizes, which every fold and unfold does.
//
// Expo Modules API 2.0 (`@ExpoModule` / `@JS`); the macro plugin is injected
// into every autolinked Expo pod by expo-modules-autolinking, so the podspec
// declares nothing for it.
// SOT: packages/ui/reserved-regions.native.ts
// SOT-KEYWORDS: reserved regions fold division occlusion camera iphone duo uikit
import ExpoModulesCore
import UIKit

@ExpoModule("ReservedRegions")
public final class ReservedRegionsModule: Module {
  /*
    `async` so the UIKit read can hop to the main actor once, at the boundary;
    the read itself is cheap. Inactive regions are included on purpose — a flat
    Duo reports its fold at zero width but still says where it is, which is
    what a layout wants to know before the next fold.
  */
  @JS
  func query() async -> [ReservedRegionRecord] {
#if os(iOS) && NYCMON_HAS_UIKIT_RESERVED_REGIONS
    return await MainActor.run {
      guard #available(iOS 27.1, *), let view = UIWindow.keyRootView else { return [] }
      let regions =
        view.reservedRegions(kind: .division, options: [.includeInactive])
        + view.reservedRegions(kind: .occlusion, options: [.includeInactive])
      return regions.map { ReservedRegionRecord(region: $0) }
    }
#else
    // Xcode/iOS SDKs before 27.1 do not declare UIView.ReservedRegion at all,
    // so an @available check alone cannot make a static reference compile.
    // The podspec enables NYCMON_HAS_UIKIT_RESERVED_REGIONS only when the
    // installed SDK actually contains the API.
    return []
#endif
  }
}
