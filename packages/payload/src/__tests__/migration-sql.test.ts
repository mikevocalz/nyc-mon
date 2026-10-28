import { describe, expect, it } from 'vitest';
import { migrations } from '../migrations/index.ts';

type Chunk = { value?: unknown; queryChunks?: Chunk[] };

/** Flattens a drizzle `sql` template (no bound params in generated migrations) back to text. */
function sqlText(query: Chunk): string {
  if (Array.isArray(query.queryChunks)) return query.queryChunks.map(sqlText).join('');
  if (Array.isArray(query.value)) return query.value.join('');
  if (typeof query.value === 'string') return query.value;
  throw new Error(`Unexpected SQL chunk: ${JSON.stringify(query)}`);
}

async function capture(run: (args: never) => Promise<void>): Promise<string> {
  const statements: string[] = [];
  const db = { execute: async (query: Chunk) => { statements.push(sqlText(query)); } };
  // Data migrations (the lingo seed) write through the Local API, not SQL;
  // their calls resolve as no-ops so only raw SQL is inspected.
  const payload = new Proxy({}, { get: () => async () => ({ docs: [], totalDocs: 0 }) });
  await run({ db, payload, req: {} } as never);
  return statements.join('\n');
}

/** Splits a migration body into individual statements, dropping comments and blanks. */
function statementsOf(body: string): string[] {
  return body
    .split(';')
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean);
}

describe('Payload migration SQL on a fresh database', () => {
  it('creates the "payload" schema before the first migration references it', async () => {
    const first = migrations[0];
    expect(first?.name).toBe('20261004_213700');
    const statements = statementsOf(await capture(first!.up));
    const firstUse = statements.findIndex((s) => /"payload"\./.test(s));
    const create = statements.findIndex((s) => /^CREATE SCHEMA IF NOT EXISTS "?payload"?$/i.test(s));
    expect(create, 'CREATE SCHEMA IF NOT EXISTS "payload" missing from the first up()').toBeGreaterThanOrEqual(0);
    expect(create).toBeLessThan(firstUse);
  });

  it('companion memory up() creates its own schema before using it', async () => {
    const companion = migrations.find((m) => m.name === '20261024_164500_companion_memory');
    const statements = statementsOf(await capture(companion!.up));
    const firstUse = statements.findIndex((s) => /nycmon_companion\./.test(s));
    const create = statements.findIndex((s) => /^CREATE SCHEMA IF NOT EXISTS "?nycmon_companion"?$/i.test(s));
    expect(create).toBeGreaterThanOrEqual(0);
    expect(create).toBeLessThan(firstUse);
  });

  for (const migration of migrations) {
    it(`${migration.name} down() never drops a constraint that an earlier CASCADE already removed`, async () => {
      const statements = statementsOf(await capture(migration.down));
      const firstCascade = statements.findIndex((s) => /^DROP TABLE .* CASCADE$/i.test(s));
      if (firstCascade < 0) return;
      const unsafe = statements
        .slice(firstCascade + 1)
        .filter((s) => /DROP CONSTRAINT (?!IF EXISTS)/i.test(s));
      expect(unsafe).toEqual([]);
    });
  }
});
