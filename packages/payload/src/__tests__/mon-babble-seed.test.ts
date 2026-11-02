import { MON_BABBLE_SEED_ROWS, MON_EGG_STAGE_PITCH } from '@acme/content/lingo';
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres';
import { describe, expect, it } from 'vitest';
import { down, MON_BABBLE_SEED_SHA256, monBabbleSeedHash, up } from '../migrations/20261029_120000_mon_babble_seed.ts';

type Doc = Record<string, unknown>;

/** Just the Local API calls the migration makes, over an in-memory table and global. */
function fakePayload(opts: { rows?: Doc[]; egg?: number | null } = {}) {
  const rows: Doc[] = [...(opts.rows ?? [])];
  const global: { stagePitch: Record<string, number | null> } = {
    stagePitch: { egg: opts.egg ?? null, baby: 1.3, small: 1.15, mid: 1, max: 0.9 },
  };
  const keysIn = (where: unknown) => new Set(((where as { key: { in: string[] } }).key.in));
  const payload = {
    find: async ({ where }: { where: unknown }) => ({ docs: rows.filter((row) => keysIn(where).has(String(row.key))) }),
    create: async ({ data }: { data: Doc }) => {
      rows.push({ ...data });
      return data;
    },
    delete: async ({ where }: { where: unknown }) => {
      const keys = keysIn(where);
      for (let i = rows.length - 1; i >= 0; i -= 1) if (keys.has(String(rows[i]!.key))) rows.splice(i, 1);
      return { docs: [] };
    },
    findGlobal: async () => ({ stagePitch: { ...global.stagePitch } }),
    updateGlobal: async ({ data }: { data: { stagePitch: Record<string, number | null> } }) => {
      global.stagePitch = { ...global.stagePitch, ...data.stagePitch };
      return global;
    },
  };
  const args = { payload, req: {} } as unknown as MigrateUpArgs & MigrateDownArgs;
  return { rows, global, args };
}

describe('migration 20261029_120000_mon_babble_seed', () => {
  it('writes the seed it was written for: a changed seed needs a new migration', () => {
    expect(monBabbleSeedHash()).toBe(MON_BABBLE_SEED_SHA256);
  });

  it('seeds babble rows only: unique keys, a source citation, a known subcategory', () => {
    const keys = MON_BABBLE_SEED_ROWS.map((row) => row.key);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    expect(MON_BABBLE_SEED_ROWS.filter((row) => !row.sourceBasis?.trim()).map((row) => row.key)).toEqual([]);
    expect(new Set(MON_BABBLE_SEED_ROWS.map((row) => row.category))).toEqual(new Set(['babble']));
    const subcategories = new Set(['syllable', 'family-sound', 'egg-sound']);
    expect(MON_BABBLE_SEED_ROWS.filter((row) => !subcategories.has(row.subcategory ?? '')).map((row) => row.key)).toEqual([]);
  });

  it('up inserts every row published and sets the empty Egg pitch; a second up changes nothing', async () => {
    const { rows, global, args } = fakePayload();
    await up(args);
    expect(rows.map((row) => row.key).sort()).toEqual(MON_BABBLE_SEED_ROWS.map((row) => row.key).sort());
    expect(rows.every((row) => row._status === 'published')).toBe(true);
    expect(global.stagePitch).toEqual({ egg: MON_EGG_STAGE_PITCH, baby: 1.3, small: 1.15, mid: 1, max: 0.9 });
    await up(args);
    expect(rows).toHaveLength(MON_BABBLE_SEED_ROWS.length);
  });

  it('up keeps an edited row and an Egg pitch an editor set', async () => {
    const first = MON_BABBLE_SEED_ROWS[0]!;
    const { rows, global, args } = fakePayload({ rows: [{ key: first.key, canonicalText: 'edited' }], egg: 1.2 });
    await up(args);
    expect(rows.filter((row) => row.key === first.key)).toEqual([{ key: first.key, canonicalText: 'edited' }]);
    expect(global.stagePitch.egg).toBe(1.2);
  });

  it('down removes only the seeded keys and empties the Egg pitch only while it is the seeded value', async () => {
    const other = { key: 'babble.syllable.editor-added', category: 'babble' };
    const seeded = fakePayload({ rows: [other] });
    await up(seeded.args);
    await down(seeded.args);
    expect(seeded.rows).toEqual([other]);
    expect(seeded.global.stagePitch.egg).toBeNull();
    await down(seeded.args);
    expect(seeded.rows).toEqual([other]);

    const edited = fakePayload({ egg: 1.2 });
    await up(edited.args);
    await down(edited.args);
    expect(edited.global.stagePitch.egg).toBe(1.2);
  });
});
