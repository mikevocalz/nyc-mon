import GameController

extension GCKeyboard {
  /// Forwards every named key edge from the coalesced keyboard. GameController
  /// fires `keyChangedHandler` once per physical press and once per release,
  /// so no auto-repeat filtering is needed here.
  func bindKeyHandlers(onKey: @escaping (String, Bool, Double) -> Void) {
    keyboardInput?.keyChangedHandler = { input, _, keyCode, pressed in
      guard let code = WebKeyCode.from(gcKeyCode: keyCode) else { return }
      onKey(code, pressed, MonotonicClock.eventMs(input))
    }
  }
}
