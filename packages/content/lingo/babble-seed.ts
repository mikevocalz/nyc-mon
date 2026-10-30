import type { LexiconRow } from './rows.ts';

/**
 * The babble a Mon makes as an Egg and for its first day as a Baby
 * (Decision 32, Mike, 2026-10-29), seeded into Payload by migration
 * `20261029_120000_mon_babble_seed`. Like seed.ts this is a seed and the
 * offline fallback: Payload is the source of truth, and Mike edits these rows
 * in the admin (`language-lexicon`, category `babble`).
 *
 * - `syllable` rows are the shared baby syllables. A babble token chains one to
 *   three of them, never the same one twice in a row. None of them, and no
 *   chain of them, is a word: the speech gate in @acme/core also blocks a list
 *   of real words, so an edit here cannot make a babbling Mon say one.
 * - `family-sound` rows are a line's own sound as a word-free token, so a
 *   Squeaklet's babble chirps like a Ratti (V11 ¶56: the same voice growing
 *   up). The family sounds' descriptions are in seed.ts (`voice-rule.family-sound.*`).
 * - `egg-sound` rows are the muffled sounds from inside the shell.
 *
 * Not in seed.ts because that seed is pinned by hash to migration
 * `20261028_200000_mon_lingo_seed`.
 */

const DECISION = 'docs/canon/DECISIONS.md Decision 32 (Mike, 2026-10-29); V11 ¶56';
const POLICY = 'Babble only: spoken by an Egg, and by a Baby in its first 24 hours. Never a word, in any language.';

type Seed = Omit<LexiconRow, 'active' | '_status' | 'locale'>;

function syllable(text: string, sortOrder: number): Seed {
  return {
    key: `babble.syllable.${text}`,
    entryType: 'lexicon',
    category: 'babble',
    subcategory: 'syllable',
    canonicalText: text,
    sortOrder,
    meaning: 'A baby syllable. Babble chains one to three of these into a token, like “bwa-gu” or “minya”.',
    activationPolicy: POLICY,
    sourceBasis: DECISION,
  };
}

function familySound(text: string, speciesId: string, bloodlineId: string, description: string, sortOrder: number): Seed {
  return {
    key: `babble.family-sound.${bloodlineId.toLowerCase()}.${text}`,
    entryType: 'lexicon',
    category: 'babble',
    subcategory: 'family-sound',
    canonicalText: text,
    speciesId,
    bloodlineId,
    sortOrder,
    meaning: `The family sound as a babble token: ${description}.`,
    activationPolicy: `${POLICY} Only this Bloodline’s Mons use it.`,
    sourceBasis: `${DECISION}; skills/nyc-mon-companion/SKILL.md §The forms (${description})`,
  };
}

function eggSound(text: string, sortOrder: number): Seed {
  return {
    key: `babble.egg-sound.${text}`,
    entryType: 'lexicon',
    category: 'babble',
    subcategory: 'egg-sound',
    canonicalText: text,
    stage: 'Egg',
    sortOrder,
    meaning: 'A muffled sound from inside the shell.',
    activationPolicy: `${POLICY} Eggs only.`,
    sourceBasis: DECISION,
  };
}

const RATTI = 'F01';
const KITTEE_CEE = 'F02';
const YOTITO = 'F12';

const SEED: readonly Seed[] = [
  ...['ba', 'bwa', 'gu', 'nya', 'mi', 'bu', 'wa', 'lu'].map((text, i) => syllable(text, 10 + i)),
  familySound('skree', 'dex-002', RATTI, 'bright scritchy chirps', 100),
  familySound('chk', 'dex-002', RATTI, 'confident little chuckles', 101),
  familySound('mrrp', 'dex-009', KITTEE_CEE, 'chirrup', 110),
  familySound('prrrt', 'dex-009', KITTEE_CEE, 'purr', 111),
  familySound('yiip', 'dex-062', YOTITO, 'yips', 120),
  familySound('awooo', 'dex-062', YOTITO, 'a short rally howl', 121),
  eggSound('mm', 200),
  eggSound('bwu', 201),
  eggSound('nnh', 202),
];

/** Every seeded babble row, published. */
export const MON_BABBLE_SEED_ROWS: readonly LexiconRow[] = SEED.map((row) => ({ ...row, active: true, locale: 'en-US', _status: 'published' }));

/**
 * The Egg's pitch factor in the `mon-voices` global (it was null: silent).
 * Higher than the Baby's 1.3, so the babble from the shell sounds youngest.
 */
export const MON_EGG_STAGE_PITCH = 1.45;
