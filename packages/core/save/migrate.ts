import { CURRENT_SAVE_VERSION, SaveCurrentSchema, SaveEnvelopeSchema } from '../schemas/save.ts';
import type { SaveCurrent } from '../types/index.ts';

/** One step in the save migration table: version `from` → `from + 1`. */
export interface SaveMigration {
  readonly from: number;
  readonly migrate: (blob: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * The migration table. v1 is the first shipped shape, so the table is empty;
 * the v2 change appends `{ from: 1, migrate }` here and bumps CURRENT_SAVE_VERSION.
 */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [];

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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

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
    queue: { deviceId, nextSeq: 1, entries: [] },
  };
}
