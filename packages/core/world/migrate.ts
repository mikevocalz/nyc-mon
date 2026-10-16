import {
  CURRENT_WORLD_SAVE_VERSION,
  type GeoPosition,
  type WorldSave,
  WorldSaveCurrentSchema,
  WorldSaveEnvelopeSchema,
} from '../schemas/world-save.ts';

// Two migration tables, two different jobs.
//
// 1. Schema migrations (`WORLD_SAVE_MIGRATIONS`): version n → n + 1 of the
//    blob shape, the same walk as `save/migrate.ts`. Empty at v1.
//
// 2. Dataset migrations (`DatasetMigration`): the world data changed under a
//    saved position. A dataset migration is a coordinate migration and
//    nothing else. It maps the canonical position (and only the canonical
//    position) from the old dataset to the new one; the origin change is
//    handled by re-projection in `world/transform.ts`, and the player's
//    revision, session and world instance are untouched. It is never a
//    reset to spawn: if no migration exists for a version pair,
//    `resolveResume` returns an explicit `incompatible-dataset` error and the
//    player chooses what happens next (Master Directive v2 §3).

/** One step in the world save schema migration table: version `from` → `from + 1`. */
export interface WorldSaveMigration {
  readonly from: number;
  readonly migrate: (blob: Record<string, unknown>) => Record<string, unknown>;
}

/** The schema migration table. v1 is the first version, so there is nothing to walk yet. */
export const WORLD_SAVE_MIGRATIONS: readonly WorldSaveMigration[] = [];

/**
 * A coordinate migration between two versions of one dataset. `migratePosition`
 * must be total over the old dataset's extent and must not move a position
 * that the new dataset still contains at the same place; an identity function
 * is the common case (same geometry, new origin or new features).
 */
export interface DatasetMigration {
  readonly datasetId: string;
  readonly fromDatasetVersion: number;
  readonly toDatasetVersion: number;
  readonly migratePosition: (position: GeoPosition) => GeoPosition;
}

export type WorldSaveLoadFailure = 'corrupt' | 'future-version' | 'missing-migration' | 'invalid';

/** A world save blob that cannot be loaded. The lobby shows the reason and a recovery, never spawn. */
export class WorldSaveLoadError extends Error {
  override readonly name = 'WorldSaveLoadError';
  readonly reason: WorldSaveLoadFailure;
  constructor(reason: WorldSaveLoadFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Walks the schema migration chain from the blob's version up to `targetVersion`. Does not validate the result. */
export function migrateWorldSaveBlob(
  blob: unknown,
  targetVersion: number = CURRENT_WORLD_SAVE_VERSION,
  migrations: readonly WorldSaveMigration[] = WORLD_SAVE_MIGRATIONS,
): Record<string, unknown> {
  const envelope = WorldSaveEnvelopeSchema.safeParse(blob);
  if (!envelope.success || !isRecord(blob)) throw new WorldSaveLoadError('corrupt', 'World save has no readable version');
  if (envelope.data.version > targetVersion) {
    throw new WorldSaveLoadError('future-version', `World save v${envelope.data.version} is newer than v${targetVersion}`);
  }
  let current = blob;
  for (let version = envelope.data.version; version < targetVersion; version++) {
    const migration = migrations.find((m) => m.from === version);
    if (migration === undefined) throw new WorldSaveLoadError('missing-migration', `No world save migration from v${version}`);
    current = { ...migration.migrate(current), version: version + 1 };
  }
  return current;
}

/** Parses an already-decoded JSON value into the current world save shape, migrating as needed. */
export function parseWorldSave(json: unknown): WorldSave {
  const parsed = WorldSaveCurrentSchema.safeParse(migrateWorldSaveBlob(json));
  if (!parsed.success) throw new WorldSaveLoadError('invalid', `World save failed validation: ${parsed.error.message}`);
  return parsed.data;
}

/** Parses a raw MMKV string into the current world save shape, migrating as needed. */
export function loadWorldSave(raw: string): WorldSave {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new WorldSaveLoadError('corrupt', 'World save is not valid JSON');
  }
  return parseWorldSave(json);
}
