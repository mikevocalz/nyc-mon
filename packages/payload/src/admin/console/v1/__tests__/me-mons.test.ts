import { ListMyMonsResponseSchema } from '@acme/core/schemas';
import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { CARE_STATES_SLUG } from '../../../../collections/CareStates.ts';
import { MON_INSTANCES_SLUG } from '../../../../collections/MonInstances.ts';
import { createListMyMonsHandler } from '../game.ts';
import { ON_BEHALF_OF_HEADER, SERVICE_KEY_HEADER } from '../service-caller.ts';

type Doc = Record<string, unknown>;
type LocalApiCall = (options: Record<string, unknown>) => Promise<unknown>;

const SERVICE_KEY = 'k'.repeat(48);
const NOW = Date.UTC(2026, 9, 8, 12, 0);

function monDoc(monInstanceId: string, callerId: string, hatchedAt: number): Doc {
  return {
    id: monInstanceId,
    monInstanceId,
    speciesId: 'dex-001',
    nickname: null,
    callerId,
    hatchedAt,
    bond: 0,
    stage: 'Baby',
    gender: 'male',
    voiceLineageId: 'dex-001/male/2',
  };
}

function fakePayload(opts: { sessionUser?: Doc | null; users?: Doc[]; mons?: Doc[] } = {}) {
  const tables: Record<string, Doc[]> = {
    users: opts.users ?? [],
    [MON_INSTANCES_SLUG]: opts.mons ?? [],
    [CARE_STATES_SLUG]: [],
  };
  const find = vi.fn<LocalApiCall>(async (args) => {
    const where = (args.where ?? {}) as Record<string, { equals?: unknown }>;
    const rows = tables[String(args.collection)] ?? [];
    return { docs: rows.filter((doc) => Object.entries(where).every(([k, c]) => doc[k] === c.equals)) };
  });
  const findByID = vi.fn<LocalApiCall>(async (args) => {
    return (tables[String(args.collection)] ?? []).find((doc) => doc.id === args.id) ?? null;
  });
  const auth = vi.fn(async () => ({ user: opts.sessionUser ?? null }));
  return { payload: { find, findByID, auth } as unknown as Payload };
}

const get = (headers: Record<string, string> = {}) => new Request('https://admin.test/v1/me/mons', { method: 'GET', headers });
const handler = (fake: ReturnType<typeof fakePayload>) =>
  createListMyMonsHandler({ getPayload: async () => fake.payload, now: () => NOW, serviceKey: SERVICE_KEY });

async function data(response: Response) {
  expect(response.status).toBe(200);
  const body = (await response.json()) as { ok: boolean; data: unknown };
  expect(body.ok).toBe(true);
  return ListMyMonsResponseSchema.parse(body.data);
}

describe('GET /v1/me/mons', () => {
  const mons = [monDoc('mon_chosen', 'c1', NOW - 86_400_000), monDoc('mon_newer', 'c1', NOW - 60_000), monDoc('mon_theirs', 'c2', NOW)];

  it('returns 401 with no session', async () => {
    expect((await handler(fakePayload())(get())).status).toBe(401);
  });

  it("returns the Caller's Mons and their chosen companion from the session user", async () => {
    const fake = fakePayload({ sessionUser: { id: 'c1', activeMonInstanceId: 'mon_chosen' }, mons });
    const body = await data(await handler(fake)(get()));
    expect(body.mons.map((m) => m.mon.monInstanceId).sort()).toEqual(['mon_chosen', 'mon_newer']);
    expect(body.activeMonInstanceId).toBe('mon_chosen');
  });

  it('reads the chosen companion from the user row on the service path', async () => {
    const fake = fakePayload({ users: [{ id: 'c1', birthYear: 1990, activeMonInstanceId: 'mon_chosen' }], mons });
    const body = await data(await handler(fake)(get({ [SERVICE_KEY_HEADER]: SERVICE_KEY, [ON_BEHALF_OF_HEADER]: 'c1' })));
    expect(body.activeMonInstanceId).toBe('mon_chosen');
  });

  it('answers null when the Caller has not chosen a companion', async () => {
    for (const activeMonInstanceId of [undefined, null, '']) {
      const fake = fakePayload({ sessionUser: { id: 'c1', activeMonInstanceId }, mons });
      expect((await data(await handler(fake)(get()))).activeMonInstanceId).toBeNull();
    }
  });
});
