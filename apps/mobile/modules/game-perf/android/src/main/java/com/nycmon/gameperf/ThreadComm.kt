package com.nycmon.gameperf

import java.io.File

/*
 * Scans /proc/self/task/<tid>/comm for threads named `comm` (kernel-truncated
 * to 15 chars, so 'nyc-mon-render' matches the worklet runtime thread).
 * Threads can exit mid-scan; per-entry failures are ignored.
 */
internal fun findTidsByComm(comm: String): List<Int> {
  val dirs = File("/proc/self/task").listFiles() ?: return emptyList()
  val out = ArrayList<Int>()
  for (dir in dirs) {
    try {
      if (File(dir, "comm").readText().trim() == comm) {
        dir.name.toIntOrNull()?.let(out::add)
      }
    } catch (_: Exception) {
      // Thread exited between listFiles() and read; skip it.
    }
  }
  return out
}
