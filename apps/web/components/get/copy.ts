/**
 * Every string on the waitlist page (W05). All `voice: "ui"` — the canon voice:
 * warm, plain and honest about scope. There is no backend on this site
 * (ADR 0003), so the form confirms in place instead of faking a POST.
 */
export const W05_COPY = {
  hero: {
    eyebrow: 'The waitlist',
    title: 'Get NYC-MON',
    body: 'Phase 1 ships on iOS and Android. The store badges go up at launch — until then, the waitlist is how you hear about it. Leave your email and we chirp you the day the doors open.',
  },
  form: {
    label: 'Email address',
    placeholder: 'you@example.com',
    hint: 'One email when the app is out. No ads, no newsletter drip.',
    submit: 'Join the waitlist',
    errorInvalid: "That doesn't look like an email address.",
    confirmedTitle: "You're on the list — we'll chirp you.",
    confirmedBody: 'One email at launch, when the App Store and Google Play badges go live. That is the whole deal.',
  },
  stores: {
    label: 'The app stores',
    badges: [
      { name: 'App Store', note: 'At launch' },
      { name: 'Google Play', note: 'At launch' },
    ] as const,
  },
} as const;
