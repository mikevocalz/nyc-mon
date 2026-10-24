/**
 * Character-timed visemes: the mouth from ElevenLabs' per-character
 * alignment, used when no Audio2Face frames came back with the clip.
 *
 * The set is small on purpose. A Mon's mouth has five shapes worth telling
 * apart (closed lips, open, wide, round, lip-on-teeth) plus a loose middle
 * for every other consonant; more classes would not read on a rat's snout.
 */

/** One mouth shape class. `rest` is a pause; `closed` is m/b/p, where the lips must meet. */
export type Viseme = 'rest' | 'closed' | 'open' | 'wide' | 'round' | 'teeth' | 'mid';

/** One viseme held from `startMs` to `endMs`, measured from the start of the clip. */
export interface VisemeKey {
  readonly v: Viseme;
  readonly startMs: number;
  readonly endMs: number;
}

/** ElevenLabs' `alignment` object, as `/with-timestamps` returns it (seconds). */
export interface CharacterAlignment {
  readonly characters: readonly string[];
  readonly character_start_times_seconds: readonly number[];
  readonly character_end_times_seconds: readonly number[];
}

/** How far the mouth opens and in which direction, each 0..1. */
export interface MouthShape {
  readonly open: number;
  readonly wide: number;
  readonly round: number;
  /** Upper lip lifted off the teeth (f, v). */
  readonly upper: number;
}

export const VISEME_SHAPES: Readonly<Record<Viseme, MouthShape>> = {
  rest: { open: 0, wide: 0, round: 0, upper: 0 },
  closed: { open: 0, wide: 0.05, round: 0, upper: 0 },
  open: { open: 0.85, wide: 0.25, round: 0, upper: 0.1 },
  wide: { open: 0.4, wide: 0.75, round: 0, upper: 0.15 },
  round: { open: 0.45, wide: 0, round: 0.85, upper: 0 },
  teeth: { open: 0.12, wide: 0.2, round: 0, upper: 0.6 },
  mid: { open: 0.3, wide: 0.25, round: 0.1, upper: 0.05 },
};

const PAUSE = /[.,!?;:…—–]/;

/** Strips accents so "é" reads as "e". */
function base(ch: string): string {
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * The viseme for one character, or null for a character that makes no sound
 * of its own (space, apostrophe, quote): the mouth holds what it was doing.
 * `next` resolves the digraphs that change the lips: "sh" and "ch" round them.
 */
export function charViseme(ch: string, next = ''): Viseme | null {
  const c = base(ch);
  if (c === '') return null;
  if (PAUSE.test(c)) return 'rest';
  if (/[mbp]/.test(c)) return 'closed';
  if (/[fv]/.test(c)) return 'teeth';
  if (c === 'a') return 'open';
  if (/[eiy]/.test(c)) return 'wide';
  if (/[ouwq]/.test(c)) return 'round';
  if ((c === 's' || c === 'c') && base(next) === 'h') return 'round';
  if (/[a-z0-9]/.test(c)) return 'mid';
  return null;
}

/** A pause between words shorter than this is not a rest: fluent speech runs words together. */
const WORD_GAP_REST_MS = 120;
/** Audio tags whose span is a sound the mouth makes. */
const VOICED_TAG = /laugh|chuckl|giggl/i;

/**
 * Turns an alignment into viseme keys, merged where neighbours share a
 * shape. Bracketed audio tags (`[happily]`, `[sighs]`) are not read out, so
 * their characters drop, except a laugh, which opens the mouth for its span.
 * Gaps between words longer than {@link WORD_GAP_REST_MS} become a rest.
 */
export function buildVisemeTimeline(alignment: CharacterAlignment): VisemeKey[] {
  const { characters: chars, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
  const n = Math.min(chars.length, starts.length, ends.length);
  const keys: VisemeKey[] = [];
  const push = (v: Viseme, startMs: number, endMs: number) => {
    if (!(endMs > startMs)) return;
    const last = keys[keys.length - 1];
    if (last && startMs - last.endMs > WORD_GAP_REST_MS && v !== 'rest' && last.v !== 'rest') {
      keys.push({ v: 'rest', startMs: last.endMs, endMs: startMs });
    }
    const prev = keys[keys.length - 1];
    if (prev && prev.v === v) {
      keys[keys.length - 1] = { v, startMs: prev.startMs, endMs: Math.max(prev.endMs, endMs) };
    } else {
      keys.push({ v, startMs: Math.max(startMs, prev?.endMs ?? startMs), endMs });
    }
  };
  for (let i = 0; i < n; i++) {
    const ch = chars[i] ?? '';
    const startMs = (starts[i] ?? 0) * 1000;
    if (ch === '[') {
      const close = chars.indexOf(']', i);
      if (close < 0) break;
      const tag = chars.slice(i + 1, close).join('');
      if (VOICED_TAG.test(tag)) push('open', startMs, (ends[close] ?? 0) * 1000);
      i = close;
      continue;
    }
    const v = charViseme(ch, chars[i + 1] ?? '');
    if (v !== null) push(v, startMs, (ends[i] ?? 0) * 1000);
  }
  return keys;
}

/** Blend half-width at a boundary, by the shape being entered: lips seal fast, rounding is anticipated. */
const BLEND_MS: Readonly<Record<Viseme, number>> = { closed: 30, round: 100, rest: 80, open: 60, wide: 60, teeth: 45, mid: 60 };

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

const mix = (a: MouthShape, b: MouthShape, t: number): MouthShape => ({
  open: a.open + (b.open - a.open) * t,
  wide: a.wide + (b.wide - a.wide) * t,
  round: a.round + (b.round - a.round) * t,
  upper: a.upper + (b.upper - a.upper) * t,
});

/** A stable 0..1 hash of a key's index, for per-syllable variation that does not flicker. */
function hash01(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export interface SampleVisemeOptions {
  /** Scales every opening; prefers-reduced-motion passes about 0.6. Default 1. */
  readonly amplitude?: number;
  /** Per-key variation in how wide each syllable opens. Default true. */
  readonly vary?: boolean;
}

/**
 * The mouth at `tMs` with coarticulation: near each boundary the outgoing and
 * incoming shapes cross-fade over a window set by the incoming shape
 * ({@link BLEND_MS}, capped at half of either key), so a word is one motion
 * rather than a row of poses. Before the first key and after the last the
 * mouth is at rest.
 */
export function sampleVisemes(keys: readonly VisemeKey[], tMs: number, options: SampleVisemeOptions = {}): MouthShape {
  const gain = options.amplitude ?? 1;
  const vary = options.vary ?? true;
  const shapeAt = (i: number): MouthShape => {
    const key = keys[i];
    if (!key) return VISEME_SHAPES.rest;
    const s = VISEME_SHAPES[key.v];
    const k = gain * (vary && key.v !== 'closed' && key.v !== 'rest' ? 0.88 + 0.24 * hash01(i) : 1);
    return { open: s.open * k, wide: s.wide * k, round: s.round * k, upper: s.upper * k };
  };
  if (keys.length === 0) return VISEME_SHAPES.rest;
  // Binary search for the last key starting at or before t.
  let lo = 0;
  let hi = keys.length - 1;
  let i = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((keys[mid] as VisemeKey).startMs <= tMs) {
      i = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const dur = (k: VisemeKey | undefined) => (k ? k.endMs - k.startMs : Infinity);
  const blendAt = (boundary: number, from: number, to: number, incoming: Viseme): MouthShape | null => {
    const half = Math.min(BLEND_MS[incoming], dur(keys[from]) / 2, dur(keys[to]) / 2);
    if (!(half > 0) || Math.abs(tMs - boundary) >= half) return null;
    return mix(shapeAt(from), shapeAt(to), smoothstep((tMs - (boundary - half)) / (2 * half)));
  };
  if (i < 0) {
    const first = keys[0] as VisemeKey;
    return blendAt(first.startMs, -1, 0, first.v) ?? VISEME_SHAPES.rest;
  }
  const cur = keys[i] as VisemeKey;
  const next = keys[i + 1];
  if (tMs >= cur.endMs) {
    // A short gap between words carries the mouth straight into the next
    // word; a long one (or the end of the clip) relaxes it to rest.
    if (next && next.startMs - cur.endMs < WORD_GAP_REST_MS) {
      return mix(shapeAt(i), shapeAt(i + 1), smoothstep((tMs - cur.endMs) / Math.max(1, next.startMs - cur.endMs)));
    }
    return blendAt(cur.endMs, i, -1, 'rest') ?? VISEME_SHAPES.rest;
  }
  if (next && next.startMs <= cur.endMs) {
    const out = blendAt(next.startMs, i, i + 1, next.v);
    if (out) return out;
  } else if (!next || next.startMs - cur.endMs >= WORD_GAP_REST_MS) {
    const out = blendAt(cur.endMs, i, -1, 'rest');
    if (out) return out;
  }
  const prev = keys[i - 1];
  const gapBefore = prev === undefined ? Infinity : cur.startMs - prev.endMs;
  // A short gap before this key already carried the mouth here (above).
  if (gapBefore > 0 && gapBefore < WORD_GAP_REST_MS) return shapeAt(i);
  return blendAt(cur.startMs, gapBefore <= 0 ? i - 1 : -1, i, cur.v) ?? shapeAt(i);
}
