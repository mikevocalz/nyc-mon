package expo.modules.nyccarousel

import expo.modules.kotlin.types.Enumerable

/** Which Material 3 carousel strategy lays the items out. */
enum class NycCarouselVariant(val value: String) : Enumerable {
  HERO("hero"),
  MULTI_BROWSE("multiBrowse"),
  UNCONTAINED("uncontained")
}
