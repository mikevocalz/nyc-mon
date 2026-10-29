// Screen copy for HOME (the hub tab), keyed by docs/COPY_DECK.md ids
// ("HOME hub and Caller, Phase 1"). Change a string there first, then here.
// `{name}` is the Mon's nickname, else the Baby form name. No pronoun for an
// individual Mon (PS-005). Only the words Caller, Mon and H-Lynk (Law 9).
// Care statuses and the egg's time lines are not repeated here: the hub
// reuses `m13.status.*` and `m11.time.*`, so it says what H-Lynk says.

export const HUB_COPY = {
  'hub.loading.a11y': 'Loading Home',

  'hub.mon.label': 'With you now',
  'hub.mon.stage': '{stage} stage',
  'hub.mon.a11y': '{name}, {stage} stage. {status}.',

  'hub.need.feed': 'Feed {name}',
  'hub.need.rest': 'Put {name} to bed',
  'hub.need.asleep': 'Check on {name}',
  'hub.need.play': 'Play with {name}',
  'hub.need.hi': 'Say hi to {name}',
  'hub.need.hint': 'Opens H-Lynk',

  'hub.egg.label': 'Your egg',
  'hub.hatch.counting.title': 'Your egg is incubating',
  'hub.hatch.ready.title': 'Your egg is ready',
  'hub.hatch.resume.title': 'Your egg started hatching',
  'hub.hatch.counting.action': 'Check your egg',
  'hub.hatch.ready.action': 'Hatch your egg',
  'hub.hatch.resume.action': 'Finish the hatch',

  'hub.game.continue': 'Continue game',
  'hub.game.continue.detail': 'Last saved {when}',
  'hub.game.start': 'Start the game',
  'hub.game.start.detail': 'Walk the city with {name}.',
  'hub.game.start.detail.solo': 'Walk the city.',
  'hub.game.failed': 'Open the game',
  'hub.game.failed.detail': "Your city save didn't load. The game can fix it.",

  'hub.hlynk.title': 'Your H-Lynk',
  'hub.hlynk.detail': 'Feed, rest and play with {name}.',
  'hub.hlynk.detail.egg': 'Your egg is in there.',
  'hub.hlynk.a11y': 'Open your H-Lynk',

  'hub.empty.title': 'No Mon yet',
  'hub.empty.body': 'Pick an egg. Your Mon hatches from it.',
  'hub.empty.action': 'Choose your egg',
} as const;

export type HubCopyId = keyof typeof HUB_COPY;

/** One hub string with `{token}` placeholders filled. */
export function hubCopy(id: HubCopyId, tokens?: Record<string, string | number>): string {
  const text: string = HUB_COPY[id];
  if (tokens === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in tokens ? String(tokens[key]) : match));
}
