import ExpoModulesCore

/** The corner cut off each card. `all` cuts top-left and bottom-right, like the kit's CornerCutFrame. */
enum NycCutCorner: String, Enumerable {
  case topLeft = "top-left"
  case topRight = "top-right"
  case bottomRight = "bottom-right"
  case bottomLeft = "bottom-left"
  case all
}
