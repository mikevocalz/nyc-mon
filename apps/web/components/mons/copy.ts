/**
 * Every string on the /mons pages (W02). Dex data — form names, Dex numbers,
 * egg names, stages — comes from @acme/content at render; only the voice lives
 * here. Phase 1 scope: no combat, no stats, no battles.
 */
export const W02_COPY = {
  index: {
    eyebrow: 'The starters',
    title: 'The Mons',
    body: 'Three Bloodlines hatch in this city, each from its own egg. Whoever hatches for you starts small and grows their own line — Baby to Small to Mid, then one of three Max forms. Meet them before one chooses you.',
    hatchesFrom: (egg: string) => `Hatches from the ${egg}`,
    dex: (dexId: number) => `No. ${String(dexId).padStart(3, '0')}`,
    cardHref: (slug: string) => `/mons/${slug}`,
    cardLabel: (baby: string) => `${baby} — meet the line`,
  },
  detail: {
    eyebrow: (bloodline: string) => bloodline,
    dex: (dexId: number) => `No. ${String(dexId).padStart(3, '0')}`,
    bloodlineBody: (bloodline: string) =>
      `A Bloodline is a Dex family — the same roots under every form. The ${bloodline} grows Egg to Baby to Small to Mid, then the Mid becomes one of three Max forms. That choice is the Mon's own.`,
    eggBody: (egg: string, baby: string) =>
      `${baby} hatches from the ${egg}. Incubation takes 15 minutes, 30 minutes or an hour — then the Mon makes its choice.`,
    /** One canon-flavored line per starter, keyed by the page's slug. */
    blurb: {
      'hood-ratti': 'Hood means free-living, not hostile — this line grew up on the block it still runs.',
      'bodega-cee': 'Corner-store hours, corner-store loyalty. This line knows every regular on the avenue.',
      yotes: 'Bright, loud and out late — this line treats the whole borough as its yard.',
    } as Record<string, string>,
    lineTitle: 'Evolution line',
    unnamedForm: 'Unnamed form',
    cultureMissing:
      "The roster hasn't written this one's species note yet — the Dex leaves a blank line where the city's story goes.",
    back: 'Back to the Mons',
    backHref: '/mons',
  },
  meta: {
    indexDescription:
      'Meet the three NYC-MON starters: the eggs they hatch from, the Bloodlines they come from and the lines they grow.',
    detailTitle: (baby: string) => `NYC-MON | The Mons — ${baby}`,
    detailDescription: (baby: string, bloodline: string) =>
      `${baby}, Baby form of the ${bloodline} — the egg it hatches from and every form it can grow.`,
  },
} as const;
