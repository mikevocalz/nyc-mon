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
  /** A photograph's place caption: district, then cross streets when canon gives a place. */
  placeCaption: (district: District, place?: string) =>
    place ? `${DISTRICT_COPY[district].name}, ${place}` : DISTRICT_COPY[district].name,
  /** The hero poster's caption: the landmark and its cross streets, never the picked district (PS-026). */
  landmarkCaption: (title: string, place?: string) => (place ? `${title}, ${place}` : title),
  hero: {
    title: HOME_COPY.tagline,
    titleLines: TITLE_LINES,
    body: 'Pick one of three eggs from Dr.\u00a0Alessandra Santoro. Be there when it hatches. Then look after your Mon on the same blocks you walk.',
    cta: WAITLIST_CTA.label,
    ctaHref: WAITLIST_CTA.href,
    districtLabel: 'Pick a district',
  },
  signage: {
    title: 'Four districts',
  },
  world: {
    title: 'New York is the world.',
    body: "Mons live in New York, on the same blocks as you. They showed up less than ten years ago, and the city's still figuring them out.",
    body2: 'Four districts, from Lenox Avenue to the World Trade Center.',
  },
  // Physical facts trace to canon Decision #16 only. No tab labels (Q42), no
  // EngineX (Q40), no recruiting verbs, no pronoun for a Mon (PS-005).
  hlynk: {
    title: 'H-Lynk Core',
    lede: 'Your line to your Mon.',
    body: 'Dr.\u00a0Santoro hands you an H-Lynk Core: matte red plastic with a black scanner across the top. It keeps you in touch with your Mon and helps you with care.',
    bond: "The bond is yours and your Mon's. The H-Lynk Core keeps you in reach of each other.",
    stageLabel: 'H-Lynk Core',
    caption: 'H-Lynk Core, the entry tier. Matte red body, black scanner head.',
    /** The proof modules, in DOM (= phone) order. Each pairs with a crop of the capture in art.ts. */
    proof: [
      {
        slot: 'hlynk.scanner',
        title: 'Scanner head',
        line: 'A black head along the top edge, with red emitters that throw a fan of light upward and a stub antenna at its left end.',
      },
      {
        slot: 'hlynk.controls',
        title: 'Control row',
        line: 'Home and menu on the left, back and forward on the right, and a square trackpad ringed in red between them.',
      },
    ],
    /**
     * The H-Lynk's own screen, drawn inside the 3D stage: the tier, a starter's
     * Baby name (HLynkSection reads it from @acme/content) and this note.
     */
    screen: {
      title: 'H-Lynk Core',
      note: 'Your Mon',
    },
  },
  starters: {
    eyebrow: 'The starters',
    title: "Three eggs on Dr.\u00a0Santoro's table.",
    /** The egg names come from @acme/content, in starter slot order. */
    body: (eggNames: readonly string[]) =>
      `${eggNames.slice(0, -1).join(', ')} and ${eggNames.at(-1) ?? ''}. Each holds a Mon from a different Bloodline. You pick an egg. Your Mon decides the rest at the hatch.`,
    body2: 'Mons are people in this city. They think, they choose and they can say no.',
    hatchesFrom: (egg: string) => `Hatches from the ${egg}`,
    dex: (dexId: number) => `No. ${String(dexId).padStart(3, '0')}`,
  },
  grid: {
    pause: 'Pause animation',
    play: 'Play animation',
  },
  care: {
    title: 'Your Mon asks. You answer.',
    body: 'A look, a sound or a reach is how your Mon asks for a meal, a quiet night or a game.',
    closing: 'A low meter is a request. Nothing is lost while you are away.',
    example: 'Example levels, not a live reading.',
    /** Meter name for screen readers: the level is an illustration, never the reader's Mon. */
    meterLabel: (meter: string) => `${meter}, example level`,
    cueLabel: 'Your Mon',
    answerLabel: 'You',
    items: [
      { verb: 'Feed', meter: 'Fullness', cue: 'Asks for food.', answer: 'Share a meal. Every Mon has favorites.', value: 70, color: 'orange' },
      { verb: 'Rest', meter: 'Energy', cue: 'Gets sleepy.', answer: 'Lights down. Energy comes back while your Mon sleeps.', value: 45, color: 'royal' },
      { verb: 'Play', meter: 'Social', cue: 'Comes closer.', answer: 'Play a short game. Stop when your Mon steps back.', value: 85, color: 'leaf' },
    ],
  },
  // Canon: 15 / 30 / 60 minutes and one notification (V11 ¶49); the Mon chooses at the hatch and never
  // rejects the Caller (Decision #14). No pronoun for a Mon (PS-005). No timer, no countdown.
  hatch: {
    eyebrow: 'The hatch',
    /** Set as two lines: the choice, then the wait. */
    title: ['Pick a time.', 'The egg waits.'],
    body: "Incubation takes 15 minutes, 30 minutes or an hour. Go about your day. You get one notification when it's ready.",
    body2: 'Then your Mon makes a choice too. The first look your Mon gives you is the yes, and sometimes that takes a moment.',
    closing: 'Be there when it opens.',
  },
} as const;
