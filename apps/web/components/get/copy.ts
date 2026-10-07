/**
 * The waitlist page's own strings (W05). All `voice: "ui"`: warm, plain and
 * honest about scope. The form's strings live with the form in
 * `components/waitlist/copy.ts`, shared with the home page (PS-023).
 */
export const W05_COPY = {
  hero: {
    eyebrow: 'The waitlist',
    title: 'Get NYC-MON',
    body: "Phase 1 ships on iOS and Android. The store badges go up at launch, and until then the waitlist is how you'll hear the day it's out.",
  },
  stores: {
    label: 'The app stores',
    badges: [
      { name: 'App Store', note: 'At launch' },
      { name: 'Google Play', note: 'At launch' },
    ] as const,
  },
} as const;
