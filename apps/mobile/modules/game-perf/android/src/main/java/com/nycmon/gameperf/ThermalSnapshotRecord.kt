package com.nycmon.gameperf

import io.github.expo.modules.v2.Record

/*
 * PowerManager thermal state at sample time. `status` is the THERMAL_STATUS_*
 * int; `headroom` is getThermalHeadroom() (0..1, NaN on devices without
 * thermal hardware -> marshalled as null); `headroomForecast` is
 * getThermalHeadroom(forecastSeconds) (API 30+, null below).
 */
@Record
class ThermalSnapshotRecord(
  var supported: Boolean = false,
  var status: Double = -1.0,
  var headroom: Double? = null,
  var headroomForecast: Double? = null,
)
