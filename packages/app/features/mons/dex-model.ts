import { allSpecies, bloodlineLabel, bloodlines, eggs, walkChain } from '@acme/content';
import type { BloodlineId, EggRecord, EvolutionNode, LifecycleStage, MonInstance, MonSpeciesDef } from '@acme/core/types';

// Pure model for the MONS screen (Gameplay Bible v12: "species
// encyclopedia/discovery index. It answers 'what is this Mon?' It is not the
// care screen."). Every fact comes from `@acme/content`; a null field there
// is left out, never filled in.

/** The five canon stages in life order (V11 ¶25, roster L16). */
export const DEX_STAGES: readonly LifecycleStage[] = ['Egg', 'Baby', 'Small', 'Mid', 'Max'];

/** Which part of the save decides what the Caller has seen. */
export interface SeenSource {
  readonly eggs: readonly Pick<EggRecord, 'speciesId'>[];
  readonly mons: readonly Pick<MonInstance, 'speciesId'>[];
}

const speciesById = new Map(allSpecies.map((s) => [s.speciesId, s]));
const bloodlineById = new Map(bloodlines.map((b) => [b.bloodlineId, b]));

/** Chain nodes from the Egg down to `speciesId`, or empty when it is not in this chain. */
export function chainPathTo(node: EvolutionNode, speciesId: string): readonly EvolutionNode[] {
  if (node.speciesId === speciesId) return [node];
  for (const child of node.evolvesTo) {
    const rest = chainPathTo(child, speciesId);
    if (rest.length > 0) return [node, ...rest];
  }
  return [];
}

/**
 * The "seen" rule. A form counts as seen when the save shows the Caller met it:
 *
 * 1. M08 eggs. Any save holding an egg or a Mon went through M08, where
 *    Dr. Santoro shows all three starter eggs (Decision #5), so every Egg form
 *    in `eggs` is seen.
 * 2. Each egg record in the save: its Egg form.
 * 3. Each Mon in the save: its current form and every form on its chain from
 *    the Egg down to it. Evolution keeps the same Mon (`monInstanceId`) and
 *    Egg → Baby → Small → Mid is linear, with one Mid above each Max
 *    (Decision #12), so that path is the Mon's evolution history.
 *
 * Never seen: the Baby an unhatched egg will become (Babies are never shown
 * before the hatch, COPY_DECK glossary, P3), sibling Max branches, and any
 * form ahead of a Mon's current stage. Species ids content does not know are
 * ignored.
 */
export function seenSpeciesIds(save: SeenSource | undefined): ReadonlySet<string> {
  const seen = new Set<string>();
  if (save === undefined) return seen;
  if (save.eggs.length > 0 || save.mons.length > 0) for (const egg of eggs) seen.add(egg.speciesId);
  for (const egg of save.eggs) if (speciesById.has(egg.speciesId)) seen.add(egg.speciesId);
  for (const mon of save.mons) {
    const species = speciesById.get(mon.speciesId);
    const bloodline = species === undefined ? undefined : bloodlineById.get(species.bloodlineId);
    if (bloodline === undefined) continue;
    for (const node of chainPathTo(bloodline.chain, mon.speciesId)) seen.add(node.speciesId);
  }
  return seen;
}

/** One Dex record as the index lists it. */
export interface DexEntry {
  readonly speciesId: string;
  readonly dexId: number | null;
  /** Null for a record the roster leaves [OPEN]. */
  readonly formName: string | null;
  readonly stage: LifecycleStage;
  readonly bloodlineId: BloodlineId;
  readonly bloodlineName: string;
  readonly seen: boolean;
}

function toEntry(species: MonSpeciesDef, seen: ReadonlySet<string>): DexEntry {
  return {
    speciesId: species.speciesId,
    dexId: species.dexId,
    formName: species.formName,
    stage: species.stage,
    bloodlineId: species.bloodlineId,
    bloodlineName: species.bloodlineName,
    seen: seen.has(species.speciesId),
  };
}

/** All Bloodlines, or one. */
export type DexFilter = 'all' | BloodlineId;

/** Every record `@acme/content` ships, in Dex number order (No. 001 first), narrowed to one Bloodline when filtered. */
export function dexIndex(seen: ReadonlySet<string>, filter: DexFilter = 'all', species: readonly MonSpeciesDef[] = allSpecies): readonly DexEntry[] {
  return species
    .filter((s) => filter === 'all' || s.bloodlineId === filter)
    .map((s) => toEntry(s, seen))
    .sort((a, b) => (a.dexId ?? Number.MAX_SAFE_INTEGER) - (b.dexId ?? Number.MAX_SAFE_INTEGER));
}

/** One entry by species id, or undefined for an id content does not know. */
export function dexEntry(speciesId: string, seen: ReadonlySet<string>): DexEntry | undefined {
  const species = speciesById.get(speciesId);
  return species === undefined ? undefined : toEntry(species, seen);
}

/** How many forms the Caller has seen out of how many content ships. */
export function seenCount(entries: readonly DexEntry[]): { readonly seen: number; readonly total: number } {
  return { seen: entries.filter((e) => e.seen).length, total: entries.length };
}

/** The Bloodline filter options in content order: the three starter Bloodlines, then F03 to F18. */
export function bloodlineFilters(): readonly { readonly id: BloodlineId; readonly label: string }[] {
  return bloodlines.map((b) => ({ id: b.bloodlineId, label: bloodlineLabel(b) }));
}

/** "002": the Dex number as the site prints it. */
export function dexDigits(dexId: number | null): string {
  return dexId === null ? '???' : String(dexId).padStart(3, '0');
}

/** What an entry shows for its name: the form name once seen, otherwise "???". */
export const UNSEEN = '???';
export function entryName(entry: DexEntry): string {
  return entry.seen && entry.formName !== null ? entry.formName : UNSEEN;
}

/** The index's narrowing: Bloodline, stage and a search over number and seen names. */
export interface DexQuery {
  readonly bloodline: DexFilter;
  readonly stage: 'all' | LifecycleStage;
  readonly text: string;
}

export const ALL_DEX: DexQuery = { bloodline: 'all', stage: 'all', text: '' };

/**
 * Narrows the index. Search matches the Dex number ("2", "002", "No. 2") and
 * the names of seen forms only, so a search never reveals an unseen name.
 * The stage filter matches seen forms only for the same reason.
 */
export function filterDex(entries: readonly DexEntry[], query: DexQuery): readonly DexEntry[] {
  const text = query.text.trim().toLowerCase();
  const digits = text.replace(/^no\.?\s*/, '').replace(/^#/, '');
  const asNumber = /^\d+$/.test(digits) ? Number(digits) : null;
  return entries.filter((e) => {
    if (query.bloodline !== 'all' && e.bloodlineId !== query.bloodline) return false;
    if (query.stage !== 'all' && (!e.seen || e.stage !== query.stage)) return false;
    if (text === '') return true;
    if (asNumber !== null) return e.dexId === asNumber || dexDigits(e.dexId).includes(digits);
    return e.seen && e.formName !== null && e.formName.toLowerCase().includes(text);
  });
}

/** A Bloodline heading or an entry, for the grouped list. */
export type DexListItem =
  | { readonly kind: 'heading'; readonly bloodlineId: BloodlineId; readonly bloodlineName: string }
  | { readonly kind: 'entry'; readonly entry: DexEntry };

/** The entries in Dex order with a Bloodline heading wherever the Bloodline changes. */
export function groupByBloodline(entries: readonly DexEntry[]): readonly DexListItem[] {
  const items: DexListItem[] = [];
  let last: BloodlineId | null = null;
  for (const entry of entries) {
    if (entry.bloodlineId !== last) {
      items.push({ kind: 'heading', bloodlineId: entry.bloodlineId, bloodlineName: entry.bloodlineName });
      last = entry.bloodlineId;
    }
    items.push({ kind: 'entry', entry });
  }
  return items;
}

/** The entry `by` places away in Dex order (an entry's Previous and Next), or undefined past either end. */
export function adjacentEntry(entries: readonly DexEntry[], speciesId: string, by: -1 | 1): DexEntry | undefined {
  const at = entries.findIndex((e) => e.speciesId === speciesId);
  return at < 0 ? undefined : entries[at + by];
}

/** One form on an entry's evolution line. */
export interface EvolutionStep {
  readonly speciesId: string;
  readonly dexId: number | null;
  readonly stage: LifecycleStage;
  /** The form name, or null while unseen ("???"). */
  readonly label: string | null;
  readonly seen: boolean;
  /** The entry being read. */
  readonly current: boolean;
}

/** One stage of the line: one form, or several where the Bloodline branches (each Max). */
export interface EvolutionColumn {
  readonly stage: LifecycleStage;
  readonly steps: readonly EvolutionStep[];
  /** More than one form at this stage: the one before it becomes exactly one of them (Decision #12). */
  readonly branches: boolean;
}

/** What a form needs before a Mon can evolve into it: an item and a mastery trial. */
export interface EvolutionTrigger {
  /** The item, e.g. "Street Cred Crystal". */
  readonly name: string;
  /** The mastery cue, e.g. "Street Cred trial". */
  readonly mastery: string;
  /** A theme token for its swatch, only when canon gives a colour. */
  readonly swatch: string | null;
}

/**
 * The unlock for evolving into `speciesId`, read from the form's
 * `evolutionUnlock` (the inherited v8 item and mastery cue, PR #115). All 37
 * Max forms carry one; no other stage does. Null when content has none. It is
 * a cue for the Dex, not an executable EvolutionEvent: Decision #12 still
 * leaves what decides a branch TODO(canon).
 */
export function evolutionTrigger(speciesId: string): EvolutionTrigger | null {
  const unlock = speciesById.get(speciesId)?.evolutionUnlock;
  if (unlock === null || unlock === undefined) return null;
  return { name: unlock.itemName, mastery: unlock.mastery, swatch: null };
}

/**
 * The entry's Bloodline from content as Egg → Baby → Small → Mid → Max, one
 * column per stage, with every Max branch in its column (Decision #12: a Mid
 * becomes exactly one of them). Unseen forms carry no label. Empty for an id
 * content does not know.
 */
export function evolutionLine(speciesId: string, seen: ReadonlySet<string>): readonly EvolutionColumn[] {
  const species = speciesById.get(speciesId);
  const bloodline = species === undefined ? undefined : bloodlineById.get(species.bloodlineId);
  if (bloodline === undefined) return [];
  const steps = walkChain(bloodline.chain).map((node): EvolutionStep => {
    const isSeen = seen.has(node.speciesId);
    return {
      speciesId: node.speciesId,
      dexId: node.dexId,
      stage: node.stage,
      label: isSeen ? node.formName : null,
      seen: isSeen,
      current: node.speciesId === speciesId,
    };
  });
  return DEX_STAGES
    .map((stage) => {
      const at = steps.filter((s) => s.stage === stage);
      return { stage, steps: at, branches: at.length > 1 };
    })
    .filter((column) => column.steps.length > 0);
}

/** One text fact on an entry. */
export interface EntryFact {
  readonly id: 'lore' | 'size';
  readonly value: string;
}

/**
 * Optional canon facts for a seen entry, only where content has a value, in
 * the order the entry shows them:
 *
 * - lore: the species card's `cultureNote` (Q12, Q13) when set, otherwise
 *   the form's `loreSummary` from the v11.1 roster;
 * - size: `scaleTargetDescription`, the art-direction size target, verbatim.
 *   It is prose, never a height or weight.
 *
 * `districtId` is null on every form and `affinityId` / `classId` have no
 * published label list, so none of those render (see `MISSING_CANON_FIELDS`).
 */
export function entryFacts(speciesId: string): readonly EntryFact[] {
  const species = speciesById.get(speciesId);
  if (species === undefined) return [];
  const facts: EntryFact[] = [];
  const lore = species.cultureNote ?? species.loreSummary ?? null;
  if (lore !== null) facts.push({ id: 'lore', value: lore });
  const size = species.scaleTargetDescription ?? null;
  if (size !== null) facts.push({ id: 'size', value: size });
  return facts;
}

/**
 * The form's type labels from `legacyTypeNames`: the v8 ten-type names the
 * roster kept, not the eight-Affinity combat system (still unauthored, Q33).
 * Empty for every Egg and for any form content gives none.
 */
export function entryTypes(speciesId: string): readonly string[] {
  return speciesById.get(speciesId)?.legacyTypeNames ?? [];
}

/** What the entry would show if canon supplied it, and why it does not yet. For the report and the tests. */
export const MISSING_CANON_FIELDS = [
  { field: 'Affinity', reason: '`affinityId` is null on every record; the eight-Affinity list is not authored (Q33). The entry shows the v8 `legacyTypeNames` instead.' },
  { field: 'temperament / combat Class', reason: '`classId` is null on every record; no Class list is published. No temperament field exists.' },
  { field: 'home district', reason: '`districtId` is null on every form; borough encounter weights are not home districts. `originBlock` is per-Mon and Phase 2.' },
  { field: 'height / weight', reason: '`scaleMeters` (scale against the 1 m disc, Q29) is null. The entry shows `scaleTargetDescription`, an art-direction size target, not a measurement.' },
  { field: 'what decides a Max branch', reason: 'Decision #12 leaves the branch decider TODO(canon); v11 says only that Personality/Bond can influence it. Each Max form shows its `evolutionUnlock` item and mastery cue, which is not an executable EvolutionEvent.' },
  { field: 'species culture note', reason: '`cultureNote` is null on every record (Q12, Q13). The lore line falls back to `loreSummary`.' },
] as const;
