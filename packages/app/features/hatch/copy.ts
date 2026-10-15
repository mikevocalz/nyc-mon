// Screen copy for M09, M11 and M12, keyed by docs/COPY_DECK.md ids and drafted
// in docs/design/screens/Mxx/05-copy.md. Change a string there first, then here.
// M11's notification status rows (`m11.status.*`) and the M23 notification
// text are owned by M06 and live in `onboarding/copy.ts`.
// No string here uses a pronoun for an individual Mon (PS-005).

export const HATCH_COPY = {
  // M11 Incubating (screens/M11/05-copy.md)
  'm11.time.minutes': '{minutes} min left',
  'm11.time.under_minute': 'Less than a minute left',
  'm11.time.ready_at': '{eggName} · ready at {clockTime}',
  'm11.time.ready': 'Ready to hatch',
  'm11.time.overdue.today': 'Ready since {clockTime}',
  'm11.time.overdue.yesterday': 'Ready since yesterday',
  'm11.time.overdue.earlier': 'Ready since {weekday}',
  'm11.time.resume': 'Your egg started hatching',
  'm11.caption.counting': 'Your egg is resting in its case.',
  'm11.led.incubating': 'Incubating, {minutes} min left',
  'm11.trackpad.warm': 'Warm the case',
  'm11.trackpad.warm.a11y.hint': "Hold to keep your egg company. It won't hatch any sooner.",
  'm11.trackpad.open': 'Open the case',
  'm11.trackpad.open.a11y.hint': 'Starts the hatch',
  'm11.case.a11y.label': '{eggName} in its closed case',
  'm11.case.a11y.label.ready': '{eggName} in its case, ready to hatch',
  'm11.a11y.announce.ready': 'Your egg is ready to hatch.',
  'm11.a11y.announce.warm': 'You warm the case.',

  // M12 Hatch (screens/M12/05-copy.md)
  'm12.trackpad.open': 'Open the case',
  'm12.skip': 'Skip',
  'm12.skip.a11y.hint': 'Goes to the end. Nothing about your Mon changes.',
  'm12.first_look.hesitate.trackpad': 'Stay close',
  'm12.first_look.hesitate.hint': 'Hold the trackpad to stay close.',
  'm12.plate.a11y.label': '{babyName}, {bloodlineLabel}',
  'm12.cta.name': 'Name {babyName}',
  'm12.cta.home': 'Go to {monName}',
  'm12.a11y.case_open': 'The case opens.',
  'm12.a11y.crack': 'Your egg is cracking.',
  'm12.a11y.emerge': '{babyName} hatched.',
  'm12.a11y.first_look.lean_in': '{babyName} looks at you and leans in.',
  'm12.a11y.first_look.hesitate': '{babyName} looks at you, then peeks out from the shell.',
  'm12.a11y.first_look.resolved': '{babyName} comes closer and leans in.',
  'm12.a11y.skipped': '{babyName} hatched.',
  'm12.a11y.already': '{monName} already hatched.',

  // M09 Naming (screens/M09/05-copy.md). `m09.error.reserved` ships only if
  // Mike rules "Ratti" reserved; the reserved list is empty, so it never fires.
  'm09.identity': '#{dexNumber} {formName}, {bloodline}',
  'm09.identity.a11y': 'Number {dexId}, {formName}, {bloodline}',
  'm09.title': 'Name this {formName}',
  'm09.field.label': 'Name',
  'm09.field.hint': 'No renaming yet, so take your time.',
  'm09.field.clear.a11y.label': 'Clear name',
  'm09.plate.a11y.label': 'Name preview: {name}',
  'm09.cta': 'Use this name',
  'm09.cta.a11y.hint.disabled': 'Type a name first',
  'm09.trackpad.label': 'Name {formName}',
  'm09.trackpad.hint': 'Tap to type a name. Hold to use it.',
  'm09.trackpad.commit.label': 'Use this name',
  'm09.confirmed.a11y.announce': 'Name saved: {name}.',
  'm09.error.blank': 'Add at least one letter.',
  'm09.error.too_long': "That's more than 16 characters. Try a shorter version.",
  'm09.error.characters': 'Names can use letters, spaces, hyphens, apostrophes and periods.',
  'm09.error.blocked': 'Our filter blocked that name. It gets things wrong sometimes, so try another for now.',
  'm09.error.reserved': "Ratti is the name of Malik's partner. Try another name for your Mon.",
  'm09.save_error.title': "The name didn't save.",
  'm09.save_error.body': 'Your Mon is fine and the name is still in the field. Try again.',
  'm09.save_error.retry': 'Try again',
} as const;

export type HatchCopyId = keyof typeof HATCH_COPY;

/** Looks up a string and fills `{token}` placeholders. */
export function hatchCopy(id: HatchCopyId, tokens?: Record<string, string | number>): string {
  let text: string = HATCH_COPY[id];
  if (tokens) {
    for (const [key, value] of Object.entries(tokens)) text = text.replaceAll(`{${key}}`, String(value));
  }
  return text;
}
