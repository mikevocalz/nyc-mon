/**
 * Copy for the WEB-02 hero directions review (docs/design/site/HERO_DIRECTIONS.md).
 * Review-only: nothing here is imported by the public home page, and nothing
 * here changes `HOME_COPY` or `W01_COPY`. Strings that are already approved are
 * read from their source, so the review cannot drift from the live page.
 *
 * Direction A's headline is the approved slogan. Directions B and C carry
 * PROPOSED headlines and support lines that are not approved canon copy; the
 * review frame says so on screen. Every string follows docs/COPY_DECK.md:
 * sentence case, no exclamation marks, Caller (never Callah) in ui copy, no
 * pronoun for a Mon (PS-005), none of the banned words.
 *
 * Dependency-free on purpose (approved strings are passed in by the
 * components), so `copy.test.ts` can lint it under plain `node --test`.
 */

export type DirectionId = 'a' | 'b' | 'c';

export type CopyStatus = 'approved' | 'proposed';

export const REVIEW_COPY = {
  pageTitle: 'Hero directions (internal review)',
  notice:
    'Internal review only. The public home page is unchanged and keeps the approved headline until the creator decides. Creature pictures are concept art.',
  pickerLabel: 'Direction',
  statusLabel: {
    approved: 'Approved headline',
    proposed: 'Proposed, not approved canon copy',
  } satisfies Record<CopyStatus, string>,
  conceptArt: 'Concept art',
} as const;

export interface DirectionMeta {
  id: DirectionId;
  /** Short name for the picker. */
  label: string;
  /** Names the review frame for assistive tech. */
  frameLabel: string;
  status: CopyStatus;
}

export const DIRECTIONS: readonly DirectionMeta[] = [
  { id: 'a', label: 'A · Canon-first', frameLabel: 'Direction A, canon-first', status: 'approved' },
  { id: 'b', label: 'B · Companion-first', frameLabel: 'Direction B, companion-first', status: 'proposed' },
  { id: 'c', label: 'C · City-first', frameLabel: 'Direction C, city-first', status: 'proposed' },
];

/** A: the approved slogan (HOME_COPY.tagline) with a support line that says what a Mon is. */
export const CANON_COPY = {
  /** Art-directed breaks of HOME_COPY.tagline; the component checks they spell it. */
  titleLines: [['Every', 'block'], ['has a', 'legend.']],
  body: "Mons live on New York's blocks. Pick one of three eggs from Dr. Alessandra Santoro, be there when it hatches, then look after your Mon on the blocks you walk.",
  secondary: { label: 'Meet the three starters', href: '/mons' },
  /** Caption for the H-Lynk render; "Your line to your Mon." is the approved H-Lynk lede. */
  hlynkCaption: 'H-Lynk Core. Your line to your Mon.',
  hlynkAlt:
    'The H-Lynk Core, a matte red handheld with a black scanner head along the top, its screen reading Squeaklet, your Mon',
  babyCaption: (babyName: string, bloodline: string) => `${babyName}, ${bloodline}`,
} as const;

/** B: proposed. Leads with the two-way choice (Decision #14) and the care loop. */
export const COMPANION_COPY = {
  title: 'You pick the egg. Your Mon picks you.',
  titleLines: ['You pick the egg.', 'Your Mon picks you.'],
  body: "Three eggs wait on Dr. Alessandra Santoro's table. Choose one and be there when it hatches. Then your Mon asks for a meal, a rest or a game, and you answer.",
  choiceLabel: 'The three eggs',
  /** Speaker labels match the CARE section ("Your Mon" / "You"). */
  monLabel: 'Your Mon',
  youLabel: 'You',
} as const;

/** C: proposed. The H1 is the approved site intro's first sentence, promoted to the headline. */
export const CITY_COPY = {
  title: "Mons live on New York's blocks.",
  titleLines: ['Mons live on', "New York's blocks."],
  body: 'Four districts, from Lenox Avenue to the World Trade Center. Pick one to see its blocks. Then become a Caller and raise your own Mon.',
  /** Same label as the live hero's picker. */
  pickerLabel: 'Pick a district',
  photoCaption: (title: string, place?: string) => (place ? `${title}, ${place}` : title),
} as const;

/** Every ui string a direction can print, for the copy lint. */
export function allReviewStrings(): string[] {
  return [
    REVIEW_COPY.pageTitle,
    REVIEW_COPY.notice,
    REVIEW_COPY.pickerLabel,
    ...Object.values(REVIEW_COPY.statusLabel),
    REVIEW_COPY.conceptArt,
    ...DIRECTIONS.flatMap((d) => [d.label, d.frameLabel]),
    ...CANON_COPY.titleLines.flat(),
    CANON_COPY.body,
    CANON_COPY.secondary.label,
    CANON_COPY.hlynkCaption,
    CANON_COPY.hlynkAlt,
    COMPANION_COPY.title,
    ...COMPANION_COPY.titleLines,
    COMPANION_COPY.body,
    COMPANION_COPY.choiceLabel,
    COMPANION_COPY.monLabel,
    COMPANION_COPY.youLabel,
    CITY_COPY.title,
    ...CITY_COPY.titleLines,
    CITY_COPY.body,
    CITY_COPY.pickerLabel,
  ];
}

/**
 * The review route renders only when NYCMON_REVIEW_ROUTES is exactly "1".
 * Anything else (unset, "true", "0") is a 404, so a production deploy that
 * never sets the flag never serves the page.
 */
export function reviewRoutesEnabled(env: Record<string, string | undefined>): boolean {
  return env.NYCMON_REVIEW_ROUTES === '1';
}

/** Reads `?direction=` from a URL search string; anything unknown falls back to A. */
export function directionFromSearch(search: string): DirectionId {
  const value = new URLSearchParams(search).get('direction');
  return value === 'b' || value === 'c' ? value : 'a';
}
