package expo.modules.nyccarousel

import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.gestures.TargetedFlingBehavior
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.carousel.CarouselDefaults
import androidx.compose.material3.carousel.CarouselItemScope
import androidx.compose.material3.carousel.HorizontalCenteredHeroCarousel
import androidx.compose.material3.carousel.HorizontalMultiBrowseCarousel
import androidx.compose.material3.carousel.HorizontalUncontainedCarousel
import androidx.compose.material3.carousel.rememberCarouselState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.view.size
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.ui.CarouselItemComposableScope
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.composeOrNull
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.filterNotNull

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FunctionalComposableScope.NycCarouselContent(
  props: NycCarouselProps,
  onIndexChange: (NycCarouselIndexChangeEvent) -> Unit
) {
  // Mirror view.size into snapshot state so the carousel recomposes when
  // React adds or removes slides (same reason as @expo/ui's HorizontalPager:
  // view.size is a plain property and registers no snapshot read).
  val itemCount = remember { mutableIntStateOf(view.size) }
  DisposableEffect(view) {
    view.setOnHierarchyChangeListener(object : ViewGroup.OnHierarchyChangeListener {
      override fun onChildViewAdded(parent: View?, child: View?) {
        itemCount.intValue = view.size
      }
      override fun onChildViewRemoved(parent: View?, child: View?) {
        itemCount.intValue = view.size
      }
    })
    itemCount.intValue = view.size
    onDispose { view.setOnHierarchyChangeListener(null) }
  }

  val state = rememberCarouselState(initialItem = props.index.coerceAtLeast(0)) { itemCount.intValue }
  val count = itemCount.intValue
  val latestOnIndexChange = rememberUpdatedState(onIndexChange)

  // JS -> native: scroll when the controlled index moves off the item on screen.
  LaunchedEffect(props.index, count) {
    if (count == 0) return@LaunchedEffect
    val target = props.index.coerceIn(0, count - 1)
    if (target == state.currentItem) return@LaunchedEffect
    if (props.animated) state.animateScrollToItem(target) else state.scrollToItem(target)
  }

  // Native -> JS: report the item the carousel settles on. Null while a
  // scroll is moving, so only settled positions reach JS; the first value is
  // the initial index, which JS already has.
  LaunchedEffect(state) {
    snapshotFlow { if (state.isScrollInProgress) null else state.currentItem }
      .filterNotNull()
      .distinctUntilChanged()
      .drop(1)
      .collect { latestOnIndexChange.value(NycCarouselIndexChangeEvent(it)) }
  }

  if (count == 0) return

  val flingBehavior: TargetedFlingBehavior = if (props.snap) {
    CarouselDefaults.singleAdvanceFlingBehavior(state = state)
  } else {
    CarouselDefaults.noSnapFlingBehavior()
  }
  val modifier = ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher)
  val padding = PaddingValues(horizontal = props.contentPadding.dp)
  val shape = props.cutCorner.toShape(props.cut.dp)
  val keyline = props.keylineColor.composeOrNull?.let { BorderStroke(props.keylineWidth.dp, it) }

  // Each slide: the RN card (an RNHostView child) masked to the corner-cut
  // shape. maskClip/maskBorder follow the carousel's mask, so peeking items
  // keep the cut while the strategy squeezes them.
  val item: @Composable CarouselItemScope.(Int) -> Unit = { index ->
    val itemScope = this
    val masked = Modifier.fillMaxWidth().maskClip(shape)
    Box(if (keyline != null) masked.maskBorder(keyline, shape) else masked) {
      Child(CarouselItemComposableScope(itemScope), index)
    }
  }

  when (props.variant) {
    NycCarouselVariant.HERO -> HorizontalCenteredHeroCarousel(
      state = state,
      modifier = modifier,
      maxItemWidth = if (props.maxItemWidth > 0f) props.maxItemWidth.dp else Dp.Unspecified,
      itemSpacing = props.itemSpacing.dp,
      flingBehavior = flingBehavior,
      userScrollEnabled = props.userScrollEnabled,
      contentPadding = padding,
      content = item
    )
    NycCarouselVariant.MULTI_BROWSE -> HorizontalMultiBrowseCarousel(
      state = state,
      preferredItemWidth = props.itemWidth.dp,
      modifier = modifier,
      itemSpacing = props.itemSpacing.dp,
      flingBehavior = flingBehavior,
      userScrollEnabled = props.userScrollEnabled,
      contentPadding = padding,
      content = item
    )
    NycCarouselVariant.UNCONTAINED -> HorizontalUncontainedCarousel(
      state = state,
      itemWidth = props.itemWidth.dp,
      modifier = modifier,
      itemSpacing = props.itemSpacing.dp,
      flingBehavior = flingBehavior,
      userScrollEnabled = props.userScrollEnabled,
      contentPadding = padding,
      content = item
    )
  }
}
