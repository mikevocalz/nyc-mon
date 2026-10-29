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

/** A pronoun or a contraction (txt-speak included) turns two words into a clause, which `limited` never says. */
const CLAUSE_WORDS = new Set([
  'i', 'me', 'my', 'you', 'your', 'we', 'us', 'our', 'he', 'she', 'it', 'they', 'them', 'this', 'that', 'is', 'am', 'are',
  'u', 'ur', 'im', 'ive', 'ill', 'id', 'ya', 'youre', 'thats', 'its', 'imma',
]);

/** Caller, Callah or "Call-uh", on the letters alone, so hyphens, soft hyphens and spaces inside the word don't hide it. */
const CALLAH_LETTERS = /call(?:er|ah|uh)/;

const DIRECTION = /\*[^*\n]*\*/g;
const AUDIO_TAG = /\[[^\]\n]*\]/g;
const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;
/** What may sit between tokens: spacing and plain punctuation. A symbol TTS reads aloud (&, @, +, $, ™) is not here. */
const RESIDUE_OK = /^[\s,.!?~…'"-]*$/;
/**
 * A direction `limited` keeps: short, letters and spaces only. Every sink
 * (captions, the voice, Web Speech) strips directions up to 60 characters, so
 * a kept one never reaches a caption or the voice as words.
 */
const SHORT_DIRECTION = /^[a-z][a-z ]{0,29}$/i;

/**
 * One form for every check: NFKC (full-width letters become ASCII), format
 * characters removed (zero-width space, soft hyphen, bidi marks), curly
 * apostrophes straightened, control characters turned into spaces.
 */
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\p{Cf}\u00ad]/gu, '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .replace(/[’‘]/g, "'");
}

function stripPerformance(text: string): string {
  return text.replace(DIRECTION, ' ').replace(AUDIO_TAG, ' ').replace(/[*[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The words of a line: stage directions and audio tags dropped, lower case, apostrophes kept. */
export function speechTokens(text: string): string[] {
  const plain = stripPerformance(normalize(text));
  return [...plain.matchAll(TOKEN)].map((m) => m[0].toLowerCase().replace(/['-]+$/, '')).filter((t) => t !== '');
}

/** True when nothing but spacing and plain punctuation sits between the tokens. */
function residueOk(text: string): boolean {
  return RESIDUE_OK.test(stripPerformance(normalize(text)).replace(TOKEN, ''));
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

/**
 * A whole line is babble: at least one token, every token is babble, and
 * nothing between them a voice would read as a word. Stage directions don't count.
 */
export function isBabble(text: string, inventory: BabbleInventory): boolean {
  const inv = clean(inventory);
  const tokens = speechTokens(text);
  return tokens.length > 0 && tokens.every((t) => tokenOk(t, inv)) && residueOk(text);
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

/** Rebuilds a babble line from its tokens alone: commas kept, one closing `!`, `?`, `~` or `.`. */
function rebuildBabble(text: string): string {
  const plain = stripPerformance(normalize(text));
  const parts: string[] = [];
  let ending = '!';
  for (const match of plain.matchAll(TOKEN)) {
    const token = match[0].toLowerCase().replace(/['-]+$/, '');
    const after = plain.slice(match.index + match[0].length).match(/^[^\p{L}\p{N}]*/u)?.[0] ?? '';
    const last = /[!?~.]/.exec(after)?.[0];
    if (last !== undefined) ending = last;
    parts.push(after.includes(',') ? `${token},` : token);
  }
  const line = parts.join(' ').replace(/,$/, '');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}${ending}`;
}

/**
 * `baby-talk`: babble only. A line that is all babble is rebuilt from its
 * sounds (no direction, tag, symbol or invisible character survives); anything
 * else is replaced with {@link makeBabble} for `seed`.
 */
export function enforceBabble(text: string, inventory: BabbleInventory, seed: string): GatedLine {
  if (isBabble(text, inventory)) return { text: rebuildBabble(text), replaced: false };
  return { text: makeBabble(seed, inventory), replaced: true };
}

export type LimitedSpeechVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'empty' | 'callah' | 'unreadable' | 'too-many-words' | 'sentence' };

/**
 * The form a `limited` line is spoken in: normalised, audio tags and brackets
 * removed (the voice adds its own tags), and only short letters-only
 * directions kept. A long direction could slip past the sinks' 60-character
 * strip and be read out, so it is dropped here, where the check can see it.
 */
function limitedForm(text: string): string {
  return normalize(text)
    .replace(AUDIO_TAG, ' ')
    .replace(/[[\]]/g, ' ')
    .replace(DIRECTION, (direction) => {
      const inner = direction.slice(1, -1).trim();
      // Held as \u0001inner\u0002 (control characters are already spaces) while stray asterisks are removed.
      return SHORT_DIRECTION.test(inner) && !CALLAH_LETTERS.test(inner.toLowerCase().replace(/[^a-z]/g, '')) ? ` \u0001${inner}\u0002 ` : ' ';
    })
    .replace(/\*/g, ' ')
    .replace(/\u0001/g, '*')
    .replace(/\u0002/g, '*')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * `limited` (Q32, Mike 2026-10-23 and 2026-10-29): the family sound plus at
 * most two words, never a sentence, and no "Callah" yet. Babble and family
 * sounds are not words; stage directions are performance, not speech.
 */
export function checkLimitedSpeech(text: string, inventory: BabbleInventory): LimitedSpeechVerdict {
  const inv = clean(inventory);
  const form = limitedForm(text);
  const tokens = speechTokens(form);
  if (tokens.length === 0) return { ok: false, reason: 'empty' };
  if (CALLAH_LETTERS.test(form.toLowerCase().replace(/[^a-z]/g, ''))) return { ok: false, reason: 'callah' };
  if (!residueOk(form) || tokens.some((t) => !/^[a-z0-9'-]+$/.test(t))) return { ok: false, reason: 'unreadable' };
  // A hyphen chain that is not babble is as many words as it has parts.
  const words = tokens.flatMap((t) => (tokenOk(t, inv) ? [] : t.split('-').filter((part) => part !== '')));
  if (words.length > LIMITED_SPEECH_MAX_WORDS) return { ok: false, reason: 'too-many-words' };
  if (words.some((w) => w.includes("'") || CLAUSE_WORDS.has(w))) return { ok: false, reason: 'sentence' };
  return { ok: true };
}

/**
 * Keeps a line that passes {@link checkLimitedSpeech}, in its spoken form
 * (tags and long directions dropped); otherwise the fallback, or babble when
 * the fallback fails too.
 */
export function enforceLimitedSpeech(text: string, inventory: BabbleInventory, fallback: string): GatedLine {
  const form = limitedForm(text);
  if (checkLimitedSpeech(form, inventory).ok) return { text: form, replaced: form !== text.trim() };
  const fallbackForm = limitedForm(fallback);
  if (checkLimitedSpeech(fallbackForm, inventory).ok) return { text: fallbackForm, replaced: true };
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
