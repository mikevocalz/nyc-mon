/**
 * Every string on the How it works page (W04): the Phase-1 companion loop,
 * Meet → Name → Incubate → Hatch → Care. Phase 1 scope only — nothing past
 * the care loop. All `voice: "ui"`.
 */
export const W04_COPY = {
  loop: {
    eyebrow: 'The loop',
    title: 'How it works',
    body: 'Five steps, from the day you meet your egg to everyday care.',
    listLabel: 'The five steps',
    steps: [
      { numeral: '01', verb: 'Meet', line: 'Dr. Santoro shows you three eggs. You pick one.' },
      { numeral: '02', verb: 'Name', line: 'You pick a Caller name, the one your Mon will know you by.' },
      { numeral: '03', verb: 'Incubate', line: "15 minutes, 30 minutes or an hour, then one notification when it's ready." },
      { numeral: '04', verb: 'Hatch', line: 'Your Mon chooses too. The first look your Mon gives you is the yes.' },
      { numeral: '05', verb: 'Care', line: 'Feed, Rest and Play raise Fullness, Energy and Social.' },
    ],
  },
  cta: {
    eyebrow: 'The waitlist',
    title: 'Get on the waitlist.',
    body: "NYC-MON isn't out yet. Leave your email and we'll let you know the day it is.",
    cta: 'Join the waitlist',
    ctaHref: '/get',
  },
} as const;
