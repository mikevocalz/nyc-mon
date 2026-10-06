/**
 * The Story page copy — the Clean City Legacy and the Great Misclassification
 * (canon lore v2, 5 Oct 2026). The story's present is a New York decades after
 * the Clean City era; every section is anchored to that timeline. Marketing-
 * facing: the reveal order stops short of the deepest EngineX secrets, but
 * nothing here contradicts canon.
 */
export const STORY_COPY = {
  hero: {
    eyebrow: 'THE STORY',
    title: 'We killed them.',
    body: "Decades from now, New York is cleaner, smarter, sealed. The old stories about rats owning subway platforms sound like fairy tales. Every report says the same thing: problem solved, population eliminated. Every report is wrong.",
  },

  cleanCity: {
    eyebrow: 'THE CLEAN CITY ERA — DECADES AGO',
    title: 'The city that stopped looking',
    body: 'It began under the Mamdani administration: sealed trash, cleared habitats, monitored parks — a sanitation campaign that actually worked. In the decades that followed, rat mitigation hardened into pest management, then species reduction, and New York grew up believing the old animal populations were gone for good. Nobody watched the survivors slip into the places the cleanup never reached: abandoned tunnels, utility corridors, waterways, sealed buildings, forgotten industrial space.',
  },

  projectZero: {
    eyebrow: 'PROJECT ZERO',
    title: 'The serum that missed',
    body: 'The mandate kept tightening, and EngineX was hired to finish the job — a lethal eradication treatment for whatever the city still harbored. A stabilizing compound in the formula was calculated wrong. Instead of simply destroying targeted tissue, it carried a hidden, gene-altering effect nobody designed, nobody approved, nobody detected. The reports said exposure meant eradication. The survivors told a different story — across generations.',
    quote: 'Nobody designed it to evolve animals. Nobody approved it as genetic engineering.',
  },

  vale: {
    eyebrow: 'DR. EVELYN VALE',
    title: 'The one who saved them',
    body: 'Dr. Vale discovered that some of the "deceased" were not dead — they had slipped into a dormant, coma-like state. She changed the program so affected animals could stay that way rather than complete the lethal process. Saving them was deliberate. The gene-altering effect already inside them was not. She preserved lives she could not fully undo.',
  },

  extinction: {
    eyebrow: 'THE FALSE EXTINCTION',
    title: 'Declared gone, decades ago',
    body: 'Treatment zones were declared successes. Specimens were catalogued as deceased. Reports closed, contracts completed, the era filed as an extinction. Meanwhile the survivors went dark — some dormant for years, others relocating deeper into the hidden city. What New York called an ending was, for them, the start of adaptation.',
  },

  cascade: {
    eyebrow: 'THE HIDDEN DECADES',
    title: 'New York became the pressure',
    body: 'The serum created survival. The decades after created evolution. Underground and overhead, the city itself became the environment — and different habitats raised different lineages.',
    lineages: [
      { name: 'Subway & tunnel', line: 'Heat, vibration, metal and transit rhythms produced the underground specialists.' },
      { name: 'Parks', line: 'Seasons, vegetation and wildlife competition shaped their own forms.' },
      { name: 'Waterfront', line: 'Tides, salinity and restored waterways built aquatic descendants.' },
      { name: 'Rooftops', line: 'Wind, vertical travel and drone traffic shaped aerial populations.' },
      { name: 'The built world', line: 'Bodegas, housing blocks and human food systems raised the most streetwise of all.' },
    ],
  },

  returned: {
    eyebrow: 'THE RETURN — THE PRESENT',
    title: "They didn't appear. They returned.",
    body: 'Decades after the last official sighting, the first modern Mons surfaced in fragments — a strange Ratti near the subway, a speaking creature by a bodega, a winged insectoid on a rooftop, something moving through an old tunnel on security footage. Recordings were dismissed as deepfakes. Then the encounters kept coming.',
    quote: 'Mons are not an invasion. They are descendants — New York\u2019s hidden children, a new branch of living urban life.',
  },

  enginex: {
    eyebrow: 'ENGINEX TODAY',
    title: 'Three eras of one company',
    eras: [
      { era: 'Era I — Eradication', line: 'Remove the problem.' },
      { era: 'Era II — Suppression', line: 'Hide the failure.' },
      { era: 'Era III — Monetization', line: 'Control the future.' },
    ],
    body: 'H-Lynk technology, Mon research, controlled habitats and tournament sponsorship are the corporate descendants of the eradication program. EngineX argues that creating the conditions means owning the outcome. The Mons — and the Callers who partner with them — disagree. Partnership is not ownership.',
  },

  footer: {
    title: 'Every block has a legend.',
    body: 'You just learned where the legends came from.',
    cta: { label: 'Meet the Mons', href: '/mons' },
  },
} as const;
