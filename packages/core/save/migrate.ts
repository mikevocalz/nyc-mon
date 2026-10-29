import { CURRENT_SAVE_VERSION, SaveCurrentSchema, SaveEnvelopeSchema } from '../schemas/save.ts';
import { MonInstanceSchema } from '../schemas/mon.ts';
import { createInitialClassicCare } from '../sim/classic.ts';
import { journalEntryId } from '../sim/journal.ts';
import type { SaveCurrent } from '../types/index.ts';

/** One step in the save migration table: version `from` → `from + 1`. */
export interface SaveMigration {
  readonly from: number;
  readonly migrate: (blob: Record<string, unknown>) => Record<string, unknown>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** v1 `feed` carried its food at the top level; v2 nests it in `food` (D-15e). Other actions pass through. */
function migrateCareActionV1(action: unknown): unknown {
  if (!isRecord(action) || action['kind'] !== 'feed') return action;
  const { foodClassId, nutrition, ...rest } = action;
  return { ...rest, food: { foodClassId, nutrition } };
}

/**
 * v1 → v2. Lossless: every v1 field is kept as is. Adds the journal, seeded
 * with one `hatched` entry per Mon at its `hatchedAt` (the only hatch time a
 * v1 save holds), adds an empty egg-create queue, and nests feed writes' food.
 * Malformed input passes through untouched so validation reports it.
 */
function migrateV1ToV2(blob: Record<string, unknown>): Record<string, unknown> {
  const mons = Array.isArray(blob['mons']) ? blob['mons'] : [];
  const journal = mons.filter(isRecord).map((mon) => ({
    entryId: journalEntryId(String(mon['monInstanceId']), 'hatched', Number(mon['hatchedAt'])),
    monInstanceId: mon['monInstanceId'],
    at: mon['hatchedAt'],
    kind: 'hatched',
    first: true,
  }));
  const queue = blob['queue'];
  const nextQueue = isRecord(queue)
    ? {
        ...queue,
        entries: Array.isArray(queue['entries'])
          ? queue['entries'].map((w: unknown) => (isRecord(w) ? { ...w, action: migrateCareActionV1(w['action']) } : w))
          : queue['entries'],
        eggCreates: [],
      }
    : queue;
  return { ...blob, queue: nextQueue, journal };
}

/**
 * v2 phase label → v3 phase label (Decision 29). The capture case is not part
 * of hatching, so its two beats become the egg's own: `case-open` → `stir`,
 * `scanner` → `pressure`. Labels absent here carry over unchanged.
 */
const HATCH_PHASE_V2_TO_V3: Readonly<Record<string, string>> = { 'case-open': 'stir', scanner: 'pressure' };

/**
 * v2 → v3. Renames a presenting hatch's legacy phase label and changes
 * nothing else: the same `eggId`, the same Mon (so the same reserved
 * `monInstanceId`), the same `serverConfirmed`. A resumed hatch starts at the
 * beginning of the migrated phase, as it would have at the old one. No Mon is
 * added. Malformed input passes through untouched so validation reports it.
 */
function migrateV2ToV3(blob: Record<string, unknown>): Record<string, unknown> {
  const hatches = blob['hatches'];
  if (!Array.isArray(hatches)) return blob;
  return {
    ...blob,
    hatches: hatches.map((h: unknown) => {
      if (!isRecord(h) || h['kind'] !== 'presenting' || typeof h['phase'] !== 'string') return h;
      const phase = HATCH_PHASE_V2_TO_V3[h['phase']];
      return phase === undefined ? h : { ...h, phase };
    }),
  };
}

/**
 * v3 → v4. Adds the classic care layer (Mike, 2026-10-29): one fresh
 * `ClassicCareState` per Mon, seeded at `savedAt` (a v3 save holds no poop,
 * cold, calls or mistakes, so nothing is lost or invented). Every v3 field is
 * kept as is. A Mon record that does not parse is skipped here and reported
 * by validation.
 */
function migrateV3ToV4(blob: Record<string, unknown>): Record<string, unknown> {
  const mons = Array.isArray(blob['mons']) ? blob['mons'] : [];
  const savedAt = Number(blob['savedAt']);
  const classic = mons.flatMap((raw: unknown) => {
    const mon = MonInstanceSchema.safeParse(raw);
    return mon.success && Number.isFinite(savedAt) ? [createInitialClassicCare(mon.data, savedAt)] : [];
  });
  return { ...blob, classic };
}

/** The migration table: one step per version. CURRENT_SAVE_VERSION is the last step's target. */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [
  { from: 1, migrate: migrateV1ToV2 },
  { from: 2, migrate: migrateV2ToV3 },
  { from: 3, migrate: migrateV3ToV4 },
];

export type SaveLoadFailure = 'corrupt' | 'future-version' | 'missing-migration' | 'invalid';

/** A save blob that cannot be loaded. M22 recovers from the last good snapshot. */
export class SaveLoadError extends Error {
  override readonly name = 'SaveLoadError';
  readonly reason: SaveLoadFailure;
  constructor(reason: SaveLoadFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

/** Walks the migration chain from the blob's version up to `targetVersion`. Does not validate the result. */
export function migrateSaveBlob(
  blob: unknown,
  targetVersion: number = CURRENT_SAVE_VERSION,
  migrations: readonly SaveMigration[] = SAVE_MIGRATIONS,
): Record<string, unknown> {
  const envelope = SaveEnvelopeSchema.safeParse(blob);
  if (!envelope.success || !isRecord(blob)) throw new SaveLoadError('corrupt', 'Save has no readable version');
  if (envelope.data.version > targetVersion) {
    throw new SaveLoadError('future-version', `Save v${envelope.data.version} is newer than v${targetVersion}`);
  }
  let current = blob;
  for (let version = envelope.data.version; version < targetVersion; version++) {
    const migration = migrations.find((m) => m.from === version);
    if (migration === undefined) throw new SaveLoadError('missing-migration', `No migration from v${version}`);
    current = { ...migration.migrate(current), version: version + 1 };
  }
  return current;
}

/** Parses a raw MMKV string into the current save shape, migrating as needed. */
export function loadSave(raw: string): SaveCurrent {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new SaveLoadError('corrupt', 'Save is not valid JSON');
  }
  const parsed = SaveCurrentSchema.safeParse(migrateSaveBlob(json));
  if (!parsed.success) throw new SaveLoadError('invalid', `Save failed validation: ${parsed.error.message}`);
  return parsed.data;
}

export function createEmptySave(deviceId: string, savedAt: number): SaveCurrent {
  return {
    version: CURRENT_SAVE_VERSION,
    savedAt,
    caller: null,
    eggs: [],
    hatches: [],
    mons: [],
    care: [],
    queue: { deviceId, nextSeq: 1, entries: [], eggCreates: [] },
    journal: [],
    classic: [],
  };
}
