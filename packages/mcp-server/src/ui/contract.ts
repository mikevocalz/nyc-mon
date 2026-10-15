import { companionCopy } from '@acme/app/features/companion/copy.ts';
import { askRoute, homeStatus } from '@acme/app/features/companion/home-model.ts';
import { allSpecies, bloodlineLabel, bloodlines } from '@acme/content';
import type { CareState, JournalEntry } from '@acme/core/types';

/**
 * The data adapter between a tool result and the existing companion
 * components. It reads `structuredContent` in either shape (lane A's
 * MonView / CareView, or the core MonInstance / CareState) and hands the
 * screens what they already take: a CareState for the rings and
 * `homeStatus`, the Mon's names, and JournalEntry rows.
 *
 * The MCP server imports this file (through index.ts), so it stays free of
 * asset imports: the Baby still is looked up in the view bundle
 * (view/MonView.tsx, `artFor` from mon-identity), never here. The names
 * follow `monIdentity` (packages/app/features/companion/mon-identity.ts).
 * No copy is written here: every string comes from
 * packages/app/features/companion/copy.ts.
 */

export type ActionId = 'feed' | 'rest' | 'wake' | 'play';

/** The text half of `MonIdentity`: everything but the art. */
export interface MonNames {
  readonly name: string;
  readonly formName: string | null;
  readonly dexId: number | null;
  readonly bloodlineName: string | null;
  /** "Hood Ratti Bloodline" (Decision #11), or null when content has none. */
  readonly bloodlineLabel: string | null;
}

export interface MonViewModel {
  readonly monInstanceId: string;
  readonly identity: MonNames;
  readonly name: string;
  /** Null when the result carries no meters (the rings are not drawn). */
  readonly care: CareState | null;
  readonly status: { readonly text: string; readonly tone: 'neutral' | 'request' } | null;
  readonly asleep: boolean;
  /** The action that answers the Mon's ask (M13 `askRoute`), or null when nothing is asked. */
  readonly suggested: ActionId | null;
  readonly journal: readonly JournalEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unit(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

/** CareView (`activity: 'asleep'`, `sluggish`, `wantsFood`) or CareState, as a CareState. */
function readCare(value: unknown, monInstanceId: string): CareState | null {
  if (!isRecord(value)) return null;
  const energy = unit(value.energy);
  const fullness = unit(value.fullness);
  const social = unit(value.social);
  if (energy === null || fullness === null || social === null) return null;
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  const updatedAt = num(value.updatedAt) ?? 1;
  const asleep = value.activity === 'asleep' || (isRecord(value.activity) && value.activity.kind === 'asleep');
  const since = isRecord(value.activity) && typeof value.activity.since === 'number' ? value.activity.since : 0;
  return {
    monInstanceId,
    energy,
    fullness,
    social,
    updatedAt,
    lastFedAt: num(value.lastFedAt),
    lastRestedAt: num(value.lastRestedAt),
    lastSocialAt: num(value.lastSocialAt),
    activity: asleep ? { kind: 'asleep', since } : { kind: 'awake' },
    sluggishUntil: value.sluggish === true ? updatedAt + 1 : num(value.sluggishUntil),
    pendingRequest: value.wantsFood === true || isRecord(value.pendingRequest) ? { need: 'fullness', since: 0 } : null,
  };
}

/** A result with `mood` and no meters: the M13 status string for that mood. */
function statusFromMood(mood: unknown): MonViewModel['status'] {
  switch (mood) {
    case 'content': return { text: companionCopy('m13.status.content'), tone: 'neutral' };
    case 'asleep': return { text: companionCopy('m13.status.asleep'), tone: 'neutral' };
    case 'sluggish': return { text: companionCopy('m13.status.sluggish'), tone: 'neutral' };
    case 'needs-fullness': return { text: companionCopy('m13.status.food'), tone: 'request' };
    case 'needs-energy': return { text: companionCopy('m13.status.energy'), tone: 'request' };
    case 'needs-social': return { text: companionCopy('m13.status.social'), tone: 'request' };
    default: return null;
  }
}

const speciesById = new Map(allSpecies.map((s) => [s.speciesId, s]));
const bloodlineById = new Map(bloodlines.map((b) => [b.bloodlineId, b]));

/** `monIdentity` without the art: nickname, else form name, else Bloodline label. */
function monNames(speciesId: string, nickname: string | null): MonNames {
  const species = speciesById.get(speciesId);
  const bloodline = species === undefined ? undefined : bloodlineById.get(species.bloodlineId);
  const label = bloodline === undefined ? null : bloodlineLabel(bloodline);
  const formName = species?.formName ?? null;
  return {
    name: nickname ?? formName ?? label ?? '',
    formName,
    dexId: species?.dexId ?? null,
    bloodlineName: bloodline?.bloodlineName ?? null,
    bloodlineLabel: label,
  };
}

/** M13's ask, as the card's action ids: Feed, Rest (Wake while asleep), Play. */
function suggestedAction(care: CareState | null, mood: unknown): ActionId | null {
  if (care) {
    switch (askRoute(care)) {
      case '/(home)/feed': return 'feed';
      case '/(home)/rest': return care.activity.kind === 'asleep' ? 'wake' : 'rest';
      case '/(home)/social': return 'play';
      default: return null;
    }
  }
  if (mood === 'needs-fullness') return 'feed';
  if (mood === 'needs-energy') return 'rest';
  if (mood === 'needs-social') return 'play';
  return null;
}

const JOURNAL_KINDS = new Set(['hatched', 'named', 'fed', 'rested', 'played', 'woke-rested']);

/**
 * Journal rows of the six canon kinds (core JOURNAL_ENTRY_KINDS). Any other
 * shape, such as `{ at, kind: 'play', text }`, is skipped rather than shown
 * with invented copy, and never throws.
 */
function readJournal(value: unknown, monInstanceId: string): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is Record<string, unknown> => isRecord(e) && typeof e.at === 'number' && Number.isFinite(e.at) && JOURNAL_KINDS.has(String(e.kind)))
    .map((e, i) => ({
      entryId: typeof e.entryId === 'string' ? e.entryId : `entry-${i}`,
      monInstanceId,
      at: e.at as number,
      kind: e.kind as JournalEntry['kind'],
      first: e.first === true,
    }));
}

/** Builds the view model, or null when the payload has no Mon. */
export function toMonViewModel(structured: unknown): MonViewModel | null {
  if (!isRecord(structured)) return null;
  const mon = structured.mon;
  if (!isRecord(mon)) return null;
  const monInstanceId = typeof mon.monId === 'string' ? mon.monId : mon.monInstanceId;
  if (typeof monInstanceId !== 'string' || typeof mon.speciesId !== 'string') return null;
  const given = typeof mon.name === 'string' ? mon.name : mon.nickname;
  const nickname = typeof given === 'string' && given.trim() !== '' ? given : null;
  const identity = monNames(mon.speciesId, nickname);
  const care = readCare(structured.care, monInstanceId);
  const status = care ? homeStatus(care) : statusFromMood(structured.mood);
  return {
    monInstanceId,
    identity,
    name: identity.name,
    care,
    status: status ? { text: status.text, tone: status.tone } : null,
    asleep: care ? care.activity.kind === 'asleep' : structured.mood === 'asleep',
    suggested: suggestedAction(care, structured.mood),
    journal: readJournal(structured.journal, monInstanceId),
  };
}

/** `m13.mon.a11y`: "{name}, {bloodline}. {status}." The same sentence the Home screen gives the Mon. */
export function spokenSummary(vm: MonViewModel): string {
  return companionCopy('m13.mon.a11y', {
    name: vm.name,
    bloodline: vm.identity.bloodlineLabel ?? '',
    status: vm.status?.text ?? '',
  });
}

/**
 * What the live region says after a care tool returns, from the M14–M16
 * strings. Reads lane A's CareResult (`applied`, `effect`, `declinedBecause`).
 * Null when the result has nothing to announce.
 */
export function careOutcomeText(structured: unknown, vm: MonViewModel): string | null {
  if (!isRecord(structured)) return null;
  const name = vm.name;
  const percent = vm.care ? Math.round(vm.care.fullness * 100) : 0;
  if (structured.applied === false) {
    switch (structured.declinedBecause) {
      case 'asleep': return companionCopy('m14.declined.asleep', { name });
      case 'sluggish': return companionCopy('m14.declined.sluggish', { name });
      case 'already-asleep': return companionCopy('m15.declined.already', { name });
      case 'already-awake': return companionCopy('m15.woke.early.a11y', { name });
      case 'too-tired': return companionCopy('m16.intro.tired', { name });
      default: return null;
    }
  }
  switch (structured.effect) {
    case 'eaten': return companionCopy('m14.eaten.a11y', { name, percent });
    case 'overfed': return companionCopy('m14.overfed.a11y', { name });
    case 'fell-asleep': return companionCopy('m15.settling');
    case 'woke': return companionCopy('m15.woke.rested.a11y', { name });
    case 'woke-early': return companionCopy('m15.woke.early.a11y', { name });
    case 'played': return companionCopy('m16.result.body', { name });
    default: return null;
  }
}
