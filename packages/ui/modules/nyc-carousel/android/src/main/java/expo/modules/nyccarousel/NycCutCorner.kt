package expo.modules.nyccarousel

import expo.modules.kotlin.types.Enumerable

/** The corner cut off each card, the kit's corner-cut look. `all` cuts top-left and bottom-right. */
enum class NycCutCorner(val value: String) : Enumerable {
  TOP_LEFT("top-left"),
  TOP_RIGHT("top-right"),
  BOTTOM_RIGHT("bottom-right"),
  BOTTOM_LEFT("bottom-left"),
  ALL("all")
}
