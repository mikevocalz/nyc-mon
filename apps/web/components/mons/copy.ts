import { W01_COPY } from '../home/copy';
import { WAITLIST_CTA } from '../site/nav';

/**
 * Every string on the /mons pages (W02). Dex data (Baby names, Dex numbers,
 * egg names) comes from @acme/content at render; only the voice lives here.
 * Phase 1 scope: no combat, no stats, no battles. Contract §4: public pages
 * name the Egg and Baby only; Small/Mid/Max forms are spoilers (PS-029).
 */
export const W02_COPY = {
  index: {
    eyebrow: 'The starters',
    title: 'The Mons',
    body: 'Four Bloodlines hatch in this city, each from its own egg. Whoever hatches for you comes out a Baby and grows up beside a Caller. Meet them before one chooses you.',
    hatchesFrom: (egg: string) => `Hatches from the ${egg}`,
    /** Takes dexDigits(dexId), so an edited "No. {0}" row keeps the zero padding. */
    dex: (digits: string) => `No. ${digits}`,
    cardHref: (slug: string) => `/mons/${slug}`,
    cardLabel: (baby: string) => `Meet ${baby}`,
    /** The closing band: the home page's hatch line, then the site's one CTA. */
    closing: W01_COPY.hatch.closing,
    cta: WAITLIST_CTA,
  },
  /** Printed on every creature picture: the art stands in for final renders (PS-007, PS-028). */
  conceptArt: 'Concept art',
  detail: {
    eyebrow: (bloodline: string) => bloodline,
    /** Takes dexDigits(dexId), so an edited "No. {0}" row keeps the zero padding. */
    dex: (digits: string) => `No. ${digits}`,
    bloodlineBody: (bloodline: string) =>
      `A Bloodline is a Dex family: the same roots under every Mon in it. The ${bloodline} starts as an Egg and hatches a Baby, and the Baby grows up beside a Caller.`,
    eggBody: (egg: string, baby: string) =>
      `${baby} hatches from the ${egg}. Incubation takes 15 minutes, 30 minutes or an hour. Then your Mon makes a choice too.`,
    /** One canon-flavored line per starter, keyed by the page's slug. */
    blurb: {
      'bodega-cee': 'Corner-store hours, corner-store loyalty. This Bloodline knows every regular on the avenue.',
      yotes: 'Bright, loud and out late. This Bloodline treats the whole borough as its yard.',
      // Canon: the LanternFye loreSummary, roster v11.1 (packages/content/mons/inherited-v11-starters.ts).
      lanternfye: 'A wingless spotted hopper learns to turn scarlet electricity into a readable relay network.',
    } as Record<string, string>,
    lineTitle: 'Egg to Baby',
    unnamedForm: 'Unnamed form',
    back: 'Back to the Mons',
    backHref: '/mons',
    othersTitle: 'Meet the others',
    /** The hatch band: the home page's hatch title and closing line, then the site's one CTA. */
    hatchTitle: W01_COPY.hatch.title,
    hatchClosing: W01_COPY.hatch.closing,
    cta: WAITLIST_CTA,
  },
  meta: {
    indexDescription:
      'Meet the four NYC-MON starters: the eggs they hatch from and the Bloodlines they come from.',
    detailTitle: (baby: string) => `NYC-MON | The Mons | ${baby}`,
    detailDescription: (baby: string, bloodline: string) =>
      `${baby}, the Baby form of the ${bloodline}, and the egg ${baby} hatches from.`,
  },
} as const;
