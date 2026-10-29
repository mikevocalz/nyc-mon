/**
 * Mon call notification and keychain widget copy. Keys and strings are
 * docs/COPY_DECK.md "Mon call notifications" and "Keychain widget" (lane a,
 * canon Decisions #33 and #36, design D20). Change a string there first, then here.
 *
 * The notification title is the Mon's name, so the alert reads as coming from
 * the Mon; the body is one `ui` sentence. A `character` line from canon
 * (`notify.call.<kind>.line`, via `monLine`) replaces the body when it exists.
 * False calls have no key: they never notify.
 */
export const CARE_COPY = {
  'notify.call.hunger.title': '{name}',
  'notify.call.hunger.body': '{name} is asking for food.',
  'notify.call.energy.title': '{name}',
  'notify.call.energy.body': '{name} is tired and needs rest.',
  'notify.call.social.title': '{name}',
  'notify.call.social.body': '{name} wants to play.',
  'notify.call.cold.title': '{name}',
  'notify.call.cold.body': '{name} has a cold and could use medicine.',
  'notify.call.bedtime.title': '{name}',
  'notify.call.bedtime.body': "It's bedtime. {name} wants the lights off.",
  'notify.call.thread': 'Mon calls',

  // Meter words (COPY_DECK monspace.hearts.*), the label on each heart row.
  'monspace.hearts.fullness': 'Fullness',
  'monspace.hearts.energy': 'Energy',
  'monspace.hearts.social': 'Social',

  'keychain.title': '{name}',
  'keychain.calling': '{name} is calling',
  'keychain.content': '{name} is content',
  'keychain.asleep': '{name} is asleep',
  'keychain.paused': 'Paused',
  'keychain.cold': 'Has a cold',
  'keychain.poop.one': '1 pile',
  'keychain.poop.many': '{count} piles',
  'keychain.empty': 'No Mon yet',
  'keychain.stale': 'Open NYC-MON to update',
  'keychain.a11y': '{name}. {state}. Fullness {fullness} of 4, Energy {energy} of 4, Social {social} of 4.',
  'keychain.gallery.title': 'Mon keychain',
  'keychain.gallery.body': "See your Mon's hearts, and whether your Mon is calling.",
} as const;

export type CareCopyId = keyof typeof CARE_COPY;

/** Fills `{token}` slots. An unknown token stays as written, so a missing value shows up in review. */
export function careCopy(id: CareCopyId, tokens: Record<string, string | number> = {}): string {
  return CARE_COPY[id].replace(/\{(\w+)\}/g, (slot, key: string) => (key in tokens ? String(tokens[key]) : slot));
}

/**
 * Words care copy never uses: Law 8 and Decision #33 ("sick, dead, died,
 * killed, neglected and punish never appear in UI copy"), plus guilt and
 * urgency. Tests sweep every string against it.
 */
export const BANNED_CARE_WORDS = /\b(sick|ill|dead|death|died|dying|killed|neglect\w*|punish\w*|starv\w*|hurry|abandon\w*|lonely|faint)\b|!/i;
