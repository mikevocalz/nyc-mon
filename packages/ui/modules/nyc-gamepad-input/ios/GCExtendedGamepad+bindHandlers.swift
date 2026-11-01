import GameController

extension GCExtendedGamepad {
  /// Installs per-element handlers so a button edge or stick move reaches
  /// `onButton` / `onAxis` without diffing the whole profile. Elements the
  /// pad lacks (`buttonOptions`, thumbstick buttons, `buttonHome`) are nil
  /// and skipped. Handlers run on the controller's `handlerQueue`.
  ///
  /// Positions follow Apple's profile: `buttonA` is the bottom face button
  /// on every vendor, so it is `south` for Xbox A, PlayStation Cross and
  /// Nintendo B alike.
  ///
  /// Timestamps come from the profile's `lastEventTimestamp` (iOS 14+), the
  /// time GameController stamped the update, so they are event time like
  /// Android's `event.eventTime`, not the time the handler happened to run.
  /// That value is in seconds on the same uptime base as `MonotonicClock`.
  func bindGamepadHandlers(
    deviceId: String,
    onButton: @escaping (GamepadButton, Bool, String, Double) -> Void,
    onAxis: @escaping (GamepadAxis, Double, String, Double) -> Void
  ) {
    let digital: [(GCControllerButtonInput?, GamepadButton)] = [
      (buttonA, .south),
      (buttonB, .east),
      (buttonX, .west),
      (buttonY, .north),
      (leftShoulder, .leftShoulder),
      (rightShoulder, .rightShoulder),
      (leftTrigger, .leftTrigger),
      (rightTrigger, .rightTrigger),
      (buttonOptions, .select),
      (buttonMenu, .start),
      (leftThumbstickButton, .leftStick),
      (rightThumbstickButton, .rightStick),
      (dpad.up, .dpadUp),
      (dpad.down, .dpadDown),
      (dpad.left, .dpadLeft),
      (dpad.right, .dpadRight),
      (buttonHome, .home),
    ]
    for (input, button) in digital {
      input?.pressedChangedHandler = { [weak self] _, _, pressed in
        onButton(button, pressed, deviceId, MonotonicClock.eventMs(self))
      }
    }

    let analog: [(GCControllerButtonInput, GamepadAxis)] = [
      (leftTrigger, .leftTrigger),
      (rightTrigger, .rightTrigger),
    ]
    for (input, axis) in analog {
      input.valueChangedHandler = { [weak self] _, value, _ in
        onAxis(axis, Double(value), deviceId, MonotonicClock.eventMs(self))
      }
    }

    // GameController already reports +y up for sticks and the d-pad.
    let pads: [(GCControllerDirectionPad, GamepadAxis, GamepadAxis)] = [
      (leftThumbstick, .leftX, .leftY),
      (rightThumbstick, .rightX, .rightY),
      (dpad, .dpadX, .dpadY),
    ]
    for (pad, xAxis, yAxis) in pads {
      pad.valueChangedHandler = { [weak self] _, x, y in
        let now = MonotonicClock.eventMs(self)
        onAxis(xAxis, Double(x), deviceId, now)
        onAxis(yAxis, Double(y), deviceId, now)
      }
    }
  }
}
