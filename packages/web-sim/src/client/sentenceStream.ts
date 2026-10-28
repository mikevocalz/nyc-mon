/**
 * Splits the Mon's reply into sentences while it streams in, so the first
 * sentence can go to the voice before the model has finished the rest.
 *
 * A boundary is `.`, `!` or `?` (plus any closing quotes or brackets) followed
 * by whitespace and the start of a new sentence, or a newline. The splitter
 * waits for the first character of the next sentence before it decides, so
 * "Dr. Ratti" and "3 p.m. today" stay whole however the text is chunked.
 * It never splits:
 *  - after a known abbreviation (Mr., Dr., St., e.g., p.m.) or an initial (J.),
 *  - inside a decimal (2.5: no whitespace after the dot),
 *  - before a lowercase word or a digit,
 *  - after an ellipsis (… or ...): the Mon trails off mid-thought,
 *  - inside a *stage direction*.
 * A stage direction stays with the sentence after it, since it is how that
 * sentence is delivered. A fragment shorter than MIN_CHARS ("Oh!") joins the
 * next sentence: a one-word clip sounds clipped.
 */

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'sr', 'vs', 'e.g', 'i.e', 'a.m', 'p.m', 'approx', 'no', 'mt', 'ave']);
const CLOSERS = new Set(['"', "'", '”', '’', ')', ']']);
const MIN_CHARS = 6;

export interface SentenceSplitter {
  /** Add streamed text; returns any sentences now complete. */
  push(delta: string): string[];
  /** End of the reply: returns whatever is left. */
  flush(): string[];
}

/** Words without their stage directions, for the length check. */
function spokenLength(s: string): number {
  return s.replace(/\*[^*]*\*/g, '').trim().length;
}

/** True when the terminator at `dot` closes an abbreviation or an initial rather than a sentence. */
function endsAbbreviation(text: string, dot: number): boolean {
  if (text[dot] !== '.') return false;
  const word = /([A-Za-z.]+)$/.exec(text.slice(0, dot))?.[1] ?? '';
  if (word === '') return false;
  if (ABBREVIATIONS.has(word.toLowerCase())) return true;
  return /^[A-Z]$/.test(word);
}

/**
 * The index just past the next sentence boundary in `text`, or -1 when none is
 * certain yet (the next sentence hasn't started, or the text ends mid-thought).
 */
function nextBoundary(text: string): number {
  let inDirection = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '*') {
      inDirection = !inDirection;
      continue;
    }
    if (ch === '\n') return i + 1;
    if (inDirection || (ch !== '.' && ch !== '!' && ch !== '?')) continue;
    // Take the whole terminator run (?!, ...) and any closing quotes.
    const start = i;
    let end = i + 1;
    while (end < text.length && (text[end] === '.' || text[end] === '!' || text[end] === '?')) end++;
    const run = text.slice(start, end);
    while (end < text.length && CLOSERS.has(text[end]!)) end++;
    i = end - 1;
    if (run.includes('..')) continue; // an ellipsis
    let next = end;
    while (next < text.length && (text[next] === ' ' || text[next] === '\t')) next++;
    if (next === end) {
      if (end === text.length) return -1; // can't tell yet: "2." may become "2.5"
      continue; // no space: a decimal, a URL, "e.g"
    }
    if (next === text.length) return -1; // the next sentence hasn't started
    const lead = text[next]!;
    if (lead === '\n') return next + 1;
    if (/[a-z0-9,;:]/.test(lead)) continue;
    if (run === '.' && endsAbbreviation(text, start)) continue;
    return end;
  }
  return -1;
}

export function createSentenceSplitter(): SentenceSplitter {
  let buffer = '';
  let carry = '';

  const take = (raw: string, out: string[]) => {
    const piece = (carry ? `${carry} ${raw.trim()}` : raw.trim()).trim();
    if (piece === '') return;
    // A bare stage direction or a tiny fragment waits for the sentence it belongs to.
    if (spokenLength(piece) < MIN_CHARS) {
      carry = piece;
      return;
    }
    carry = '';
    out.push(piece);
  };

  return {
    push(delta) {
      buffer += delta;
      const out: string[] = [];
      for (let cut = nextBoundary(buffer); cut !== -1; cut = nextBoundary(buffer)) {
        take(buffer.slice(0, cut), out);
        buffer = buffer.slice(cut);
      }
      return out;
    },
    flush() {
      const out: string[] = [];
      const tail = (carry ? `${carry} ${buffer.trim()}` : buffer.trim()).trim();
      buffer = '';
      carry = '';
      if (tail) out.push(tail);
      return out;
    },
  };
}

/** The whole-text form, for tests and for a reply that arrives in one piece. */
export function splitSentences(text: string): string[] {
  const s = createSentenceSplitter();
  return [...s.push(text), ...s.flush()];
}
