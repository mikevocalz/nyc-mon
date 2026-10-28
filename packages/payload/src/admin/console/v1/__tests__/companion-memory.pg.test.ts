import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COMPANION_MEMORY_DOWN_SQL, COMPANION_MEMORY_UP_SQL } from '../companion-memory-schema.ts';
import { MemoryConflict, PostgresMemoryStore } from '../companion-memory-store.ts';

const connectionString = process.env.NVIDIA_TEST_DATABASE_URL;
// Never point this destructive fixture at the real Neon database, even accidentally.
if (connectionString) {
  const url = new URL(connectionString);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/nycmon_nvidia_test') {
    throw new Error('NVIDIA_TEST_DATABASE_URL must use local disposable nycmon_nvidia_test');
  }
}
describe.skipIf(!connectionString)('companion memory on disposable PostgreSQL (not Neon/live evidence)', () => {
  const pool = new Pool({ connectionString });
  const store = new PostgresMemoryStore({ query: (text, values) => pool.query(text, values) });
  beforeAll(async () => {
    await pool.query('CREATE SCHEMA payload; CREATE TABLE payload.users (id serial PRIMARY KEY); INSERT INTO payload.users (id) VALUES (1), (2);');
    await pool.query(COMPANION_MEMORY_UP_SQL);
  });
  afterAll(async () => {
    await pool.query('DROP SCHEMA IF EXISTS nycmon_companion CASCADE; DROP SCHEMA IF EXISTS payload CASCADE;');
    await pool.end();
  });
  it('persists across store instances, isolates Callers, prevents lost writes and purges on deletion', async () => {
    const first = await store.write('1', { expectedRevision: 0, consent: true, preferences: { interests: ['music'], approvedNote: 'Keep replies brief.' } });
    const resumed = new PostgresMemoryStore({ query: (text, values) => pool.query(text, values) });
    expect((await resumed.read('1')).preferences).toEqual(first.preferences);
    expect((await resumed.read('2')).preferences).toBeNull();
    const results = await Promise.allSettled([
      store.write('1', { expectedRevision: 1, consent: true, preferences: { interests: [], approvedNote: 'A' } }),
      resumed.write('1', { expectedRevision: 1, consent: true, preferences: { interests: [], approvedNote: 'B' } }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    await expect(pool.query(COMPANION_MEMORY_DOWN_SQL)).rejects.toThrow('Refusing to drop nonempty');
    const current = await store.read('1'); const forgotten = await store.forget('1', current.revision);
    expect(forgotten.preferences).toBeNull(); expect(forgotten.consentedAt).toBeNull();
    await expect(resumed.write('1', { expectedRevision: 0, consent: true, preferences: { interests: [], approvedNote: 'stale' } })).rejects.toThrow(MemoryConflict);
    await pool.query('DELETE FROM payload.users WHERE id = $1', [1]);
    expect((await store.read('1')).revision).toBe(0);
  });
});
