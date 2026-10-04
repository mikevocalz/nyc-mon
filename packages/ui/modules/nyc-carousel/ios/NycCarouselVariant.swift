import ExpoModulesCore

/**
 The layout strategy, named after Material 3's carousels so both platforms
 take the same prop.
 - hero: one centred card between two peeking neighbours.
 - multiBrowse: a large leading card with the next ones shrinking after it.
 - uncontained: `visibleCount` equal cards per page, the web slider's layout.
 */
enum NycCarouselVariant: String, Enumerable {
  case hero
  case multiBrowse
  case uncontained
}
