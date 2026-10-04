package expo.modules.nyccarousel

import android.graphics.Color
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList

@OptimizedComposeProps
data class NycCarouselProps(
  val variant: NycCarouselVariant = NycCarouselVariant.UNCONTAINED,
  /** Controlled index. When it differs from the item on screen, the carousel scrolls to it. */
  val index: Int = 0,
  /** Animate those scrolls. JS passes false under reduced motion. */
  val animated: Boolean = true,
  /** Uncontained: each item's width. Multi-browse: the large item's preferred width. dp. */
  val itemWidth: Float = 280f,
  /** Hero: the widest the centred item may grow, dp. 0 lets it fill. */
  val maxItemWidth: Float = 0f,
  val itemSpacing: Float = 16f,
  /** Horizontal padding inside the scroll area, dp. */
  val contentPadding: Float = 0f,
  /** Snap a card at a time (true) or scroll freely (false). */
  val snap: Boolean = true,
  val userScrollEnabled: Boolean = true,
  val cutCorner: NycCutCorner = NycCutCorner.BOTTOM_RIGHT,
  /** Corner cut length, dp. 0 leaves square corners. */
  val cut: Float = 16f,
  /** Keyline drawn around each card's cut shape, in the slider tone. Null draws none. */
  val keylineColor: Color? = null,
  val keylineWidth: Float = 2f,
  val modifiers: ModifierList = emptyList()
) : ComposeProps
