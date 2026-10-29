/**
 * Native: React Native 0.88 has no keydown event on iOS views, so an iPad
 * hardware keyboard reaches Mon Space through Full Keyboard Access instead:
 * every icon and the A/B/C keys are real buttons (Tab moves, Space presses).
 * Arrow-key cycling on native needs a key-command module; not in this lane.
 */
export function useHardwareKeys(_onKey: (key: string) => boolean): void {
  // Intentionally empty: see above.
}
