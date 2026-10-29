import { eggs as starterEggs } from '@acme/content/eggs';
import { AdoptMonResponseSchema } from '@acme/core/schemas';
import { createInitialCareState, deriveMonGender, deriveMonInstanceId, deriveVoiceLineageId } from '@acme/core/sim';
import type { AdoptMonRequest } from '@acme/core/types';
import type { Payload, PayloadRequest } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { CARE_STATES_SLUG } from '../../../../collections/CareStates.ts';
import { EGGS_SLUG } from '../../../../collections/Eggs.ts';
import { IDEMPOTENCY_RECORDS_SLUG } from '../../../../collections/IdempotencyRecords.ts';
import { MON_INSTANCES_SLUG } from '../../../../collections/MonInstances.ts';
import { adoptRuleViolation, createAdoptMonHandler } from '../adopt.ts';
import { createFixedWindowLimiter } from '../rate-limit.ts';

type Doc = Record<string, unknown>;
type LocalApiCall = (options: Record<string, unknown>) => Promise<unknown>;

const NOW = Date.UTC(2026, 9, 28, 12, 0);
const starter = starterEggs[0]!;
const EGG_ID = 'egg-local-1';
const MON_ID = deriveMonInstanceId(EGG_ID);
const CREATED = NOW - 3 * 86_400_000;
const HATCHED = CREATED + 15 * 60_000;

function body(overrides: { egg?: Partial<AdoptMonRequest['egg']>; mon?: Partial<AdoptMonRequest['mon']>; seq?: number } = {}): AdoptMonRequest {
  const egg = { eggId: EGG_ID, speciesId: starter.speciesId, hatchesIntoSpeciesId: starter.hatchesIntoSpeciesId, incubationMinutes: 15 as const, createdAt: CREATED, ...overrides.egg };
  return {
    egg,
    mon: {
      monInstanceId: MON_ID,
      speciesId: starter.hatchesIntoSpeciesId,
      stage: 'Baby',
      bond: 0.4,
      nickname: 'Pip',
      gender: deriveMonGender(EGG_ID),
      voiceLineageId: deriveVoiceLineageId({ eggId: EGG_ID, speciesId: starter.speciesId }),
      ...overrides.mon,
    },
    care: { ...createInitialCareState(MON_ID, HATCHED + 60_000), energy: 0.7, fullness: 0.9, updatedAt: NOW - 60_000 },
    deviceId: 'device-ipad',
    appliedThroughSeq: overrides.seq ?? 4,
  };
}

/** An in-memory Local API: equality `where`, create, update by id. Collection hooks do not run (db.int.test.ts covers them). */
function fakePayload(opts: { sessionUser?: Doc | null; tables?: Record<string, Doc[]> } = {}) {
  const tables: Record<string, Doc[]> = {
    users: [],
    [EGGS_SLUG]: [],
    [MON_INSTANCES_SLUG]: [],
    [CARE_STATES_SLUG]: [],
    [IDEMPOTENCY_RECORDS_SLUG]: [],
    ...opts.tables,
  };
  let nextId = 1;
  const find = vi.fn<LocalApiCall>(async (args) => {
    const where = (args.where ?? {}) as Record<string, { equals?: unknown }>;
    const rows = tables[String(args.collection)] ?? [];
    return { docs: rows.filter((doc) => Object.entries(where).every(([k, c]) => doc[k] === c.equals)) };
  });
  const create = vi.fn<LocalApiCall>(async (args) => {
    const doc = { id: nextId++, ...(args.data as Doc) };
    (tables[String(args.collection)] ??= []).push(doc);
    return doc;
  });
  const update = vi.fn<LocalApiCall>(async (args) => {
    const rows = tables[String(args.collection)] ?? [];
    const doc = rows.find((d) => d.id === args.id);
    if (doc === undefined) throw new Error('not found');
    Object.assign(doc, args.data as Doc);
    return doc;
  });
  const findByID = vi.fn<LocalApiCall>(async (args) => (tables[String(args.collection)] ?? []).find((d) => d.id === args.id) ?? null);
  const auth = vi.fn(async () => ({ user: opts.sessionUser === undefined ? { id: 'c1', consentStatus: 'not-required' } : opts.sessionUser }));
  const payload = { find, create, update, findByID, auth, db: {}, logger: { warn: vi.fn() } } as unknown as Payload;
  return { payload, tables, create };
}

function handler(fake: ReturnType<typeof fakePayload>, rateLimit: (id: string) => boolean = () => true) {
  return createAdoptMonHandler({
    getPayload: async () => fake.payload,
    now: () => NOW,
    rateLimit,
    makeReq: async (payload) => ({ payload }) as unknown as PayloadRequest,
  });
}

const post = (data: unknown, headers: Record<string, string> = {}) =>
  new Request('https://admin.test/v1/mons/adopt', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(data),
  });

async function ok(response: Response) {
  const json = (await response.json()) as { ok: boolean; data: unknown; error?: unknown };
  expect(json, JSON.stringify(json.error)).toMatchObject({ ok: true });
  expect(response.status).toBe(200);
  return AdoptMonResponseSchema.parse(json.data);
}

async function errorOf(response: Response) {
  const json = (await response.json()) as { ok: boolean; error: { code: string; message: string } };
  expect(json.ok).toBe(false);
  return { status: response.status, ...json.error };
}

describe('POST /v1/mons/adopt', () => {
  it('needs a signed-in Caller', async () => {
    const res = await handler(fakePayload({ sessionUser: null }))(post(body()));
    expect(res.status).toBe(401);
  });

  it('refuses an account still waiting for guardian consent', async () => {
    const res = await handler(fakePayload({ sessionUser: { id: 'c1', consentStatus: 'pending' } }))(post(body()));
    expect((await errorOf(res)).code).toBe('CONSENT_REQUIRED');
  });

  it('mints the egg, the Mon and its care for the signed-in Caller from the device snapshot', async () => {
    const fake = fakePayload();
    const data = await ok(await handler(fake)(post(body())));
    expect(data.adopted).toBe(true);
    expect(data.ackedSeq).toBe(4);
    expect(data.mon).toMatchObject({ monInstanceId: MON_ID, callerId: 'c1', stage: 'Baby', bond: 0.4, nickname: 'Pip', hatchedAt: HATCHED });
    expect(data.care).toMatchObject({ energy: 0.7, fullness: 0.9 });
    expect(fake.tables[EGGS_SLUG]).toMatchObject([{ eggId: EGG_ID, monInstanceId: MON_ID, callerId: 'c1', createdAtMs: CREATED, incubationEndsAt: HATCHED }]);
    expect(fake.tables[MON_INSTANCES_SLUG]).toMatchObject([{ eggId: EGG_ID, callerId: 'c1', gender: deriveMonGender(EGG_ID) }]);
    // The writes the snapshot already holds are recorded as applied, so a replay skips them.
    expect(fake.tables[CARE_STATES_SLUG]).toMatchObject([{ monInstanceId: MON_ID, lastSeqByDevice: { 'device-ipad': 4 } }]);
  });

  it('owns the Mon by the session, never by anything the client sends', async () => {
    const fake = fakePayload({ sessionUser: { id: 'c7', consentStatus: 'not-required' } });
    const data = await ok(await handler(fake)(post({ ...body(), callerId: 'c1' })));
    expect(data.mon.callerId).toBe('c7');
  });

  it('answers the stored Mon unchanged when it already exists for this Caller', async () => {
    const fake = fakePayload();
    await ok(await handler(fake)(post(body())));
    const again = await ok(await handler(fake)(post(body({ mon: { bond: 0.9 }, seq: 9 }))));
    expect(again.adopted).toBe(false);
    expect(again.mon.bond).toBe(0.4);
    expect(again.ackedSeq).toBe(4);
    expect(fake.tables[MON_INSTANCES_SLUG]).toHaveLength(1);
    expect(fake.tables[CARE_STATES_SLUG]).toHaveLength(1);
  });

  it('replays the first response for a repeated Idempotency-Key without writing again', async () => {
    const fake = fakePayload();
    const first = await handler(fake)(post(body(), { 'Idempotency-Key': 'adopt-egg-local-1' }));
    expect(first.status).toBe(200);
    const writes = fake.create.mock.calls.length;
    const second = await handler(fake)(post(body(), { 'Idempotency-Key': 'adopt-egg-local-1' }));
    expect(second.headers.get('Idempotent-Replayed')).toBe('true');
    expect(fake.create.mock.calls.length).toBe(writes);
    expect((await ok(second)).adopted).toBe(true);
  });

  it("refuses a Mon or an egg that belongs to another Caller", async () => {
    const theirMon = fakePayload({ tables: { [MON_INSTANCES_SLUG]: [{ id: 9, eggId: EGG_ID, monInstanceId: MON_ID, callerId: 'c2' }] } });
    expect((await errorOf(await handler(theirMon)(post(body())))).status).toBe(409);
    const theirEgg = fakePayload({ tables: { [EGGS_SLUG]: [{ id: 9, eggId: EGG_ID, monInstanceId: MON_ID, callerId: 'c2' }] } });
    expect((await errorOf(await handler(theirEgg)(post(body())))).status).toBe(409);
    expect(theirEgg.tables[MON_INSTANCES_SLUG]).toHaveLength(0);
  });

  it('builds on the egg row the server already has, and waits for its incubation', async () => {
    const serverEgg = (createdAtMs: number) => ({
      id: 3, eggId: EGG_ID, monInstanceId: MON_ID, speciesId: starter.speciesId, hatchesIntoSpeciesId: starter.hatchesIntoSpeciesId,
      callerId: 'c1', nickname: null, incubationMinutes: 15, createdAtMs, incubationEndsAt: createdAtMs + 15 * 60_000, hatched: false,
    });
    const early = fakePayload({ tables: { [EGGS_SLUG]: [serverEgg(NOW - 60_000)] } });
    expect((await errorOf(await handler(early)(post(body())))).code).toBe('NOT_READY');
    const ready = fakePayload({ tables: { [EGGS_SLUG]: [serverEgg(NOW - 86_400_000)] } });
    const data = await ok(await handler(ready)(post(body())));
    expect(data.mon.hatchedAt).toBe(NOW - 86_400_000 + 15 * 60_000);
    expect(ready.tables[EGGS_SLUG]).toHaveLength(1);
  });

  it('rejects a malformed body', async () => {
    const res = await handler(fakePayload())(post({ egg: { eggId: EGG_ID } }));
    expect((await errorOf(res)).status).toBe(400);
  });

  it('limits each Caller, not everyone', async () => {
    const limit = createFixedWindowLimiter({ limit: 2, windowMs: 60_000, now: () => NOW });
    const fake = fakePayload();
    const h = handler(fake, limit);
    expect((await h(post(body()))).status).toBe(200);
    expect((await h(post(body()))).status).toBe(200);
    expect((await h(post(body()))).status).toBe(429);
    const other = fakePayload({ sessionUser: { id: 'c2', consentStatus: 'not-required' } });
    expect((await handler(other, limit)(post(body()))).status).toBe(200);
  });
});

describe('adopt rules (content and egg-derived ids)', () => {
  const check = (b: AdoptMonRequest) => adoptRuleViolation(b, NOW);

  it('accepts a Baby hatched from a starter egg', () => {
    expect(check(body())).toBeNull();
    expect(check(body({ mon: { gender: null, voiceLineageId: null } }))).toBeNull();
  });

  it('refuses an id the egg does not derive', () => {
    expect(check(body({ mon: { monInstanceId: 'mon_mine' } }))).toMatch(/derived/);
  });

  it('refuses an egg that is not a starter, or a starter paired with the wrong Baby', () => {
    expect(check(body({ egg: { speciesId: 'dex-999' } }))).toMatch(/starter/);
    const other = starterEggs[1]!;
    expect(check(body({ egg: { hatchesIntoSpeciesId: other.hatchesIntoSpeciesId } }))).toMatch(/starter/);
  });

  it('refuses a species at a stage it does not hold, or from another Bloodline', () => {
    expect(check(body({ mon: { stage: 'Max' } }))).toMatch(/not a form/);
    expect(check(body({ mon: { stage: 'Egg', speciesId: starter.speciesId } }))).toMatch(/not a form/);
    expect(check(body({ mon: { speciesId: starterEggs[1]!.hatchesIntoSpeciesId } }))).toMatch(/not a form/);
  });

  it('refuses a gender or voice the egg did not mint', () => {
    const flipped = deriveMonGender(EGG_ID) === 'male' ? 'female' : 'male';
    expect(check(body({ mon: { gender: flipped } }))).toMatch(/gender/);
    expect(check(body({ mon: { voiceLineageId: 'dex-001/female/9' } }))).toMatch(/voice/);
  });

  it('refuses an egg still incubating and care from the future', () => {
    expect(check(body({ egg: { createdAt: NOW } }))).toMatch(/incubating/);
    const future = body();
    expect(check({ ...future, care: { ...future.care, updatedAt: NOW + 3_600_000 } })).toMatch(/future/);
  });
});
