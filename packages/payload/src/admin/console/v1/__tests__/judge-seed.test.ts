import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { eggs as starterEggs } from '@acme/content/eggs';
import { EGGS_SLUG } from '../../../../collections/Eggs.ts';
import { MON_INSTANCES_SLUG } from '../../../../collections/MonInstances.ts';
import { deriveMonInstanceId } from '../../../../collections/core.ts';
import { judgeSeedGuard, seedJudgeMon } from '../judge-seed.ts';
import { ON_BEHALF_OF_HEADER, SERVICE_KEY_HEADER } from '../service-caller.ts';

type Doc = Record<string, unknown>;
const KEY = 'k'.repeat(48);
const NOW = Date.UTC(2026, 9, 28, 15, 0);
const goodEnv = {
  NVIDIA_JUDGE_SEED: 'yes',
  DATABASE_URL: 'postgres://u:p@db.example.com:5432/nycmon_judge',
  NVIDIA_JUDGE_CALLER_EMAIL: 'judge@example.com',
  V1_MCP_SERVICE_KEY: KEY,
};

describe('judgeSeedGuard', () => {
  it('accepts an explicit flag, a judge or test database, an email and a service key', () => {
    expect(judgeSeedGuard(goodEnv)).toEqual({ ok: true, database: 'nycmon_judge', email: 'judge@example.com' });
    expect(judgeSeedGuard({ ...goodEnv, DATABASE_URL: 'postgresql://u@localhost/nycmon_nvidia_test' })).toMatchObject({ ok: true });
    expect(judgeSeedGuard({ ...goodEnv, DATABASE_URL: 'postgres://u@h/nycmon_judge_oct30?sslmode=require' })).toMatchObject({ ok: true, database: 'nycmon_judge_oct30' });
  });
  it.each([
    [{ NVIDIA_JUDGE_SEED: undefined }, 'NVIDIA_JUDGE_SEED=yes'],
    [{ NVIDIA_JUDGE_SEED: 'true' }, 'NVIDIA_JUDGE_SEED=yes'],
    [{ DATABASE_URL: undefined }, 'DATABASE_URL'],
    [{ DATABASE_URL: 'postgres://u@h/neondb' }, 'judge or test database'],
    [{ DATABASE_URL: 'postgres://u@h/nycmon' }, 'judge or test database'],
    [{ DATABASE_URL: 'postgres://u@h/nycmon_judge_prod;' }, 'judge or test database'],
    [{ DATABASE_URL: 'not a url' }, 'DATABASE_URL'],
    [{ NVIDIA_JUDGE_CALLER_EMAIL: '' }, 'NVIDIA_JUDGE_CALLER_EMAIL'],
    [{ V1_MCP_SERVICE_KEY: 'short' }, 'V1_MCP_SERVICE_KEY'],
  ] as const)('refuses %j', (patch, reason) => {
    const result = judgeSeedGuard({ ...goodEnv, ...patch });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(reason);
  });
});

/** In-memory Payload: users, eggs and mons, `where.<field>.equals` only. */
function fakePayload(opts: { users?: Doc[]; eggs?: Doc[]; mons?: Doc[] } = {}) {
  const tables: Record<string, Doc[]> = { users: opts.users ?? [], [EGGS_SLUG]: opts.eggs ?? [], [MON_INSTANCES_SLUG]: opts.mons ?? [] };
  const find = vi.fn(async (args: { collection: string; where?: Record<string, { equals?: unknown }> }) => ({
    docs: (tables[args.collection] ?? []).filter((d) => Object.entries(args.where ?? {}).every(([k, c]) => d[k] === c.equals)),
  }));
  const create = vi.fn(async (args: { collection: string; data: Doc }) => {
    const doc = { id: `id_${(tables[args.collection] ?? []).length}`, ...args.data };
    (tables[args.collection] ??= []).push(doc);
    return doc;
  });
  const update = vi.fn();
  return { payload: { find, create, update } as unknown as Payload, find, create, update, tables };
}

const judge = { id: 'user_judge', email: 'judge@example.com', birthYear: 1990 };
const hatchOk = (mon: Doc) => vi.fn(async (_request: Request, _eggId: string) => Response.json({ ok: true, data: { mon } }));

describe('seedJudgeMon', () => {
  const deps = (fake: ReturnType<typeof fakePayload>, hatch = hatchOk({ monInstanceId: 'm' })) => ({
    payload: fake.payload, hatch, serviceKey: KEY, now: () => NOW, newEggId: () => 'egg_judge_1',
  });

  it('writes one starter egg whose 15 minutes already elapsed, then hatches it through the real route as the judge', async () => {
    const fake = fakePayload({ users: [judge] });
    const hatch = hatchOk({ monInstanceId: deriveMonInstanceId('egg_judge_1'), stage: 'Baby' });
    const result = await seedJudgeMon(deps(fake, hatch), { email: 'judge@example.com' });

    const starter = starterEggs[0]!;
    expect(fake.create).toHaveBeenCalledTimes(1);
    expect(fake.create.mock.calls[0]![0]).toMatchObject({ collection: EGGS_SLUG, data: {
      eggId: 'egg_judge_1', monInstanceId: deriveMonInstanceId('egg_judge_1'), callerId: 'user_judge',
      speciesId: starter.speciesId, hatchesIntoSpeciesId: starter.hatchesIntoSpeciesId,
      incubationMinutes: 15, createdAtMs: NOW - 15 * 60_000, incubationEndsAt: NOW, hatched: false, nickname: null,
    } });
    expect(hatch).toHaveBeenCalledTimes(1);
    const [request, eggId] = hatch.mock.calls[0]!;
    expect(eggId).toBe('egg_judge_1');
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/v1/eggs/egg_judge_1/hatch');
    expect(request.headers.get(SERVICE_KEY_HEADER)).toBe(KEY);
    expect(request.headers.get(ON_BEHALF_OF_HEADER)).toBe('user_judge');
    expect(result).toEqual({ kind: 'seeded', callerId: 'user_judge', eggId: 'egg_judge_1', monInstanceId: deriveMonInstanceId('egg_judge_1') });
  });

  it('never writes care state, acceptance flags or receipts', async () => {
    const fake = fakePayload({ users: [judge] });
    await seedJudgeMon(deps(fake), { email: 'judge@example.com' });
    const collections = fake.create.mock.calls.map((c) => c[0].collection);
    expect(collections).toEqual([EGGS_SLUG]);
    expect(fake.update).not.toHaveBeenCalled();
    expect(JSON.stringify(fake.create.mock.calls)).not.toMatch(/acceptance|receipt|applied|lastFedAt/);
  });

  it('refuses when the judge account does not exist; it never creates users', async () => {
    const fake = fakePayload();
    await expect(seedJudgeMon(deps(fake), { email: 'judge@example.com' })).resolves.toMatchObject({ kind: 'refused', reason: expect.stringContaining('sign up') });
    expect(fake.create).not.toHaveBeenCalled();
  });

  it('leaves an account that already has a Mon unchanged', async () => {
    const fake = fakePayload({ users: [judge], mons: [{ monInstanceId: 'mon_existing', callerId: 'user_judge' }] });
    await expect(seedJudgeMon(deps(fake), { email: 'judge@example.com' })).resolves.toEqual({ kind: 'already-seeded', callerId: 'user_judge', monInstanceId: 'mon_existing' });
    expect(fake.create).not.toHaveBeenCalled();
  });

  it('refuses an account that already has an egg (one egg per Caller)', async () => {
    const fake = fakePayload({ users: [judge], eggs: [{ eggId: 'egg_old', callerId: 'user_judge', hatched: false }] });
    await expect(seedJudgeMon(deps(fake), { email: 'judge@example.com' })).resolves.toMatchObject({ kind: 'refused', reason: expect.stringContaining('egg') });
    expect(fake.create).not.toHaveBeenCalled();
  });

  it('reports a hatch the real route refused instead of claiming success', async () => {
    const fake = fakePayload({ users: [judge] });
    const refused = vi.fn(async () => Response.json({ ok: false, error: { code: 'ADULT_REQUIRED', message: 'x' } }, { status: 403 }));
    await expect(seedJudgeMon(deps(fake, refused), { email: 'judge@example.com' })).resolves.toEqual({ kind: 'failed', status: 403, eggId: 'egg_judge_1' });
  });
});
