/**
 * Every string on the home page (W01). Source and voice for each line:
 * docs/design/screens/W01/05-copy.md. All `voice: "ui"`.
 */
export const W01_COPY = {
  hero: {
    title: 'Every block has a legend.',
    body: "Mons live in New York, on the same blocks as you. They showed up less than ten years ago, and the city's still figuring them out.",
    cta: 'Join the waitlist',
    ctaHref: '/get',
    startersLabel: 'The three starters',
    districtLabel: 'Pick a district',
    cityLabel: (district: string) => `${district} street grid, seen from above`,
  },
  hlynk: {
    title: 'The H-Lynk Core',
    body: 'Dr. Alessandra Santoro hands you an H-Lynk Core: a red handheld with a black scanner across the top. It keeps you in touch with your Mon and helps with care.',
    body2: "The bond is between you and your Mon. The H-Lynk doesn't own anyone.",
    caption: 'H-Lynk Core, the entry tier. Red body, black scanner head.',
  },
  starters: {
    title: 'Three eggs. One of them hatches for you.',
    body: "Each comes from a Bloodline. Whoever's inside is their own person.",
    hatchesFrom: (egg: string) => `Hatches from the ${egg}`,
    dex: (dexId: number) => `No. ${String(dexId).padStart(3, '0')}`,
  },
  care: {
    title: 'How care works',
    body: 'Three meters, three things you do. Your Mon tells you what it needs with a look, a sound or a reach.',
    example: 'Example meter levels',
    items: [
      { verb: 'Feed', meter: 'Fullness', line: 'Fills Fullness. Each Mon eats its own way.', value: 70, color: 'orange' },
      { verb: 'Rest', meter: 'Energy', line: 'Lights down, your Mon sleeps and Energy comes back.', value: 45, color: 'royal' },
      { verb: 'Play', meter: 'Social', line: 'A short game together raises Social.', value: 85, color: 'leaf' },
    ],
  },
  hatch: {
    title: 'Pick a time. The egg waits.',
    body: "Incubation takes 15 minutes, 30 minutes or an hour. You get one notification when it's ready.",
    body2: 'Then the Mon makes its choice. Its first look at you is how it says yes.',
  },
} as const;
