import { z } from 'zod';
import { CompanionPreferencesSchema, MemoryWriteSchema, MemoryDeleteSchema, MemorySnapshotSchema, type CompanionPreferences, type MemorySnapshot } from '@acme/core/schemas';
export { CompanionPreferencesSchema, MemoryWriteSchema, MemoryDeleteSchema, MemorySnapshotSchema };
export type { CompanionPreferences, MemorySnapshot };
export interface MemoryStore {
  read(callerId: string): Promise<MemorySnapshot>;
  write(callerId: string, body: z.infer<typeof MemoryWriteSchema>): Promise<MemorySnapshot>;
  forget(callerId: string, expectedRevision: number): Promise<MemorySnapshot>;
}
export interface MemorySql {
  query(sql: string, values: unknown[]): Promise<{ rows: unknown[] }>;
}
export class MemoryConflict extends Error {
  override readonly name = 'MemoryConflict';
  constructor() { super('Memory changed in another session. Reload before saving.'); }
}
const empty = (): MemorySnapshot => ({ revision: 0, preferences: null, consentedAt: null, updatedAt: null });
function ownerId(callerId: string): number {
  // Existing Payload users.id is serial, verified in the initial migration.
  if (!/^[1-9][0-9]{0,9}$/.test(callerId)) throw new Error('Invalid authenticated Caller id.');
  const id = Number(callerId);
  if (!Number.isSafeInteger(id) || id > 2147483647) throw new Error('Invalid authenticated Caller id.');
  return id;
}
const columns = 'revision, preferences, consented_at AS "consentedAt", updated_at AS "updatedAt"';

/** Same Payload/Neon database and pool. No browser storage or replacement account system. */
export class PostgresMemoryStore implements MemoryStore {
  constructor(private readonly db: MemorySql) {}
  async read(callerId: string): Promise<MemorySnapshot> {
    const result = await this.db.query(`SELECT ${columns} FROM nycmon_companion.memories WHERE caller_id = $1`, [ownerId(callerId)]);
    return result.rows.length ? MemorySnapshotSchema.parse(result.rows[0]) : empty();
  }
  async write(callerId: string, body: z.infer<typeof MemoryWriteSchema>): Promise<MemorySnapshot> {
    const input = MemoryWriteSchema.parse(body);
    return this.replace(callerId, input.expectedRevision, input.preferences);
  }
  async forget(callerId: string, expectedRevision: number): Promise<MemorySnapshot> {
    const input = MemoryDeleteSchema.parse({ expectedRevision });
    return this.replace(callerId, input.expectedRevision, null);
  }
  private async replace(callerId: string, expectedRevision: number, preferences: CompanionPreferences | null): Promise<MemorySnapshot> {
    const id = ownerId(callerId);
    const json = preferences === null ? null : JSON.stringify(preferences);
    // The first write is INSERT-only; subsequent writes are compare-and-swap UPDATE-only.
    // A forget leaves a content-free revision tombstone, preventing a delayed old write from reviving memory.
    const result = expectedRevision === 0
      ? await this.db.query(`INSERT INTO nycmon_companion.memories (caller_id, revision, preferences, consented_at)
          VALUES ($1, 1, $2::jsonb, CASE WHEN $2::jsonb IS NULL THEN NULL ELSE now() END)
          ON CONFLICT (caller_id) DO NOTHING RETURNING ${columns}`, [id, json])
      : await this.db.query(`UPDATE nycmon_companion.memories SET revision = revision + 1,
          preferences = $2::jsonb, consented_at = CASE WHEN $2::jsonb IS NULL THEN NULL ELSE now() END, updated_at = now()
          WHERE caller_id = $1 AND revision = $3 RETURNING ${columns}`, [id, json, expectedRevision]);
    if (!result.rows.length) throw new MemoryConflict();
    return MemorySnapshotSchema.parse(result.rows[0]);
  }
}
