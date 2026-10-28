// Screen copy for MONS, the species index (Gameplay Bible v12, native tab 4),
// keyed by docs/COPY_DECK.md "MONS — the species index". Change a string
// there first, then here. `ui` voice only: Caller, Mon, H-Lynk, Bloodline.
// No pronoun for a Mon (PS-005). Stage names are canon (Egg, Baby, Small,
// Mid, Max) and come from the data, never from here.

export const MONS_COPY = {
  'mons.title': 'Mons',
  'mons.count': 'Seen {seen} of {total}',
  'mons.count.a11y': 'You have seen {seen} of {total} Mons',
  'mons.search.placeholder': 'Name or number',
  'mons.search.a11y': 'Search Mons by name or number',
  'mons.filter.bloodline.a11y': 'Bloodline',
  'mons.filter.stage.a11y': 'Stage',
  'mons.filter.all': 'All',
  'mons.number': 'No. {dex}',
  'mons.number.a11y': 'Number {dexSpoken}',
  'mons.unseen': '???',
  // The kit's convention for a form with no model yet (EggStill, MonView, the glass).
  'mons.comingSoon': 'Coming Soon',
  'mons.unseen.a11y': 'Not seen yet',
  'mons.row.a11y': '{name}, number {dexSpoken}, {stage}, {bloodline}',
  'mons.row.unseen.a11y': 'Number {dexSpoken}, not seen yet',
  'mons.row.hint': 'Opens the entry',
  'mons.empty.title': 'No Mons seen yet',
  'mons.empty.body': 'Pick an egg and each Mon you meet fills in here.',
  'mons.nomatch.title': 'No Mons match',
  'mons.nomatch.body': 'Try another name or number, or show every Bloodline.',
  'mons.nomatch.clear': 'Clear search and filters',
  'mons.entry.stage': 'Stage',
  'mons.entry.bloodline': 'Bloodline',
  'mons.entry.lore': 'Lore',
  'mons.entry.unseen.body': 'Meet this Mon to fill in the entry.',
  'mons.entry.line': 'Evolution line',
  'mons.entry.line.a11y': 'Evolution line, Egg to Max',
  'mons.entry.step.a11y': '{stage}: {name}',
  'mons.entry.step.current.a11y': '{stage}: {name}, this entry',
  'mons.entry.branch': 'A Mid becomes one of these',
  // V11 ¶70: "Personality/Bond can influence branching evolution."
  'mons.entry.branch.why': 'Bond and personality can shape which one.',
  'mons.entry.trigger.unknown': 'Trigger unknown',
  'mons.entry.trigger.a11y': 'Evolves with {trigger}',
  'mons.entry.previous': 'Previous',
  'mons.entry.next': 'Next',
  'mons.entry.previous.a11y': 'Previous entry, number {dexSpoken}',
  'mons.entry.next.a11y': 'Next entry, number {dexSpoken}',
  'mons.entry.back': 'All Mons',
  'mons.entry.model.a11y': '{name}, 3D model',
  'mons.entry.unseen.art.a11y': 'Unseen Mon',
  'mons.notfound.title': 'No entry here',
  'mons.notfound.body': 'This number is not in the index.',
  'mons.loading.a11y': 'Loading the Mon',
  'mons.detail.empty.title': 'Pick a Mon',
  'mons.detail.empty.body': 'Choose a number on the left to read the entry.',
} as const;

export type MonsCopyId = keyof typeof MONS_COPY;

/** Looks up a string and fills `{token}` placeholders. */
export function monsCopy(id: MonsCopyId, tokens?: Record<string, string | number>): string {
  let text: string = MONS_COPY[id];
  if (tokens) {
    for (const [key, value] of Object.entries(tokens)) text = text.replaceAll(`{${key}}`, String(value));
  }
  return text;
}
