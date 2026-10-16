import GameController

/// `GCKeyCode` → W3C `KeyboardEvent.code`, so one keyboard mapping serves
/// native and web. Covers letters, digits, arrows and the editing keys the
/// game binds; anything else returns nil and the module drops the event.
enum WebKeyCode {
  private static let letters: [GCKeyCode: String] = [
    .keyA: "KeyA", .keyB: "KeyB", .keyC: "KeyC", .keyD: "KeyD", .keyE: "KeyE",
    .keyF: "KeyF", .keyG: "KeyG", .keyH: "KeyH", .keyI: "KeyI", .keyJ: "KeyJ",
    .keyK: "KeyK", .keyL: "KeyL", .keyM: "KeyM", .keyN: "KeyN", .keyO: "KeyO",
    .keyP: "KeyP", .keyQ: "KeyQ", .keyR: "KeyR", .keyS: "KeyS", .keyT: "KeyT",
    .keyU: "KeyU", .keyV: "KeyV", .keyW: "KeyW", .keyX: "KeyX", .keyY: "KeyY",
    .keyZ: "KeyZ",
  ]

  private static let others: [GCKeyCode: String] = [
    .one: "Digit1", .two: "Digit2", .three: "Digit3", .four: "Digit4", .five: "Digit5",
    .six: "Digit6", .seven: "Digit7", .eight: "Digit8", .nine: "Digit9", .zero: "Digit0",
    .returnOrEnter: "Enter", .escape: "Escape", .deleteOrBackspace: "Backspace",
    .tab: "Tab", .spacebar: "Space",
    .upArrow: "ArrowUp", .downArrow: "ArrowDown", .leftArrow: "ArrowLeft", .rightArrow: "ArrowRight",
    .leftShift: "ShiftLeft", .rightShift: "ShiftRight",
    .leftControl: "ControlLeft", .rightControl: "ControlRight",
    .leftAlt: "AltLeft", .rightAlt: "AltRight",
    .leftGUI: "MetaLeft", .rightGUI: "MetaRight",
  ]

  static func from(gcKeyCode: GCKeyCode) -> String? {
    if let letter = letters[gcKeyCode] {
      return letter
    }
    return others[gcKeyCode]
  }
}
