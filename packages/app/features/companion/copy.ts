// Screen copy for M13–M18, keyed by docs/COPY_DECK.md ids and drafted in
// docs/design/screens/Mxx/05-copy.md. Change a string there first, then here.
// `{name}` is the Mon's nickname, else the Baby form name. No pronoun for an
// individual Mon (PS-005); "H-Lynk", never "device" (Law 9).

export const COMPANION_COPY = {
  // M13 Home (screens/M13/05-copy.md)
  'm13.ring.energy': 'Energy',
  'm13.ring.fullness': 'Fullness',
  'm13.ring.social': 'Social',
  'm13.ring.low': 'Low',
  'm13.ring.a11y': '{meter}, {percent} percent',
  // Not in 05-copy.md: the ring group needs a spoken name (CareMeterRingGroup.accessibilityLabel).
  'm13.rings.a11y.label': 'Care meters',
  'm13.status.content': 'Content',
  'm13.status.asleep': 'Asleep',
  'm13.status.sluggish': 'Full and slow',
  'm13.status.food': 'Asking for food',
  'm13.status.energy': 'Needs rest',
  'm13.status.social': 'Wants to play',
  'm13.status.many': 'Needs you: {list}',
  'm13.bar.feed': 'Feed',
  'm13.bar.rest': 'Rest',
  'm13.bar.wake': 'Wake',
  'm13.bar.play': 'Play',
  'm13.bar.dex': 'Dex',
  'm13.trackpad.label': "{name}'s room",
  'm13.trackpad.hint.food': 'Tap to feed. Drag to look around.',
  'm13.trackpad.hint.energy': 'Tap to put {name} to bed. Drag to look around.',
  'm13.trackpad.hint.social': 'Tap to play. Drag to look around.',
  'm13.trackpad.hint.idle': 'Tap to say hi. Drag to look around.',
  'm13.mon.a11y': '{name}, {bloodline}. {status}.',
  'm13.mon.a11y.hint': 'Double-tap to say hi',
  'm13.resumed.a11y': '{name} is here. {status}.',
  'm13.choose.title': 'Which Mon is with you?',
  'm13.choose.body': 'You can switch any time from the Menu key.',

  // M14 Feed (screens/M14/05-copy.md). D-15e: no named foods, so the one
  // action is "Share a meal" (DECISIONS.md D-15e) until content/food exists.
  'm14.title': 'Feed {name}',
  'm14.share': 'Share a meal',
  'm14.tile.hint': 'Double-tap to feed {name}',
  'm14.trackpad.hint.share': 'Tap to share a meal.',
  'm14.eating.a11y': '{name} is eating.',
  'm14.eaten.a11y': '{name} finished eating. Fullness {percent} percent.',
  'm14.full.body': '{name} is full. Another meal now makes {name} slow for a while.',
  'm14.overfed.a11y': '{name} ate and is full and slow for a while.',
  'm14.declined.asleep': '{name} is asleep. Food can wait until {name} wakes up.',
  'm14.declined.asleep.action': 'Go to Rest',
  'm14.declined.sluggish': '{name} is still full. Try again a little later.',
  'm14.close': 'Close',

  // M15 Rest (screens/M15/05-copy.md)
  'm15.settling': 'Settling in.',
  'm15.sleeping': 'Asleep. Energy is coming back.',
  'm15.sleeping.leave': 'You can close the H-Lynk. {name} keeps resting.',
  'm15.wake.button': 'Wake {name}',
  'm15.wake.cost': '{name} is still tired. Waking now leaves {name} a little less social.',
  'm15.wake.confirm': 'Wake {name}',
  'm15.wake.cancel': 'Let {name} sleep',
  'm15.trackpad.label': '{name}, asleep',
  'm15.trackpad.commit': 'Wake {name}',
  'm15.trackpad.hint': 'Hold to wake.',
  'm15.woke.rested.a11y': '{name} woke up rested.',
  'm15.woke.early.a11y': '{name} is awake.',
  'm15.declined.already': '{name} is already asleep.',

  // M16 Social / Peek (screens/M16/05-copy.md)
  'm16.intro.title': 'Play Peek with {name}',
  'm16.intro.body': '{name} hides. You find {name}. Flick to look, tap to peek.',
  'm16.intro.start': 'Start',
  'm16.intro.tired': '{name} is too sleepy to play. A rest comes first.',
  'm16.intro.tired.action': 'Go to Rest',
  'm16.intro.asleep': '{name} is asleep. Play after {name} wakes up.',
  'm16.round.a11y': 'Round {n} of {total}',
  'm16.spot.left': 'Left',
  'm16.spot.middle': 'Middle',
  'm16.spot.right': 'Right',
  'm16.trackpad.label': 'Looking at: {spot}',
  'm16.trackpad.hint': 'Tap to peek. Flick to look somewhere else.',
  'm16.twin.back': 'Look left',
  'm16.twin.peek': 'Peek',
  'm16.twin.forward': 'Look right',
  'm16.found.a11y': 'Found {name}!',
  'm16.peekout.a11y': '{name} was at {spot}. Found!',
  'm16.result.body': '{name} had fun playing with you.',
  'm16.result.again': 'Play again',
  'm16.result.done': 'Done',

  // M17 Dex profile (screens/M17/05-copy.md). Photo strings ship with photo mode (D-15i: hidden).
  'm17.back.a11y': 'Back',
  'm17.dex': 'No. {dex}',
  'm17.dex.a11y': 'Dex number {dexSpoken}',
  'm17.bloodline': '{bloodlineName} Bloodline',
  'm17.life.a11y': 'Life stages',
  'm17.life.done.a11y': '{formName}, done',
  'm17.life.current.a11y': '{formName}, now',
  'm17.life.later.a11y': 'Later stages, not reached yet',
  'm17.fact.name': 'Name',
  'm17.fact.hatched': 'Hatched',
  'm17.fact.caller': 'Caller',

  // M18 Journal (screens/M18/05-copy.md)
  'm18.title': 'Journal',
  'm18.heading': '{name} and you',
  'm18.days.one': '1 day together',
  'm18.days.other': '{n} days together',
  'm18.cal.a11y': 'Days together, {month}',
  'm18.cal.day.together': '{date}, together',
  'm18.cal.day.plain': '{date}',
  'm18.cal.prev': 'Previous month',
  'm18.cal.next': 'Next month',
  'm18.day.today': 'Today',
  'm18.day.yesterday': 'Yesterday',
  'm18.entry.hatched': '{name} hatched',
  'm18.entry.named': 'You named {name}',
  'm18.entry.fed': '{name} ate',
  'm18.entry.fed.first': "{name}'s first meal",
  'm18.entry.rested': '{name} went to sleep',
  'm18.entry.rested.first': "{name}'s first nap",
  'm18.entry.played': '{name} played Peek with you',
  'm18.entry.played.first': "{name}'s first game with you",
  'm18.entry.woke': '{name} woke up rested',
  'm18.first': 'First',
  'm18.timeline.a11y': 'Journal entries',
} as const;

export type CompanionCopyId = keyof typeof COMPANION_COPY;

/** Looks up a string and fills `{token}` placeholders. */
export function companionCopy(id: CompanionCopyId, tokens?: Record<string, string | number>): string {
  let text: string = COMPANION_COPY[id];
  if (tokens) {
    for (const [key, value] of Object.entries(tokens)) text = text.replaceAll(`{${key}}`, String(value));
  }
  return text;
}
