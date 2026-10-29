extension KeychainState {
  /// One sentence for VoiceOver (COPY_DECK keychain.a11y), resolved by the app.
  var accessibilityLabel: String {
    switch self {
    case .empty:
      return KeychainCopy.emptyA11y
    case let .live(snapshot, calling):
      return calling ? snapshot.text.a11yCalling : snapshot.text.a11y
    case let .stale(snapshot):
      return "\(snapshot.text.title). \(snapshot.text.stale)."
    }
  }
}
