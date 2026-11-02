import Foundation

/// Builds the entries for one snapshot, so the widget changes on time while
/// the app is closed: now; the moment the next predicted real call opens (the
/// LED lights); and the moment the snapshot goes stale. Pure, given `now`.
enum KeychainTimeline {
  static func entries(for snapshot: KeychainSnapshot?, now: Date) -> [KeychainEntry] {
    guard let snapshot else { return [KeychainEntry(date: now, state: .empty)] }
    let staleDate = snapshot.staleDate
    guard now < staleDate else { return [KeychainEntry(date: now, state: .stale(snapshot))] }

    // A timeline may first be requested after the predicted call has opened.
    let predictedCallOpened = snapshot.nextCallDate.map { $0 <= now } ?? false
    let calling = !snapshot.paused && (snapshot.isCalling || predictedCallOpened)
    var entries = [KeychainEntry(date: now, state: .live(snapshot, calling: calling))]
    if !snapshot.isCalling, !snapshot.paused, let callDate = snapshot.nextCallDate, callDate > now, callDate < staleDate {
      entries.append(KeychainEntry(date: callDate, state: .live(snapshot, calling: true)))
    }
    entries.append(KeychainEntry(date: staleDate, state: .stale(snapshot)))
    return entries
  }
}
