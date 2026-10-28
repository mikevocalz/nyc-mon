/**
 * What the screen shows for a spoken line. Stage directions (*chuckle*) are
 * performed by the voice, so they're dropped. "Callah" is how a Mon SAYS
 * Caller (TTS lexicon, ADR 0008: Caller → "Call-uh"); on screen the word is
 * always spelled Caller. A reply the model wrapped in quote marks loses the
 * one surrounding pair.
 */
export function captionText(text: string): string {
  const cleaned = text
    .replace(/\bCallah(s?)\b/g, 'Caller$1')
    .replace(/\bCALLAH(S?)\b/g, 'CALLER$1')
    .replace(/\bcallah(s?)\b/g, 'caller$1')
    .replace(/\*[^*\n]{1,60}\*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,!?])/g, '$1')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim()
    // One flowing line: a paragraph break in a two-line caption box left an
    // empty second line that the clamp drew as a lone "…".
    .replace(/\s*\n+\s*/g, ' ');
  return dropUnmatchedQuotes(unwrapQuotes(cleaned));
}

const OPENERS = new Set(['"', '“']);
const CLOSERS_OF: Record<string, readonly string[]> = { '"': ['"', '”'], '“': ['”', '"'] };

/**
 * A streamed reply arrives one sentence at a time, so a quoted line shows as
 * `“Say less, Caller.` then `That hit.”`: each end carries half of a pair.
 * Per sentence, a double quote mark at the start with no closer later in that
 * sentence goes, and so does one at the end with no opener earlier in it.
 * Single marks stay: ’Cause and goin’ are words.
 */
export function dropUnmatchedQuotes(text: string): string {
  return text
    .split(/(?<=[.!?…]["”’']?)\s+/u)
    .map((sentence) => {
      let s = sentence;
      const first = s[0] ?? '';
      if (OPENERS.has(first) && !CLOSERS_OF[first]!.some((c) => s.indexOf(c, 1) !== -1)) s = s.slice(1).trimStart();
      const last = s.at(-1) ?? '';
      if ((last === '”' || last === '"') && !/["“]/.test(s.slice(0, -1))) s = s.slice(0, -1).trimEnd();
      return s;
    })
    .filter((s) => s !== '')
    .join(' ');
}

/**
 * One matching pair of quote marks around the whole line ("…", “…”, '…', ‘…’).
 * The model sometimes quotes its own reply; the Mon is not reading a quote.
 */
const WRAPPED = /^(["“'‘])([\s\S]*)(["”'’])$/u;
const PAIRS: Record<string, string> = { '"': '"', '“': '”', "'": "'", '‘': '’' };

/** The line without one matching pair of surrounding quote marks; unmatched marks stay. */
export function unwrapQuotes(text: string): string {
  const t = text.trim();
  const m = WRAPPED.exec(t);
  if (!m || PAIRS[m[1]!] !== m[3]) return t;
  const inner = m[2]!;
  // '"a" and "b"' is two quotes, not one wrapped line: leave it.
  if (inner.includes(m[1]!) || inner.includes(m[3]!)) return t;
  return inner.trim();
}

/**
 * The words sent to the voice: double quote marks are never spoken, so none
 * reach TTS (a reply the model wrapped in quotes, split into sentences, would
 * otherwise send a stray opening or closing mark with each end).
 */
export function spokenText(text: string): string {
  return text.replace(/["“”]/g, '').replace(/[ \t]{2,}/g, ' ').trim();
}
