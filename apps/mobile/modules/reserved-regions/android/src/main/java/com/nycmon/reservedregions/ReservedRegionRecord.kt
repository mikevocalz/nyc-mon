package com.nycmon.reservedregions

import io.github.expo.modules.v2.Record

/**
 * One region as JS receives it, in dp, window-relative. Mirrors
 * `ReservedRegion` in packages/ui/reserved-regions.types.ts; the four nullable
 * fields are Android FoldingFeature metadata that UIKit regions lack.
 */
@Record
data class ReservedRegionRecord(
  val kind: String,
  val x: Double,
  val y: Double,
  val width: Double,
  val height: Double,
  val margins: RegionMarginsRecord,
  val active: Boolean,
  val orientation: String?,
  val state: String?,
  val occlusionType: String?,
  val separating: Boolean?,
)
