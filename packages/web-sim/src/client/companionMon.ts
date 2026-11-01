import { rosterEntries } from '@acme/content/mons';
import { toolOutcome } from '../shared/toolOutcome.ts';

/** The three care meters, 0..1, as the server last reported them. */
export interface CareMeters { energy: number; fullness: number; social: number }

/** What the companion page shows about the signed-in Caller's Mon, read from MCP tool results only. */
export interface MonCard {
  /** The Caller's name for the Mon, else its form name. */
  name: string;
  formName: string | null;
  dexId: number | null;
  stage: string | null;
  bloodline: string | null;
  care: CareMeters | null;
  needs: string[];
  mood: string | null;
  asleep: boolean;
}

type Result = { readonly isError?: boolean; readonly structuredContent?: unknown; readonly content?: unknown };
interface Sc {
  mon?: { name?: unknown; speciesId?: unknown; stage?: unknown };
  care?: Record<string, unknown>;
  mood?: unknown; needs?: unknown; activity?: unknown;
  applied?: unknown; effect?: unknown; declinedBecause?: unknown;
  eggs?: unknown; incubating?: unknown; alreadyHatched?: unknown;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export function percent(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 100);
}

function meters(care: Record<string, unknown> | undefined): CareMeters | null {
  if (!care) return null;
  const energy = num(care.energy), fullness = num(care.fullness), social = num(care.social);
  return energy === null || fullness === null || social === null ? null : { energy, fullness, social };
}

function sc(result: Result | null | undefined): Sc | null {
  if (!result || result.isError || typeof result.structuredContent !== 'object' || result.structuredContent === null) return null;
  return result.structuredContent as Sc;
}

/** The Mon as one tool result reports it, or null when the result carries no Mon. */
export function monCard(result: Result | null | undefined): MonCard | null {
  const data = sc(result);
  const m = data?.mon;
  if (!data || !m || typeof m !== 'object') return null;
  const speciesId = str(m.speciesId);
  const dexId = speciesId && /^dex-\d+$/.test(speciesId) ? Number(speciesId.slice(4)) : null;
  const row = dexId === null ? undefined : rosterEntries.find((r) => r.dexId === dexId);
  const formName = row?.formName ?? null;
  const asleep = data.care?.activity === 'asleep' || data.activity === 'asleep' || data.mood === 'asleep';
  return {
    name: str(m.name) ?? formName ?? 'Your Mon',
    formName, dexId,
    stage: str(m.stage) ?? row?.stage ?? null,
    bloodline: row ? `${row.bloodlineName} Bloodline` : null,
    care: meters(data.care),
    needs: Array.isArray(data.needs) ? data.needs.filter((n): n is string => typeof n === 'string') : [],
    mood: str(data.mood),
    asleep,
  };
}

/** The newest card, keeping the last meters when a result (check_on_mon, talk_to_mon) carries the Mon without care. */
export function mergeMonCard(previous: MonCard | null, result: Result | null | undefined): MonCard | null {
  const next = monCard(result);
  if (!next) return previous;
  return next.care || !previous ? next : { ...next, care: previous.care };
}

const VERB: Readonly<Record<string, string>> = { feed_mon: 'feed', rest_mon: 'rest', wake_mon: 'wake', play_with_mon: 'play' };
const GERUND: Readonly<Record<string, string>> = {
  feed_mon: 'feeding', rest_mon: 'resting', wake_mon: 'waking', play_with_mon: 'playing',
  get_mon_status: 'the check-in', check_on_mon: 'the check-in', talk_to_mon: 'talking', check_incubation: 'the egg check', hatch_egg: 'hatching',
};
const DECLINED: Readonly<Record<string, string>> = {
  asleep: 'your Mon is asleep', sluggish: 'your Mon ate a lot and needs a break', 'already-asleep': 'your Mon is already asleep',
  'already-awake': 'your Mon is already awake', 'too-tired': 'your Mon is too tired',
};
const MOOD: Readonly<Record<string, string>> = {
  content: 'Your Mon is content.', asleep: 'Your Mon is asleep.', sluggish: 'Your Mon ate a lot and is taking it slow.',
  'needs-fullness': 'Your Mon is hungry.', 'needs-energy': 'Your Mon is tired.', 'needs-social': 'Your Mon wants company.',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A tool result as one plain sentence for the conversation, from the server's
 * answer and never the model's account of it: "Fed. Fullness is up to 81%."
 * The raw JSON stays in the line's collapsed detail.
 */
export function careSentence(name: string, result: Result): string {
  const outcome = toolOutcome(result);
  const doing = GERUND[name];
  if (outcome === 'failed') return `${doing ? cap(doing) : name} failed. Nothing changed. Try again.`;
  if (outcome === 'unverified') return `Couldn’t read the answer to ${doing ?? name}, so it isn’t counted as done.`;
  const data = sc(result) ?? {};
  const care = meters(data.care);
  const pct = (k: keyof CareMeters) => `${percent(care?.[k] ?? 0)}%`;
  if (outcome === 'declined') {
    const why = DECLINED[str(data.declinedBecause) ?? ''] ?? 'your Mon said no';
    return `Didn’t ${VERB[name] ?? name}: ${why}. Nothing changed.`;
  }
  if (outcome === 'applied') {
    // Without the meters the sentence stops at the action: never a made-up number.
    const then = (k: keyof CareMeters, words: string) => (care ? ` ${words} ${pct(k)}.` : '');
    switch (data.effect) {
      case 'eaten': return `Fed.${then('fullness', 'Fullness is up to')}`;
      case 'overfed': return care ? `Fed, but that was a lot. Fullness is at ${pct('fullness')}, so food and play wait a while.` : 'Fed, but that was a lot, so food and play wait a while.';
      case 'fell-asleep': return `Resting now.${then('energy', 'Energy is at')}`;
      case 'woke': return `Awake.${then('energy', 'Energy is at')}`;
      case 'woke-early': return `Awake early.${then('energy', 'Energy is at')}`;
      case 'played': return `Played.${then('social', 'Social is up to')}`;
      default: return `${cap(doing ?? name)} done.`;
    }
  }
  switch (name) {
    case 'get_mon_status':
    case 'check_on_mon':
    case 'talk_to_mon': {
      const head = name === 'talk_to_mon' ? '' : 'Checked in. ';
      if (care) return `${head}Energy ${pct('energy')}, fullness ${pct('fullness')}, social ${pct('social')}.`;
      const mood = MOOD[str(data.mood) ?? ''];
      return mood ? `${head}${mood}` : head.trim() || 'Your Mon heard you.';
    }
    case 'check_incubation': {
      const eggs = Array.isArray(data.eggs) ? (data.eggs as { minutesRemaining?: unknown; readyToHatch?: unknown }[]) : [];
      const egg = eggs[0];
      if (!egg) return 'Checked the egg. No egg is incubating.';
      if (egg.readyToHatch === true) return 'Checked the egg. It’s ready to hatch.';
      const mins = num(egg.minutesRemaining);
      return mins === null ? 'Checked the egg.' : `Checked the egg. It hatches in ${mins} minute${mins === 1 ? '' : 's'}.`;
    }
    case 'hatch_egg':
      return data.alreadyHatched === true ? 'This egg already hatched.' : 'Hatched.';
    default:
      return `${name}: checked.`;
  }
}

/** What Enter or Send sends: the trimmed question, or nothing while blank or a turn is running. */
export function composerSubmit(question: string, busy: boolean): string | null {
  const text = question.trim();
  return busy || !text ? null : text;
}
