import { monLingoFromRows, type MonLingo } from './model.ts';
import { MON_BABBLE_SEED_ROWS, MON_EGG_STAGE_PITCH } from './babble-seed.ts';
import { MON_LINGO_SEED_ROWS, MON_VOICES_SEED } from './seed.ts';

export * from './model.ts';
export * from './rows.ts';
export { MON_LINGO_SEED_ROWS, MON_VOICES_SEED } from './seed.ts';
export { MON_BABBLE_SEED_ROWS, MON_EGG_STAGE_PITCH } from './babble-seed.ts';

/**
 * The Mon's lingo for code that has no server: tests, and a client before its
 * first `GET /v1/mon-lingo` answers. Built from the seed Payload was loaded
 * with, by the same function the server runs on Payload's documents. Payload
 * is the source of truth; this is a typed fallback only.
 */
export const FALLBACK_MON_LINGO: MonLingo = monLingoFromRows([...MON_LINGO_SEED_ROWS, ...MON_BABBLE_SEED_ROWS], {
  ...MON_VOICES_SEED,
  // Migration 20261029_120000_mon_babble_seed sets the same Egg pitch in Payload.
  stagePitch: { ...MON_VOICES_SEED.stagePitch, egg: MON_EGG_STAGE_PITCH },
});

interface CompiledLingo {
  readonly voice: readonly (readonly [RegExp, (whole: string, plural: string) => string])[];
  readonly caption: readonly (readonly [RegExp, string])[];
  readonly directions: readonly (readonly [RegExp, string])[];
}

const compiled = new WeakMap<MonLingo, CompiledLingo>();

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Upper-case lines stay upper-case; otherwise the letters the line and the spoken form share keep the line's own case. */
function keepCase(whole: string, target: string): string {
  if (whole === whole.toUpperCase()) return target.toUpperCase();
  let shared = 0;
  while (shared < whole.length && shared < target.length && whole[shared]!.toLowerCase() === target[shared]!.toLowerCase()) shared += 1;
  return whole.slice(0, shared) + target.slice(shared);
}

function compile(lingo: MonLingo): CompiledLingo {
  const hit = compiled.get(lingo);
  if (hit !== undefined) return hit;
  const voice = lingo.pronunciations.map((entry) => {
    const words = [entry.written, ...entry.variants].sort((a, b) => b.length - a.length).map(escapeRegExp);
    const pattern = new RegExp(`\\b(${words.join('|')})(s?)\\b`, 'gi');
    const replace = (whole: string, plural: string) => keepCase(whole, plural ? (entry.spokenPlural ?? `${entry.spoken}s`) : entry.spoken);
    return [pattern, replace] as const;
  });
  // Captions match each variant as written, in capitals and in lower case only.
  const caption = lingo.pronunciations.flatMap((entry) =>
    entry.variants.flatMap((variant) =>
      (
        [
          [variant, entry.written],
          [variant.toUpperCase(), entry.written.toUpperCase()],
          [variant.toLowerCase(), entry.written.toLowerCase()],
        ] as const
      ).map(([from, to]) => [new RegExp(`\\b${escapeRegExp(from)}(s?)\\b`, 'g'), `${to.replace(/\$/g, '$$$$')}$1`] as const),
    ),
  );
  const directions = lingo.stageDirections.map((entry) => [new RegExp(entry.keywords.map(escapeRegExp).join('|'), 'i'), entry.tag] as const);
  const result = { voice, caption, directions };
  compiled.set(lingo, result);
  return result;
}

/** Applies the lexicon's pronunciations to a line before it goes to the voice. Captions keep the original text. */
export function pronounceWith(text: string, lingo: MonLingo): string {
  return compile(lingo).voice.reduce((line, [pattern, replace]) => line.replace(pattern, (whole: string, _word: string, plural: string) => replace(whole, plural)), text);
}

/** Turns spoken variants back into the screen form ("Callah" → "Caller"). */
export function captionFormsWith(text: string, lingo: MonLingo): string {
  return compile(lingo).caption.reduce((line, [pattern, replacement]) => line.replace(pattern, replacement), text);
}

/** Turns `*stage directions*` into audio tags or removes them, and drops stray asterisks. */
export function stageDirectionsWith(text: string, lingo: MonLingo): string {
  const { directions } = compile(lingo);
  return text
    .replace(/\*([^*\n]{1,60})\*/g, (_, direction: string) => {
      const match = directions.find(([pattern]) => pattern.test(direction));
      return match ? match[1] : '';
    })
    .replace(/\*/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
