package com.nycmon.gameperf

import io.github.expo.modules.v2.Record

/*
 * Mirrors the fields JS needs from android.view.Display.Mode. ids are Doubles
 * because @Record fields ride the same marshal path as every other v2 type.
 */
@Record
class DisplayModeRecord(
  var id: Double = 0.0,
  var width: Double = 0.0,
  var height: Double = 0.0,
  var refreshRate: Double = 0.0,
  var current: Boolean = false,
)
