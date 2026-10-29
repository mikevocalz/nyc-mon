import type { VoiceStage } from '../types/index.ts';
import { createRandom, hash128 } from './random.ts';

/**
 * The speech gate: what a Mon may say at its voice stage (Decision 32,
 * OPEN_QUESTIONS Q32). Every surface runs a line through it before the line is
 * shown or voiced, and the servers run it on model output, so a prompt is never
 * the only thing keeping words out of a babbling Mon's mouth.
 *
 * The babble syllables and family sounds are data (Payload `language-lexicon`
 * rows, category `babble`); this module takes them as a {@link BabbleInventory}
 * and checks every entry before trusting it.
 */

/** The sounds a babbling Mon is made of. */
export interface BabbleInventory {
  /** Babble syllables ("ba", "bwa", "gu"); a babble token chains one to three of them. */
  readonly syllables: readonly string[];
  /** Whole-token sounds: the family sound ("skree"), egg sounds ("mm"). */
  readonly sounds: readonly string[];
}

/** Most syllables one babble token chains. Longer chains start to read as words. */
export const MAX_BABBLE_SYLLABLES = 3;

/** Most words (tokens that are not babble or family sound) a `limited` line may hold. */
export const LIMITED_SPEECH_MAX_WORDS = 2;

/**
 * Used when an inventory has no usable syllables (a served lingo from before
 * the babble rows, or every row filtered out). Picked so that no chain of up to
 * three of them, without a doubled syllable, spells a common English word.
 */
export const DEFAULT_BABBLE_SYLLABLES: readonly string[] = ['ba', 'bwa', 'gu', 'nya', 'mi', 'bu', 'wa', 'lu'];

/**
 * Real words a babble token may never be, whatever the inventory says:
 * words a model reaches for when told to babble, words baby syllables spell
 * (mama, dada, gaga), and animal words that are words (meow, woof, yip).
 */
export const REAL_WORD_BLOCKLIST: readonly string[] = [
  'a', 'i', 'o', 'hi', 'hey', 'hello', 'bye', 'yes', 'yeah', 'yep', 'no', 'nope', 'nah', 'ok', 'okay', 'oh', 'uh', 'um', 'wow',
  'food', 'eat', 'hungry', 'bet', 'again', 'more', 'up', 'go', 'play', 'sleep', 'nap', 'love', 'you', 'me', 'my', 'we', 'us',
  'mama', 'mommy', 'mom', 'dada', 'daddy', 'dad', 'papa', 'baby', 'nana', 'gogo', 'gaga', 'goo', 'boo', 'bub', 'bum', 'poo', 'pee',
  'wee', 'wawa', 'lulu', 'bubu', 'baba', 'mimi', 'mine', 'wane', 'bane', 'lune', 'gum', 'bug', 'bun', 'bunny', 'yum', 'yummy',
  'caller', 'callah', 'call', 'meow', 'mew', 'purr', 'woof', 'arf', 'bark', 'yip', 'yap', 'howl', 'chirp', 'squeak',
  // Dictionary words the default syllables can chain into (checked against /usr/share/dict/words, 2026-10-29).
  'babu', 'balu', 'baluba', 'banya', 'buba', 'bunya', 'luba',
];

const BLOCKED = new Set(REAL_WORD_BLOCKLIST);

/** A pronoun or a contraction turns two words into a clause, which `limited` never says. */
const CLAUSE_WORDS = new Set(['i', 'me', 'my', 'you', 'your', 'we', 'us', 'our', 'he', 'she', 'it', 'they', 'them', 'this', 'that', 'is', 'am', 'are']);

/** Caller, Callah and the spoken "Call-uh", singular or plural. */
const CALLAH = /\bcall(?:ah|er|-uh)s?\b|\bcall-uhz\b/i;

const DIRECTION = /\*[^*\n]{0,80}\*/g;
const AUDIO_TAG = /\[[^\]\n]{0,40}\]/g;
const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;

function stripPerformance(text: string): string {
  return text.replace(DIRECTION, ' ').replace(AUDIO_TAG, ' ').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The words of a line: stage directions and audio tags dropped, lower case, apostrophes kept. */
export function speechTokens(text: string): string[] {
  const plain = stripPerformance(text.replace(/[’‘]/g, "'"));
  return [...plain.matchAll(TOKEN)].map((m) => m[0].toLowerCase().replace(/['-]+$/, '')).filter((t) => t !== '');
}

interface CleanInventory {
  readonly syllables: readonly string[];
  readonly sounds: ReadonlySet<string>;
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The inventory the gate trusts: lower-case letters only (syllables 1 to 5,
 * sounds 2 to 10), no blocked real word, de-duplicated and sorted so the same
 * rows in any order babble the same. No usable syllable falls back to
 * {@link DEFAULT_BABBLE_SYLLABLES}. Anything shown to a model goes through this too.
 */
export function cleanBabbleInventory(inventory: BabbleInventory): BabbleInventory {
  const syllables = [...new Set(inventory.syllables.map((s) => s.trim().toLowerCase()))].filter((s) => /^[a-z]{1,5}$/.test(s) && !BLOCKED.has(s)).sort(byText);
  const sounds = [...new Set(inventory.sounds.map((s) => s.trim().toLowerCase()))].filter((s) => /^[a-z]{2,10}$/.test(s) && !BLOCKED.has(s)).sort(byText);
  return { syllables: syllables.length > 0 ? syllables : DEFAULT_BABBLE_SYLLABLES, sounds };
}

function clean(inventory: BabbleInventory): CleanInventory {
  const { syllables, sounds } = cleanBabbleInventory(inventory);
  return { syllables, sounds: new Set(sounds) };
}

/** True when `text` splits into 1 to MAX_BABBLE_SYLLABLES syllables with no syllable twice in a row. */
function isChain(text: string, syllables: readonly string[]): boolean {
  const walk = (at: number, count: number, previous: string | undefined): boolean => {
    if (at === text.length) return count > 0;
    if (count === MAX_BABBLE_SYLLABLES) return false;
    return syllables.some((s) => s !== previous && text.startsWith(s, at) && walk(at + s.length, count + 1, s));
  };
  return text !== '' && walk(0, 0, undefined);
}

function tokenOk(token: string, inv: CleanInventory): boolean {
  const word = token.toLowerCase();
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(word)) return false;
  const parts = word.split('-');
  const joined = parts.join('');
  if (BLOCKED.has(word) || BLOCKED.has(joined) || parts.some((p) => BLOCKED.has(p))) return false;
  if (parts.every((p) => inv.sounds.has(p))) return true;
  return isChain(joined, inv.syllables);
}

/** One token is babble: a chain of the inventory's syllables, or its sounds, and never a blocked real word. */
export function isBabbleToken(token: string, inventory: BabbleInventory): boolean {
  return tokenOk(token, clean(inventory));
}

/** A whole line is babble: at least one token, and every token is babble. Stage directions don't count. */
export function isBabble(text: string, inventory: BabbleInventory): boolean {
  const inv = clean(inventory);
  const tokens = speechTokens(text);
  return tokens.length > 0 && tokens.every((t) => tokenOk(t, inv));
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length]!;
}

function makeToken(inv: CleanInventory, random: () => number): string {
  const sounds = [...inv.sounds];
  if (sounds.length > 0 && random() < 0.25) return pick(sounds, random);
  for (let attempt = 0; attempt < 8; attempt++) {
    const length = 1 + Math.floor(random() * MAX_BABBLE_SYLLABLES);
    const chain: string[] = [];
    while (chain.length < length) {
      const next = pick(inv.syllables, random);
      if (next !== chain[chain.length - 1]) chain.push(next);
      else if (inv.syllables.length === 1) break;
    }
    const token = chain.length > 1 && random() < 0.4 ? chain.join('-') : chain.join('');
    if (tokenOk(token, inv)) return token;
  }
  return inv.syllables.find((s) => tokenOk(s, inv)) ?? DEFAULT_BABBLE_SYLLABLES[0]!;
}

/**
 * A babble line, the same for the same seed on every device and server:
 * two or three tokens, the first capitalised, ending in `!`, `?` or `~`.
 */
export function makeBabble(seed: string, inventory: BabbleInventory): string {
  const inv = clean(inventory);
  const random = createRandom(hash128(`nyc-mon/babble/${seed}`)[0]);
  const count = 2 + Math.floor(random() * 2);
  const tokens = Array.from({ length: count }, () => makeToken(inv, random));
  const line = tokens.map((t, i) => (i < count - 1 && random() < 0.3 ? `${t},` : t)).join(' ');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}${pick(['!', '?', '~', '!'], random)}`;
}

/** What a gate did to a line. `replaced` means the original broke the rule and was swapped. */
export interface GatedLine {
  readonly text: string;
  readonly replaced: boolean;
}

/**
 * `baby-talk`: babble only. A line that is all babble keeps its sounds and
 * punctuation (directions and tags removed, so no English rides along in a
 * direction); anything else is replaced with {@link makeBabble} for `seed`.
 */
export function enforceBabble(text: string, inventory: BabbleInventory, seed: string): GatedLine {
  if (isBabble(text, inventory)) return { text: stripPerformance(text), replaced: false };
  return { text: makeBabble(seed, inventory), replaced: true };
}

export type LimitedSpeechVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: 'empty' | 'callah' | 'too-many-words' | 'sentence' };

/**
 * `limited` (Q32, Mike 2026-10-23 and 2026-10-29): the family sound plus at
 * most two words, never a sentence, and no "Callah" yet. Babble and family
 * sounds are not words; stage directions are performance, not speech.
 */
export function checkLimitedSpeech(text: string, inventory: BabbleInventory): LimitedSpeechVerdict {
  const inv = clean(inventory);
  const tokens = speechTokens(text);
  if (tokens.length === 0) return { ok: false, reason: 'empty' };
  if (CALLAH.test(stripPerformance(text)) || tokens.some((t) => CALLAH.test(t))) return { ok: false, reason: 'callah' };
  const words = tokens.filter((t) => !tokenOk(t, inv));
  if (words.length > LIMITED_SPEECH_MAX_WORDS) return { ok: false, reason: 'too-many-words' };
  if (words.some((w) => w.includes("'") || CLAUSE_WORDS.has(w))) return { ok: false, reason: 'sentence' };
  return { ok: true };
}

/** Keeps a line that passes {@link checkLimitedSpeech}; otherwise the fallback, or babble when the fallback fails too. */
export function enforceLimitedSpeech(text: string, inventory: BabbleInventory, fallback: string): GatedLine {
  if (checkLimitedSpeech(text, inventory).ok) return { text, replaced: false };
  if (checkLimitedSpeech(fallback, inventory).ok) return { text: fallback, replaced: true };
  return { text: makeBabble(fallback || text, inventory), replaced: true };
}

/** Runs a line through the gate for `stage`. `full` passes untouched. */
export function enforceVoiceStage(
  text: string,
  stage: VoiceStage,
  inventory: BabbleInventory,
  options: { readonly seed: string; readonly limitedFallback?: string },
): GatedLine {
  switch (stage) {
    case 'baby-talk':
      return enforceBabble(text, inventory, options.seed);
    case 'limited':
      return enforceLimitedSpeech(text, inventory, options.limitedFallback ?? makeBabble(options.seed, inventory));
    default:
      return { text, replaced: false };
  }
}
