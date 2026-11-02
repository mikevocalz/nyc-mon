import Foundation

extension KeychainSnapshot {
  /// Placeholder and gallery content. The name is generic; real data replaces it on the first write.
  static let sample = KeychainSnapshot(
    v: supportedVersion,
    monName: "Your Mon",
    hearts: Hearts(fullness: 3, energy: 4, social: 2),
    attention: "none",
    poop: 0,
    cold: false,
    asleep: false,
    paused: false,
    nextCallAt: nil,
    updatedAt: Date.now.timeIntervalSince1970 * 1000,
    staleAt: Date.distantFuture.timeIntervalSince1970 * 1000,
    text: Text(
      title: "Your Mon",
      status: "Your Mon is content",
      calling: "Your Mon is calling",
      detail: nil,
      a11y: "Your Mon. Your Mon is content. Fullness 3 of 4, Energy 4 of 4, Social 2 of 4.",
      a11yCalling: "Your Mon. Your Mon is calling. Fullness 3 of 4, Energy 4 of 4, Social 2 of 4.",
      stale: "Open NYC-MON to update",
      meters: Meters(fullness: "Fullness", energy: "Energy", social: "Social")
    )
  )
}
