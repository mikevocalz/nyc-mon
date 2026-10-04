package com.nycmon.reservedregions

import android.app.Activity
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowLayoutInfo

/**
 * Every FoldingFeature in this layout as a "division" region, converted from
 * physical pixels to dp with the Activity's display density.
 */
internal fun WindowLayoutInfo.toReservedRegionRecords(activity: Activity): List<ReservedRegionRecord> {
  val density = activity.resources.displayMetrics.density.toDouble()

  return displayFeatures
    .filterIsInstance<FoldingFeature>()
    .map { feature ->
      val bounds = feature.bounds

      ReservedRegionRecord(
        kind = "division",
        x = bounds.left / density,
        y = bounds.top / density,
        width = bounds.width() / density,
        height = bounds.height() / density,
        margins = RegionMarginsRecord(
          top = 0.0,
          left = 0.0,
          bottom = 0.0,
          right = 0.0,
        ),
        // A FoldingFeature returned for the current WindowLayoutInfo is current.
        // Whether it actually divides the UI is expressed separately below.
        active = true,
        orientation = when (feature.orientation) {
          FoldingFeature.Orientation.HORIZONTAL -> "horizontal"
          FoldingFeature.Orientation.VERTICAL -> "vertical"
          else -> null
        },
        state = when (feature.state) {
          FoldingFeature.State.FLAT -> "flat"
          FoldingFeature.State.HALF_OPENED -> "halfOpened"
          else -> null
        },
        occlusionType = when (feature.occlusionType) {
          FoldingFeature.OcclusionType.NONE -> "none"
          FoldingFeature.OcclusionType.FULL -> "full"
          else -> null
        },
        separating = feature.isSeparating,
      )
    }
}
