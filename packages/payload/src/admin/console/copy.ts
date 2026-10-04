// Console strings are sourced from docs/design/admin/05-copy.md.
export const consoleCopy = {
  nav: { overview: 'Overview', callers: 'Callers', consent: 'Consent', mons: 'Mons', content: 'Content', audit: 'Audit log', settings: 'Settings' },
  overview: { heading: 'Overview', healthy: '0 duplicated Mons', run: 'Run check', queues: 'Queues', recent: 'Recent activity' },
  callers: { heading: 'Callers', privacy: 'Email, name and birth year are hidden for Callers under 18. Showing one asks for a reason and is logged.', empty: 'No Caller matches', identity: 'Identity', danger: 'Delete account', schedule: 'Schedule deletion', cancel: 'Cancel deletion', signout: 'Sign out everywhere' },
  consent: { heading: 'Consent queue', rule: "We hold a parent's email and the child's birth year only to ask for consent. No child name or email exists here.", resend: 'Resend consent email', remove: 'Delete this record now' },
  mons: { heading: 'Mons', readonly: 'Read only. Mons and eggs change only through the game API.', integrity: 'Integrity' },
  content: { heading: 'Content', banner: 'Content ships in code. Changes go through a pull request to packages/content.' },
  audit: { heading: 'Audit log', rule: "Events can't be edited or deleted.", export: 'Export' },
  settings: { heading: 'Settings', appearance: 'Appearance', staff: 'Staff', addStaff: 'Add staff', remove: 'Remove access' },
  login: { heading: 'Sign in to the console', email: 'Email', password: 'Password', submit: 'Sign in', passkey: 'Use a passkey' },
  mask: { hidden: 'Hidden', title: 'Why do you need to see this?', body: "Your reason is saved in the audit log with your name. The value isn't." },
  errors: { load: "This didn't load.", action: "That action didn't finish. Nothing changed. Try again." },
} as const;

export const reasonOptions = [
  { label: "Answering this Caller's support request", value: 'support_request' },
  { label: "Answering a parent's request", value: 'parent_request' },
  { label: 'Checking a deletion', value: 'deletion_check' },
  { label: 'Legal or safety request', value: 'legal' },
  { label: 'The Caller asked', value: 'caller_request' },
] as const;
