// The M21 claim-then-replay path against a real Postgres: collection hooks,
// unique indexes, transactions and idempotency records all run. Opt-in like
// the X1 suite: set X1_DATABASE_URL to an empty, disposable database; the
// schema is pushed on init. Only `payload.auth` is replaced (no Better Auth
// session exists in a test), so the routes act for the user the test creates.
import { eggs as starterEggs } from '@acme/content/eggs';
import { AdoptMonResponseSchema, PutCareResponseSchema } from '@acme/core/schemas';
import { applyCareWrites, createInitialCareState, deriveMonGender, deriveMonInstanceId, deriveVoiceLineageId, mintMonInstance } from '@acme/core/sim';
import type { AdoptMonRequest, CareWrite } from '@acme/core/types';
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdoptMonHandler } from '../adopt.ts';
import { createApplyCareHandler } from '../game.ts';

const url = process.env.X1_DATABASE_URL;

describe.skipIf(url === undefined)('M21 adopt and care replay on Postgres', () => {
  let real: Payload;
  const run = Date.now().toString(36);
  const starter = starterEggs[0]!;
  const DEVICE = `device-${run}`;
  const sessions = new Map<string, Record<string, unknown>>();

  /** The real Payload, with `auth` answering for the user named in `x-test-user`. */
  const asCaller = (): Payload =>
    new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === 'auth') {
          return async ({ headers }: { headers: Headers }) => ({ user: sessions.get(headers.get('x-test-user') ?? '') ?? null });
        }
        return Reflect.get(target, prop, receiver) as unknown;
      },
    });

  const adoptRoute = () => createAdoptMonHandler({ getPayload: async () => asCaller(), rateLimit: () => true });
  const careRoute = () => createApplyCareHandler({ getPayload: async () => asCaller() });

  async function caller(tag: string): Promise<string> {
    const user = await real.create({
      collection: 'users',
      data: { email: `${tag}-${run}@example.com`, role: 'user', birthYear: 1990, consentStatus: 'not-required' },
      overrideAccess: true,
    });
    sessions.set(tag, { ...user, collection: 'users' });
    return String(user.id);
  }

  const request = (method: string, path: string, who: string, body: unknown, key?: string) =>
    new Request(`https://admin.test${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-test-user': who, ...(key === undefined ? {} : { 'Idempotency-Key': key }) },
      body: JSON.stringify(body),
    });

  function claim(eggId: string, appliedThroughSeq: number): AdoptMonRequest {
    const monInstanceId = deriveMonInstanceId(eggId);
    const createdAt = Date.now() - 2 * 86_400_000;
    return {
      egg: { eggId, speciesId: starter.speciesId, hatchesIntoSpeciesId: starter.hatchesIntoSpeciesId, incubationMinutes: 15, createdAt },
      mon: {
        monInstanceId, speciesId: starter.hatchesIntoSpeciesId, stage: 'Baby', bond: 0.3, nickname: 'Pip',
        gender: deriveMonGender(eggId), voiceLineageId: deriveVoiceLineageId({ eggId, speciesId: starter.speciesId }),
      },
      care: { ...createInitialCareState(monInstanceId, createdAt + 16 * 60_000), fullness: 0.8 },
      deviceId: DEVICE,
      appliedThroughSeq,
    };
  }

  async function data<T>(response: Response, schema: { parse: (v: unknown) => T }): Promise<T> {
    const json = (await response.json()) as { ok: boolean; data: unknown; error?: unknown };
    expect(json.ok, JSON.stringify(json.error)).toBe(true);
    return schema.parse(json.data);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.PAYLOAD_PUSH = 'true';
    process.env.PAYLOAD_SECRET ??= 'x1-integration-only';
    const { getPayload } = await import('payload');
    const { default: config } = await import('../../../../payload.config.ts');
    real = await getPayload({ config });
  }, 120_000);

  afterAll(async () => {
    await real?.destroy();
  });

  it('claims a device-only Mon through the collection hooks, then applies only the newer writes', async () => {
    const ownerId = await caller('owner');
    const eggId = `egg_adopt_${run}`;
    const body = claim(eggId, 2);
    const adopted = await data(await adoptRoute()(request('POST', '/v1/mons/adopt', 'owner', body, `adopt-${eggId}`)), AdoptMonResponseSchema);
    expect(adopted).toMatchObject({ adopted: true, ackedSeq: 2 });
    expect(adopted.mon).toMatchObject({ callerId: ownerId, bond: 0.3, nickname: 'Pip', stage: 'Baby' });

    const egg = await real.find({ collection: 'eggs', where: { eggId: { equals: eggId } }, overrideAccess: true });
    expect(egg.docs[0]).toMatchObject({ callerId: ownerId, hatched: true });

    // Seq 2 is in the claimed snapshot; seq 3 is new.
    const writes: CareWrite[] = [
      { deviceId: DEVICE, seq: 2, monInstanceId: adopted.mon.monInstanceId, at: body.care.updatedAt + 1_000, action: { kind: 'rest' } },
      { deviceId: DEVICE, seq: 3, monInstanceId: adopted.mon.monInstanceId, at: body.care.updatedAt + 2_000, action: { kind: 'feed' } },
    ];
    const path = `/v1/mons/${adopted.mon.monInstanceId}/care`;
    const old = await data(await careRoute()(request('PUT', path, 'owner', { writes: [writes[0]] }, `care-${DEVICE}-2`), adopted.mon.monInstanceId), PutCareResponseSchema);
    expect(old.applied).toBe(0);
    const fresh = await data(await careRoute()(request('PUT', path, 'owner', { writes: [writes[1]] }, `care-${DEVICE}-3`), adopted.mon.monInstanceId), PutCareResponseSchema);
    expect(fresh).toMatchObject({ applied: 1, ackedSeq: 3 });
    const expected = applyCareWrites({ state: { mon: adopted.mon, care: body.care }, lastSeqByDevice: { [DEVICE]: 2 } }, [writes[1]!]);
    expect(fresh.care).toEqual(expected.state.care);

    // A retry of seq 3 with its key replays the first answer; the meters do not move twice.
    const retry = await careRoute()(request('PUT', path, 'owner', { writes: [writes[1]] }, `care-${DEVICE}-3`), adopted.mon.monInstanceId);
    expect(retry.headers.get('Idempotent-Replayed')).toBe('true');
    expect((await data(retry, PutCareResponseSchema)).care).toEqual(fresh.care);

    // A second claim for the same egg is answered with the stored Mon (bond moved by the feed, not by the claim).
    const again = await data(await adoptRoute()(request('POST', '/v1/mons/adopt', 'owner', { ...claim(eggId, 9), mon: { ...body.mon, bond: 1 } })), AdoptMonResponseSchema);
    expect(again).toMatchObject({ adopted: false, ackedSeq: 3 });
    expect(again.mon.bond).toBe(fresh.mon.bond);
    expect(again.mon.bond).not.toBe(1);
  });

  it('never hands a claimed Mon to another Caller', async () => {
    await caller('first');
    await caller('second');
    const eggId = `egg_owned_${run}`;
    await data(await adoptRoute()(request('POST', '/v1/mons/adopt', 'first', claim(eggId, 0))), AdoptMonResponseSchema);
    const stolen = await adoptRoute()(request('POST', '/v1/mons/adopt', 'second', claim(eggId, 0)));
    expect(stolen.status).toBe(409);
  });

  it('builds on an egg the server already holds, as the hatch route would mint it', async () => {
    const ownerId = await caller('egg-first');
    const eggId = `egg_known_${run}`;
    const body = claim(eggId, 0);
    const createdAtMs = Date.now() - 86_400_000;
    await real.create({
      collection: 'eggs',
      data: {
        eggId, monInstanceId: deriveMonInstanceId(eggId), speciesId: starter.speciesId, hatchesIntoSpeciesId: starter.hatchesIntoSpeciesId,
        callerId: ownerId, nickname: null, incubationMinutes: 15, createdAtMs, incubationEndsAt: createdAtMs + 15 * 60_000, hatched: false,
      },
      overrideAccess: true,
    });
    const adopted = await data(await adoptRoute()(request('POST', '/v1/mons/adopt', 'egg-first', body)), AdoptMonResponseSchema);
    const minted = mintMonInstance({
      eggId, monInstanceId: deriveMonInstanceId(eggId), speciesId: starter.speciesId, hatchesIntoSpeciesId: starter.hatchesIntoSpeciesId,
      callerId: ownerId, nickname: null, incubationMinutes: 15, createdAt: createdAtMs, incubationEndsAt: createdAtMs + 15 * 60_000,
    });
    expect(adopted.mon.hatchedAt).toBe(minted.hatchedAt);
    expect(adopted.mon.voiceLineageId).toBe(minted.voiceLineageId);
  });
});
