/// The only strings the widget owns: it shows them before the app has written
/// a snapshot. Everything else arrives resolved in the snapshot.
enum KeychainCopy {
  /// COPY_DECK keychain.empty
  static let empty = "No Mon yet"
  /// Spoken with the empty state; names where to go next.
  static let emptyA11y = "No Mon yet. Open NYC-MON to hatch your egg."
}
