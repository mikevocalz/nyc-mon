import Foundation

func snapshot(paused: Bool = false, attention: String = "none", nextCallAt: Double? = 2_000) -> KeychainSnapshot {
  KeychainSnapshot(
    v: 1, monName: "Test Mon", hearts: .init(fullness: 3, energy: 3, social: 3),
    attention: attention, poop: 0, cold: false, asleep: false, paused: paused,
    nextCallAt: nextCallAt, updatedAt: 1_000, staleAt: 5_000,
    text: .init(title: "Test Mon", status: "Content", calling: "Calling", detail: nil,
                a11y: "Content", a11yCalling: "Calling", stale: "Stale",
                meters: .init(fullness: "Fullness", energy: "Energy", social: "Social"))
  )
}

func check(_ now: Double, _ value: KeychainSnapshot, calling: Bool, count: Int) {
  let entries = KeychainTimeline.entries(for: value, now: Date(timeIntervalSince1970: now / 1000))
  precondition(entries.count == count)
  guard case let .live(_, actual) = entries[0].state else { fatalError("Expected live entry") }
  precondition(actual == calling, "Incorrect calling state at \(now)")
}

check(1_999, snapshot(), calling: false, count: 3)
check(2_000, snapshot(), calling: true, count: 2)
check(2_001, snapshot(), calling: true, count: 2)
check(2_001, snapshot(paused: true), calling: false, count: 2)
check(2_001, snapshot(paused: true, attention: "call"), calling: false, count: 2)
check(1_500, snapshot(attention: "call"), calling: true, count: 2)
check(2_001, snapshot(nextCallAt: nil), calling: false, count: 2)
let stale = KeychainTimeline.entries(for: snapshot(), now: Date(timeIntervalSince1970: 5))
guard case .stale = stale[0].state else { fatalError("Expected stale snapshot") }
let empty = KeychainTimeline.entries(for: nil, now: Date(timeIntervalSince1970: 2))
precondition(empty[0].state == .empty)
print("Keychain timeline regression cases passed")
