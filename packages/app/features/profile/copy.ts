// Screen copy for CALLER (the profile tab), keyed by docs/COPY_DECK.md ids
// ("HOME hub and Caller, Phase 1"). Change a string there first, then here.
// The older `profile.*` ids stay in onboarding/copy.ts. Only the words
// Caller, Mon and H-Lynk (Law 9). No pronoun for an individual Mon (PS-005).

export const CALLER_COPY = {
  'caller.label': 'Caller',
  'caller.since': 'Caller since {date}',

  'caller.record.title': 'Your record',
  'caller.record.hatched': 'Eggs hatched',
  'caller.record.highlights': 'Journal highlights',
  'caller.record.a11y': '{label}, {count}',

  'caller.mons.title': 'Mons raised',
  'caller.mons.stage': '{stage} stage',
  'caller.mons.days.one': '1 day together',
  'caller.mons.days.many': '{days} days together',
  'caller.mons.row.a11y': '{name}, {stage} stage, {days}',
  'caller.mons.empty.egg': 'Your egg is incubating. Your first Mon hatches from it.',
  'caller.mons.empty': 'No Mon yet. Pick an egg on Home.',

  'caller.settings.title': 'Settings',
  'caller.settings.detail': 'Appearance, graphics and game controls.',
  'caller.settings.a11y': 'Open settings',
  'caller.account.title': 'Account',
  'caller.account.detail': 'Caller name, sign out, delete account.',
  'caller.account.a11y': 'Open your account settings',

  'caller.loading.a11y': 'Loading your Caller record',
} as const;

export type CallerCopyId = keyof typeof CALLER_COPY;

/** One Caller string with `{token}` placeholders filled. */
export function callerCopy(id: CallerCopyId, tokens?: Record<string, string | number>): string {
  const text: string = CALLER_COPY[id];
  if (tokens === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in tokens ? String(tokens[key]) : match));
}

/** "1 day together", "12 days together". */
export function daysTogetherLine(days: number): string {
  return days === 1 ? CALLER_COPY['caller.mons.days.one'] : callerCopy('caller.mons.days.many', { days });
}
