/**
 * H-Lynk chrome strings, keyed by their COPY_DECK IDs. Source of truth:
 * docs/design/screens/M01/05-copy.md (registered in docs/COPY_DECK.md as the
 * shared `hlynk.*` namespace). Change a string there first, then here.
 * Every string is `voice: "ui"`; none says "device" (Law 9).
 */
export const HLYNK_COPY = {
  'hlynk.key.home.label': 'Home',
  'hlynk.key.menu.label': 'Menu',
  'hlynk.key.back.label': 'Back',
  'hlynk.key.forward.label': 'Forward',
  'hlynk.trackpad.label': 'Trackpad',
  'hlynk.state.disabled.hint': 'Available after start-up',
  'hlynk.led.incubating': 'Incubating',
  'hlynk.led.ready': 'Ready to hatch',
  'hlynk.led.needs_you': 'Needs you',
  /** `{chip}` is one of the three `hlynk.led.*` chip strings, or a screen's refinement of it. */
  'hlynk.led.a11y': 'Status light: {chip}',
  'm01.a11y.power_on': 'H-Lynk on',
} as const satisfies Record<string, string>;

/** A key of {@linkcode HLYNK_COPY}. */
export type HLynkCopyId = keyof typeof HLYNK_COPY;

/** `hlynk.led.a11y` with its `{chip}` filled. */
export function ledAccessibilityLabel(chip: string): string {
  return HLYNK_COPY['hlynk.led.a11y'].replace('{chip}', chip);
}
