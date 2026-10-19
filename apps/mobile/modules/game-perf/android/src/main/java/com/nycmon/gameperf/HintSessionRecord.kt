package com.nycmon.gameperf

import io.github.expo.modules.v2.Record

/*
 * Result of startHintSession: whether an ADPF session is live, the tids that
 * were attached (caller tid plus /proc/self/task comm matches), and the reason
 * it was skipped when inactive (requires-api-31 / no-hint-service /
 * session-unsupported).
 */
@Record
class HintSessionRecord(
  var active: Boolean = false,
  var tids: List<Double> = emptyList(),
  var reason: String? = null,
)
