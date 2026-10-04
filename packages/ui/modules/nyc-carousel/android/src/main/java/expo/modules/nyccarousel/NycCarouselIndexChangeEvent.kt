package expo.modules.nyccarousel

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord

/** Sent when the carousel settles on a new item, after a swipe or a scroll the index prop asked for. */
@OptimizedRecord
data class NycCarouselIndexChangeEvent(
  @Field val index: Int = 0
) : Record
