// Screen copy for M08 (egg choice) and M10 (incubation choice), keyed by the
// ids in docs/design/screens/M08/05-copy.md and M10/05-copy.md. Change a
// string there first, then here. No string names a pronoun for a Mon (PS-005).
// `m08.santoro.line` ships empty (TODO(canon)) and renders nothing.

export const EGG_COPY = {
  // M08: egg choice (screens/M08/05-copy.md)
  'm08.title': 'Choose an egg',
  'm08.santoro.caption': 'Dr. Alessandra Santoro brought three eggs.',
  'm08.santoro.line': '',
  'm08.tile.label': '{eggName}',
  'm08.tile.a11y.label': '{eggName}, {bloodline}, {index} of 3',
  'm08.tile.a11y.hint': 'Opens a closer look',
  'm08.trackpad.label.browsing': 'Eggs, 3',
  'm08.trackpad.label.focused': '{eggName}, {index} of 3',
  'm08.trackpad.hint': 'Flick to move between eggs. Hold to choose.',
  'm08.trackpad.commit.label': 'Choose the {eggName}',
  'm08.action.look': 'Look closer',
  'm08.action.prev': 'Previous egg',
  'm08.action.next': 'Next egg',
  'm08.action.all': 'All three',
  'm08.card.number': '#{dexNumber}',
  'm08.card.number.a11y': 'Number {dexId}',
  'm08.card.bloodline': '{bloodline}',
  'm08.card.body': 'Each egg holds one Mon. You meet your Mon when the egg hatches.',
  'm08.cta.choose': 'Choose the {eggName}',
  'm08.confirm.title': 'Choose the {eggName}?',
  'm08.confirm.body': "You can't swap eggs later.",
  'm08.confirm.yes': 'Choose this egg',
  'm08.confirm.no': 'Keep looking',
  'm08.chosen.a11y.announce': '{eggName} chosen.',
  'm08.error.title': "The eggs didn't load.",
  'm08.error.body': 'Nothing was chosen. Try again, and if it keeps happening, restart NYC-MON.',
  'm08.error.retry': 'Try again',
  'm08.back.a11y.label': 'Back',

  // M10: incubation choice (screens/M10/05-copy.md)
  'm10.title': 'How long should the egg incubate?',
  'm10.body': "The time you pick doesn't change your Mon. Pick the wait that fits your day.",
  'm10.option.15': '15 min',
  'm10.option.30': '30 min',
  'm10.option.60': '1 hour',
  'm10.option.15.a11y': '15 minutes',
  'm10.option.30.a11y': '30 minutes',
  'm10.option.60.a11y': '1 hour',
  'm10.ring.a11y.label': 'Incubation time',
  'm10.ready': 'Ready at {time}',
  'm10.ready.tomorrow': 'Ready at {time} tomorrow',
  'm10.egg.a11y.label': 'The {eggName}',
  'm10.cta.start': 'Start incubating',
  'm10.cta.start.a11y.hint.disabled': 'Pick a time first',
  'm10.cta.starting.a11y': 'Starting',
  'm10.trackpad.label': '{option}, incubation time',
  'm10.trackpad.hint': 'Flick to change the time. Tap to start.',
  'm10.action.prev': 'Shorter',
  'm10.action.next': 'Longer',
  'm10.case.a11y.closed': 'The {eggName} is in the case.',
  'm10.confirmed.a11y.announce': 'Incubating. Ready at {time}.',
  'm10.led.chip': 'Incubating, {minutes} minutes left',
  'm10.led.chip.hour': 'Incubating, 1 hour left',
  'm10.error.title': "The egg didn't go into the case.",
  'm10.error.body': 'Nothing was saved. Try again. If it keeps happening, restart NYC-MON.',
  'm10.error.retry': 'Try again',
  'm10.back.a11y.label': 'Back',
} as const;

export type EggCopyId = keyof typeof EGG_COPY;

/** Fills `{token}` placeholders in an M08/M10 string. */
export function eggCopy(id: EggCopyId, tokens?: Record<string, string | number>): string {
  let text: string = EGG_COPY[id];
  if (tokens) {
    for (const [key, value] of Object.entries(tokens)) text = text.replaceAll(`{${key}}`, String(value));
  }
  return text;
}
