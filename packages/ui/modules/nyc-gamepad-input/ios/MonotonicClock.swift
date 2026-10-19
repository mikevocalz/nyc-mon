import Foundation
import GameController

/// Event timestamps on the device's uptime clock, in milliseconds. Same base
/// as `CACurrentMediaTime`, comparable within one process only.
enum MonotonicClock {
  static func nowMs() -> Double {
    return ProcessInfo.processInfo.systemUptime * 1000
  }

  /// The profile's own event time in milliseconds, or now when the profile
  /// is gone or has not stamped an event yet (`lastEventTimestamp` is 0).
  static func eventMs(_ profile: GCPhysicalInputProfile?) -> Double {
    guard let seconds = profile?.lastEventTimestamp, seconds > 0 else { return nowMs() }
    return seconds * 1000
  }
}
