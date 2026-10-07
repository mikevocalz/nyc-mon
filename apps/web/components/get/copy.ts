/**
 * Every string on the waitlist page (W05). All `voice: "ui"` — the canon voice:
 * warm, plain and honest about scope. The email form returns with the waitlist
 * endpoint (PREMIUM_SITE_DECISIONS.md PS-001); until then `status` says so.
 */
export const W05_COPY = {
  hero: {
    eyebrow: 'The waitlist',
    title: 'Get NYC-MON',
    body: "Phase 1 ships on iOS and Android. The store badges go up at launch, and until then the waitlist is how you'll hear the day it's out.",
  },
  status: {
    title: 'Sign-ups open soon.',
    body: "The waitlist isn't taking emails yet. When it is, this is where you join, and you'll get one email when the app is out.",
  },
  stores: {
    label: 'The app stores',
    badges: [
      { name: 'App Store', note: 'At launch' },
      { name: 'Google Play', note: 'At launch' },
    ] as const,
  },
} as const;
