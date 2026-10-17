package com.nycmon.gameperf

import android.os.Build
import android.os.PerformanceHintManager
import android.os.PowerManager
import android.os.Process
import android.util.Log
import android.view.Display
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.react.currentActivity
import io.github.expo.modules.v2.react.reactContextOrNull
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/*
 * Game-loop platform glue (performance-pass PRs 4.2 + 5.1-2). Everything is
 * opt-in from JS: the mount functions in packages/app/features/game/perf are
 * flag-gated (EXPO_PUBLIC_WORLD_FRAME_RATE / _THERMAL / _ADPF), so with the
 * flags off this module is inert.
 *
 * - displayModes/requestDisplayMode vote a refresh rate through the app
 *   Window's LayoutParams (preferredDisplayModeId + preferredRefreshRate).
 *   That covers the TextureView game surface, which Surface.setFrameRate
 *   cannot reach. Window/SurfaceFlinger still owns the actual mode switch.
 * - thermalSnapshot reads PowerManager thermal status + headroom.
 * - startHintSession creates an ADPF PerformanceHintManager session (API 31+)
 *   over the calling thread's tid plus any named threads (e.g. the
 *   'nyc-mon-render' worklet runtime and 'RenderThread'), and
 *   reportWorkDuration feeds per-frame measured durations back to it.
 */
@ExpoModule(name = "GamePerf")
class GamePerfModule : Module() {
  private var hintSession: PerformanceHintManager.Session? = null

  // ---------------------------------------------------------------- display

  /** All supported modes of the display hosting the app window, current marked. */
  @JS
  suspend fun displayModes(): List<DisplayModeRecord> = withContext(Dispatchers.Main) {
    val display = display() ?: return@withContext emptyList()
    val currentId = display.mode?.modeId
    display.supportedModes.map { it.toRecord(current = it.modeId == currentId) }
  }

  /*
   * Vote for a supported display mode (modeId > 0), or clear the vote with
   * modeId <= 0. Returns the requested mode record, or null when the window or
   * mode was unavailable. Mode switches are non-seamless on most devices; the
   * displayRate mount only calls this when the requested mode differs from the
   * current one.
   */
  @JS
  suspend fun requestDisplayMode(modeId: Double): DisplayModeRecord? = withContext(Dispatchers.Main) {
    val activity = currentActivity ?: return@withContext null
    val display = display() ?: return@withContext null
    val lp = activity.window.attributes
    if (modeId <= 0) {
      lp.preferredDisplayModeId = 0
      lp.preferredRefreshRate = 0f
      activity.window.attributes = lp
      Log.i(TAG, "cleared preferred display mode")
      return@withContext null
    }
    val mode = display.supportedModes.firstOrNull { it.modeId == modeId.toInt() }
    if (mode == null) {
      Log.w(TAG, "requestDisplayMode: unsupported modeId=$modeId")
      return@withContext null
    }
    if (display.mode?.modeId != mode.modeId) {
      lp.preferredDisplayModeId = mode.modeId
      lp.preferredRefreshRate = mode.refreshRate
      activity.window.attributes = lp
    }
    Log.i(TAG, "preferred display mode id=${mode.modeId} rate=${mode.refreshRate}Hz")
    mode.toRecord(current = display.mode?.modeId == mode.modeId)
  }

  // ---------------------------------------------------------------- thermal

  /*
   * PowerManager thermal status + headroom. getThermalHeadroom(0) is the
   * current-value read (the no-arg overload was dropped from the API 36
   * stubs); it returns NaN on devices without thermal hardware. NaN and
   * sub-API-29 devices marshal as supported=false / null fields so JS can fall
   * back to frame-drop inference.
   */
  @JS
  suspend fun thermalSnapshot(forecastSeconds: Double): ThermalSnapshotRecord =
    withContext(Dispatchers.Default) {
      val pm = reactContextOrNull?.getSystemService(PowerManager::class.java)
      if (pm == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        return@withContext ThermalSnapshotRecord(supported = false)
      }
      // currentThermalStatus is API 29; getThermalHeadroom is API 30.
      val hasHeadroom = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
      val headroom = if (hasHeadroom) pm.getThermalHeadroom(0).headroomOrNull() else null
      val forecast = if (hasHeadroom) {
        pm.getThermalHeadroom(forecastSeconds.toInt().coerceIn(0, 60)).headroomOrNull()
      } else {
        null
      }
      ThermalSnapshotRecord(
        supported = true,
        status = pm.currentThermalStatus.toDouble(),
        headroom = headroom,
        headroomForecast = forecast,
      )
    }

  // ---------------------------------------------------------- hint session

  /*
   * ADPF session (API 31+). Thread-affine: reportWorkDuration is called every
   * frame by JS, so it must not wake the main thread — PerformanceHintManager
   * calls are plain binder calls, safe on the JS thread. The caller's tid is
   * captured with Process.myTid() at call time (the JS path renders on that
   * thread); `threadNames` adds 'nyc-mon-render' (worklet path) and
   * 'RenderThread'.
   */
  @JS
  fun startHintSession(targetNanos: Double, threadNames: List<String>): HintSessionRecord {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return HintSessionRecord(reason = "requires-api-31")
    }
    val manager = reactContextOrNull?.getSystemService(PerformanceHintManager::class.java)
      ?: return HintSessionRecord(reason = "no-hint-service")
    val tids = linkedSetOf(Process.myTid())
    for (name in threadNames) {
      tids.addAll(findTidsByComm(name))
    }
    hintSession?.close()
    val session = runCatching {
      manager.createHintSession(tids.toIntArray(), targetNanos.toLong())
    }.onFailure {
      // e.g. Duo gen-1: 'dumpsys performance_hint' reports "HAL Support: false".
      Log.w(TAG, "createHintSession failed", it)
    }.getOrNull() ?: return HintSessionRecord(
      tids = tids.map { it.toDouble() },
      reason = "session-unsupported",
    )
    hintSession = session
    Log.i(TAG, "hint session started tids=$tids target=${targetNanos.toLong()}ns")
    return HintSessionRecord(active = true, tids = tids.map { it.toDouble() })
  }

  /** Feed one frame's measured CPU-side work duration (nanoseconds) to ADPF. */
  @JS
  fun reportWorkDuration(nanos: Double): Boolean {
    val session = hintSession ?: return false
    return runCatching {
      session.reportActualWorkDuration(nanos.toLong())
      true
    }.getOrDefault(false)
  }

  /** Re-target the live session (e.g. after a display-mode change). */
  @JS
  fun setHintTarget(nanos: Double): Boolean {
    val session = hintSession ?: return false
    return runCatching {
      session.updateTargetWorkDuration(nanos.toLong())
      true
    }.getOrDefault(false)
  }

  @JS
  fun stopHintSession(): Boolean {
    val session = hintSession ?: return false
    hintSession = null
    runCatching { session.close() }
    Log.i(TAG, "hint session stopped")
    return true
  }

  private fun display(): Display? =
    currentActivity?.window?.decorView?.display

  private fun Float.headroomOrNull(): Double? =
    if (isNaN()) null else toDouble()

  private fun Display.Mode.toRecord(current: Boolean) = DisplayModeRecord(
    id = modeId.toDouble(),
    width = physicalWidth.toDouble(),
    height = physicalHeight.toDouble(),
    refreshRate = refreshRate.toDouble(),
    current = current,
  )

  private companion object {
    const val TAG = "GamePerf"
  }
}
