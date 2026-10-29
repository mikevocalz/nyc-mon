import Foundation

/// What one timeline entry draws. Each case carries only what it needs.
enum KeychainState: Equatable {
  /// No snapshot yet: before the hatch, or a fresh install.
  case empty
  /// The app's last write, with the LED either as written or lit because a predicted call has opened.
  case live(KeychainSnapshot, calling: Bool)
  /// The snapshot is too old to trust; hearts are hidden.
  case stale(KeychainSnapshot)
}
