/**
 * The waitlist page's own strings (W05). All `voice: "ui"`: warm, plain and
 * honest about scope. The form's strings live with the form in
 * `components/waitlist/copy.ts`, shared with the home page (PS-023).
 */
export const W05_COPY = {
  hero: {
    eyebrow: 'The waitlist',
    title: 'Get NYC-MON',
    body: "NYC-MON is coming to iOS and Android. Until it's out, the waitlist is how you'll hear the day it lands.",
  },
  stores: {
    label: 'The app stores',
    badges: [
      { name: 'App Store', note: 'At launch' },
      { name: 'Google Play', note: 'At launch' },
    ] as const,
  },
} as const;
