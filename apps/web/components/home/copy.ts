import { DISTRICT_COPY, HOME_COPY } from '@acme/spatial/copy';
import type { District } from '@acme/ui';
import { WAITLIST_CTA } from '../site/nav';

/**
 * Every string on the home page (W01). Source and voice for each line:
 * docs/design/screens/W01/05-copy.md and PREMIUM_SITE_AUDIT.md §9. All
 * `voice: "ui"`. The slogan is defined once, in `HOME_COPY.tagline`; the CTA
 * once, in `WAITLIST_CTA`.
 */
/**
 * The hero headline's art-directed breaks, as words of the one slogan: two
 * lines from `md` (outer arrays), four on a phone (inner arrays). The guard
 * keeps the breaks honest if the slogan ever changes.
 */
const TITLE_LINES = [
  ['Every', 'block'],
  ['has a', 'legend.'],
] as const;

if (TITLE_LINES.flat().join(' ') !== HOME_COPY.tagline) {
  throw new Error('W01 hero title breaks must spell HOME_COPY.tagline');
}

export const W01_COPY = {
  /** A photograph's place caption: district, then cross streets. */
  placeCaption: (district: District, place: string) => `${DISTRICT_COPY[district].name}, ${place}`,
  hero: {
    title: HOME_COPY.tagline,
    titleLines: TITLE_LINES,
    body: 'Pick one of three eggs from Dr. Santoro. Be there when it hatches. Then look after your Mon on the same blocks you walk.',
    cta: WAITLIST_CTA.label,
    ctaHref: WAITLIST_CTA.href,
    districtLabel: 'Pick a district',
    cityLabel: (district: string) => `${district} street grid, seen from above`,
  },
  signage: {
    title: 'Four districts',
  },
  world: {
    title: 'New York is the world.',
    body: "Mons live in New York, on the same blocks as you. They showed up less than ten years ago, and the city's still figuring them out.",
    body2: 'Four districts, from Lenox Avenue to the World Trade Center.',
  },
  hlynk: {
    eyebrow: 'H-Lynk',
    title: 'The H-Lynk Core',
    stageLabel: 'H-Lynk Core',
    features: [
      'Twin-emitter scanner head — the beam calls them out',
      'A live HUD — Dex, Crew, Care, Bag, City',
      'Push-to-talk on the left edge — it chirps',
    ],
    body: 'Dr. Alessandra Santoro hands you an H-Lynk Core: a red handheld with a black scanner across the top. It keeps you in touch with your Mon and helps with care.',
    body2: "The bond is between you and your Mon. The H-Lynk doesn't own anyone.",
    caption: 'H-Lynk Core, the entry tier. Red body, black scanner head.',
  },
  starters: {
    eyebrow: 'The starters',
    title: 'Three eggs. One of them hatches for you.',
    body: "Each comes from a Bloodline. Whoever's inside is their own person.",
    hatchesFrom: (egg: string) => `Hatches from the ${egg}`,
    dex: (dexId: number) => `No. ${String(dexId).padStart(3, '0')}`,
  },
  care: {
    eyebrow: 'The loop',
    title: 'How care works',
    body: 'Three meters, three things you do. Your Mon tells you what it needs with a look, a sound or a reach.',
    closing: 'A relationship, not a streak.',
    panelLabel: 'H-Lynk care readout',
    example: 'Example meter levels',
    items: [
      { verb: 'Feed', meter: 'Fullness', line: 'Fills Fullness. Each Mon eats its own way.', value: 70, color: 'orange' },
      { verb: 'Rest', meter: 'Energy', line: 'Lights down, your Mon sleeps and Energy comes back.', value: 45, color: 'royal' },
      { verb: 'Play', meter: 'Social', line: 'A short game together raises Social.', value: 85, color: 'leaf' },
    ],
  },
  hatch: {
    eyebrow: 'The hatch',
    title: 'Pick a time. The egg waits.',
    body: "Incubation takes 15 minutes, 30 minutes or an hour. You get one notification when it's ready.",
    body2: 'Then the Mon makes its choice. Its first look at you is how it says yes.',
    closing: 'Be there when it opens.',
    cta: WAITLIST_CTA.label,
    ctaHref: WAITLIST_CTA.href,
    figureLabel: 'The district at night, during the hatch window',
  },
} as const;
