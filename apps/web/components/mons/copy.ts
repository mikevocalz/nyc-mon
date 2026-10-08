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
    body: 'Three Bloodlines hatch in this city, each from its own egg. Whoever hatches for you comes out a Baby and grows up beside a Caller. Meet them before one chooses you.',
    hatchesFrom: (egg: string) => `Hatches from the ${egg}`,
    dex: (dexId: number) => `No. ${String(dexId).padStart(3, '0')}`,
    cardHref: (slug: string) => `/mons/${slug}`,
    cardLabel: (baby: string) => `Meet ${baby}`,
  },
  detail: {
    eyebrow: (bloodline: string) => bloodline,
    dex: (dexId: number) => `No. ${String(dexId).padStart(3, '0')}`,
    bloodlineBody: (bloodline: string) =>
      `A Bloodline is a Dex family: the same roots under every Mon in it. The ${bloodline} starts as an Egg and hatches a Baby, and the Baby grows up beside a Caller.`,
    eggBody: (egg: string, baby: string) =>
      `${baby} hatches from the ${egg}. Incubation takes 15 minutes, 30 minutes or an hour. Then your Mon makes a choice too.`,
    /** One canon-flavored line per starter, keyed by the page's slug. */
    blurb: {
      'bodega-cee': 'Corner-store hours, corner-store loyalty. This line knows every regular on the avenue.',
      yotes: 'Bright, loud and out late. This line treats the whole borough as its yard.',
    } as Record<string, string>,
    lineTitle: 'Egg to Baby',
    unnamedForm: 'Unnamed form',
    back: 'Back to the Mons',
    backHref: '/mons',
  },
  meta: {
    indexDescription:
      'Meet the three NYC-MON starters: the eggs they hatch from and the Bloodlines they come from.',
    detailTitle: (baby: string) => `NYC-MON | The Mons | ${baby}`,
    detailDescription: (baby: string, bloodline: string) =>
      `${baby}, Baby form of the ${bloodline}, and the egg it hatches from.`,
  },
} as const;
