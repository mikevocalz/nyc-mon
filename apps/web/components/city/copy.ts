/**
 * Every string on the City page (W03). Public-safe canon only: the four
 * districts, Callers, Hood Mons and the H-Lynk. All `voice: "ui"`.
 * Voice rules: docs/COPY_DECK.md — sentence case, Caller never Callah,
 * "Hood" means free-living, the H-Lynk is never "the device".
 */
export const W03_COPY = {
  districts: {
    eyebrow: 'The setting',
    title: 'The City',
    body: 'Mons live in New York — the real one, in four districts. Each has its own skyline, its own corners and its own legends.',
    listLabel: 'The four districts',
  },
  cast: {
    eyebrow: 'The cast',
    title: 'Who shares the streets',
    body: 'Two kinds of neighbors, and the handheld that keeps them talking.',
    items: [
      {
        title: 'Callers',
        line: 'People who bond with a Mon through the H-Lynk. A Mon chooses a Caller back, and nobody owns anyone.',
      },
      {
        title: 'Hood Mons',
        line: 'Mons with no Caller, living free on the same streets as you. Hood means free-living, not hostile.',
      },
      {
        title: 'The H-Lynk',
        line: "The handheld that keeps a Caller and a Mon in touch. It helps with care — it doesn't own anyone.",
      },
    ],
  },
} as const;
