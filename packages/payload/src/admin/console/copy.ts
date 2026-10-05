// Console strings are sourced from docs/design/admin/05-copy.md.
export const consoleCopy = {
  nav: { overview: 'Overview', callers: 'Callers', consent: 'Consent', mons: 'Mons', content: 'Content', audit: 'Audit log', settings: 'Settings' },
  overview: { heading: 'Overview', healthy: '0 duplicated Mons', run: 'Run check', queues: 'Queues', recent: 'Recent activity' },
  callers: { heading: 'Callers', privacy: 'Email, name and birth year are hidden for Callers under 18. Showing one asks for a reason and is logged.', empty: 'No Caller matches', identity: 'Identity', danger: 'Delete account', schedule: 'Schedule deletion', cancel: 'Cancel deletion', signout: 'Sign out everywhere' },
  consent: { heading: 'Consent queue', rule: "We hold a parent's email and the child's birth year only to ask for consent. No child name or email exists here.", resend: 'Resend consent email', remove: 'Delete this record now' },
  mons: { heading: 'Mons', readonly: 'Read only. Mons and eggs change only through the game API.', integrity: 'Integrity' },
  content: { heading: 'Content', banner: 'Content ships in code. Changes go through a pull request to packages/content.', canon: 'Not decided in canon yet. Unsettled fields show —.', pending: '—', bloodlines: 'Bloodlines', forms: 'Forms', eggs: 'Starter eggs', colDex: 'Dex', colForm: 'Form', colStage: 'Stage', colCulture: 'Culture', colScale: 'Scale (m)', colAffinity: 'Affinity', colClass: 'Class', colRig: 'Rig', colFood: 'Food', colEgg: 'Egg', colHatches: 'Hatches into', colBloodline: 'Bloodline', colId: 'Id' },
  audit: { heading: 'Audit log', rule: "Events can't be edited or deleted.", export: 'Export' },
  settings: { heading: 'Settings', appearance: 'Appearance', staff: 'Staff', addStaff: 'Add staff', addEmail: 'Email', addRole: 'Role', remove: 'Remove access' },
  roles: { ops: 'Ops', support: 'Support', consent: 'Consent', content: 'Content' },
  login: { heading: 'Sign in to the console', email: 'Email', password: 'Password', submit: 'Sign in', passkey: 'Use a passkey' },
  mask: { hidden: 'Hidden', title: 'Why do you need to see this?', body: "Your reason is saved in the audit log with your name. The value isn't." },
  errors: { load: "This didn't load.", action: "That action didn't finish. Nothing changed. Try again." },
  // The page a parent lands on after answering the consent email
  // (GET /guardian-consent/:id?decision=). One heading, one paragraph.
  decision: {
    approved: {
      heading: "You're all set",
      body: 'You said yes to the NYC-MON account. Your child can finish setting it up on their device, and their Mon stays with them.',
    },
    denied: {
      heading: 'We deleted the request',
      body: 'No account was created. We deleted your email address and everything saved with the request.',
    },
    used: {
      heading: 'This link has already been used',
      body: 'This consent request was already answered, so nothing changed.',
    },
    expired: {
      heading: 'This link has expired',
      body: 'Consent links work for {days} days. This one ran out, and the request and your email address were removed.',
    },
    notFound: {
      heading: "We can't find that request",
      body: 'This link does not match a consent request. It may already have been answered and removed.',
    },
    invalid: {
      heading: 'This link is incomplete',
      body: 'It does not say yes or no. Open the link from the email exactly as it was sent.',
    },
    error: {
      heading: 'Something went wrong',
      body: 'Nothing changed. Try the link again in a few minutes.',
    },
  },
} as const;

export const reasonOptions = [
  { label: "Answering this Caller's support request", value: 'support_request' },
  { label: "Answering a parent's request", value: 'parent_request' },
  { label: 'Checking a deletion', value: 'deletion_check' },
  { label: 'Legal or safety request', value: 'legal' },
  { label: 'The Caller asked', value: 'caller_request' },
] as const;
