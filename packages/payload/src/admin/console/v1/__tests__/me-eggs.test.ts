import { NotFound, type Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { EGGS_SLUG } from '../../../../collections/Eggs.ts';
import { MON_INSTANCES_SLUG } from '../../../../collections/MonInstances.ts';
import { authenticateCaller, createListMyEggsHandler } from '../game.ts';
import { isAdultByBirthYear, isServiceRoute, ON_BEHALF_OF_HEADER, SERVICE_KEY_HEADER, serviceKeyMatches } from '../service-caller.ts';

type Doc = Record<string, unknown>;
type LocalApiCall = (options: Record<string, unknown>) => Promise<unknown>;

const SERVICE_KEY = 'k'.repeat(48);
const NOW = Date.UTC(2026, 9, 8, 12, 0);

function egg(eggId: string, callerId: string, incubationEndsAt: number): Doc {
  return {
    id: eggId,
    eggId,
    monInstanceId: `mon_${eggId}`,
    speciesId: 'dex-001',
    hatchesIntoSpeciesId: 'dex-002',
    callerId,
    nickname: null,
    incubationMinutes: 15,
    createdAtMs: incubationEndsAt - 15 * 60_000,
    incubationEndsAt,
    hatched: false,
  };
}

/** In-memory Payload with users, eggs and mons, matching `where.<field>.equals`. */
function fakePayload(opts: { sessionUser?: Doc | null; users?: Doc[]; eggs?: Doc[]; mons?: Doc[] } = {}) {
  const tables: Record<string, Doc[]> = {
    users: opts.users ?? [],
    [EGGS_SLUG]: opts.eggs ?? [],
    [MON_INSTANCES_SLUG]: opts.mons ?? [],
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
  return { payload: { find, findByID, auth } as unknown as Payload, find, findByID, auth };
}

function get(headers: Record<string, string> = {}): Request {
  return new Request('https://admin.test/v1/me/eggs', { method: 'GET', headers });
}

function asService(callerId: string, key = SERVICE_KEY): Record<string, string> {
  return { [SERVICE_KEY_HEADER]: key, [ON_BEHALF_OF_HEADER]: callerId };
}

describe('isAdultByBirthYear', () => {
  it('refuses a birth year that could still be 17 this year', () => {
    expect(isAdultByBirthYear(2008, NOW)).toBe(false);
    expect(isAdultByBirthYear(2007, NOW)).toBe(true);
  });

  it('refuses a missing or malformed year', () => {
    expect(isAdultByBirthYear(undefined, NOW)).toBe(false);
    expect(isAdultByBirthYear(null, NOW)).toBe(false);
    expect(isAdultByBirthYear(1990.5, NOW)).toBe(false);
  });
});

describe('serviceKeyMatches', () => {
  it('needs a configured key of at least 32 characters', () => {
    expect(serviceKeyMatches('short', 'short')).toBe(false);
    expect(serviceKeyMatches(SERVICE_KEY, undefined)).toBe(false);
    expect(serviceKeyMatches(SERVICE_KEY, SERVICE_KEY)).toBe(true);
    expect(serviceKeyMatches(`${SERVICE_KEY}x`, SERVICE_KEY)).toBe(false);
  });
});

describe('authenticateCaller', () => {
  it('uses the session when no service headers are sent', async () => {
    const { payload, findByID } = fakePayload({ sessionUser: { id: 7, consentStatus: 'approved' } });
    const caller = await authenticateCaller(payload, get(), { serviceKey: SERVICE_KEY, nowMs: NOW });
    expect(caller).toMatchObject({ callerId: '7' });
    expect(findByID).not.toHaveBeenCalled();
  });

  it('acts for an adult Caller named by the MCP server', async () => {
    const { payload, auth } = fakePayload({ users: [{ id: 'u1', birthYear: 1990 }] });
    const caller = await authenticateCaller(payload, get(asService('u1')), { serviceKey: SERVICE_KEY, nowMs: NOW });
    expect(caller).toMatchObject({ callerId: 'u1' });
    expect(auth).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong service key and never falls back to the session', async () => {
    const { payload, auth } = fakePayload({ sessionUser: { id: 7 }, users: [{ id: 'u1', birthYear: 1990 }] });
    const result = await authenticateCaller(payload, get(asService('u1', 'x'.repeat(48))), {
      serviceKey: SERVICE_KEY,
      nowMs: NOW,
    });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(auth).not.toHaveBeenCalled();
  });

  it('ignores the service headers when the server has no key configured', async () => {
    const { payload } = fakePayload({ users: [{ id: 'u1', birthYear: 1990 }] });
    const result = await authenticateCaller(payload, get(asService('u1')), { serviceKey: '', nowMs: NOW });
    expect((result as Response).status).toBe(401);
  });

  it('refuses an under-18 account on the service path with 403 ADULT_REQUIRED', async () => {
    const { payload } = fakePayload({ users: [{ id: 'teen', birthYear: 2010 }] });
    const result = await authenticateCaller(payload, get(asService('teen')), { serviceKey: SERVICE_KEY, nowMs: NOW });
    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toMatchObject({ ok: false, error: { code: 'ADULT_REQUIRED' } });
  });

  it('refuses an account with no birth year on the service path', async () => {
    const { payload } = fakePayload({ users: [{ id: 'u2' }] });
    const result = await authenticateCaller(payload, get(asService('u2')), { serviceKey: SERVICE_KEY, nowMs: NOW });
    expect((result as Response).status).toBe(403);
  });

  it('returns 401 when the named Caller does not exist', async () => {
    const { payload } = fakePayload();
    const result = await authenticateCaller(payload, get(asService('ghost')), { serviceKey: SERVICE_KEY, nowMs: NOW });
    expect((result as Response).status).toBe(401);
  });
});

describe('service key routes', () => {
  const at = (method: string, path: string, headers: Record<string, string> = {}) =>
    new Request(`https://admin.test${path}`, { method, headers });

  it('allows only the three routes the MCP server calls', () => {
    expect(isServiceRoute(at('GET', '/v1/me/mons'))).toBe(true);
    expect(isServiceRoute(at('GET', '/v1/me/eggs'))).toBe(true);
    expect(isServiceRoute(at('PUT', '/v1/mons/mon_1/care'))).toBe(true);
    expect(isServiceRoute(at('POST', '/v1/eggs'))).toBe(false);
    expect(isServiceRoute(at('POST', '/v1/eggs/e1/hatch'))).toBe(false);
    expect(isServiceRoute(at('GET', '/v1/mons/mon_1/care'))).toBe(false);
  });

  it('acts for the Caller on an allowed route and refuses the service headers anywhere else', async () => {
    const { payload, auth } = fakePayload({ sessionUser: { id: 7 }, users: [{ id: 'u1', birthYear: 1990 }] });
    const allowed = await authenticateCaller(payload, at('PUT', '/v1/mons/mon_1/care', asService('u1')), { serviceKey: SERVICE_KEY, nowMs: NOW });
    expect(allowed).toMatchObject({ callerId: 'u1' });
    const refused = await authenticateCaller(payload, at('POST', '/v1/eggs', asService('u1')), { serviceKey: SERVICE_KEY, nowMs: NOW });
    expect((refused as Response).status).toBe(401);
    expect(auth).not.toHaveBeenCalled();
  });
});

describe('Caller lookup errors', () => {
  it('answers 401 when the named Caller is not found', async () => {
    const fake = fakePayload();
    fake.findByID.mockRejectedValueOnce(new NotFound());
    const result = await authenticateCaller(fake.payload, get(asService('u9')), { serviceKey: SERVICE_KEY, nowMs: NOW });
    expect((result as Response).status).toBe(401);
  });

  it('answers 5xx, not 401, when the user lookup fails', async () => {
    const fake = fakePayload();
    fake.findByID.mockRejectedValueOnce(new Error('connection terminated'));
    await expect(authenticateCaller(fake.payload, get(asService('u1')), { serviceKey: SERVICE_KEY, nowMs: NOW })).rejects.toThrow(
      'connection terminated',
    );
    const handler = createListMyEggsHandler({ getPayload: async () => fake.payload, now: () => NOW, serviceKey: SERVICE_KEY });
    fake.findByID.mockRejectedValueOnce(new Error('connection terminated'));
    const response = await handler(get(asService('u1')));
    expect(response.status).toBe(500);
  });
});

describe('GET /v1/me/eggs', () => {
  const handler = (fake: ReturnType<typeof fakePayload>) =>
    createListMyEggsHandler({ getPayload: async () => fake.payload, now: () => NOW, serviceKey: SERVICE_KEY });

  it('returns 401 with no session', async () => {
    const response = await handler(fakePayload())(get());
    expect(response.status).toBe(401);
  });

  it("lists only the Caller's unhatched eggs, soonest first, with readiness", async () => {
    const fake = fakePayload({
      sessionUser: { id: 'c1' },
      eggs: [
        egg('late', 'c1', NOW + 30 * 60_000),
        egg('ready', 'c1', NOW - 60_000),
        egg('hatched', 'c1', NOW - 120 * 60_000),
        egg('theirs', 'c2', NOW + 60_000),
      ],
      mons: [{ id: 'm1', callerId: 'c1', eggId: 'hatched' }],
    });
    const response = await handler(fake)(get());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; data: { eggs: { egg: { eggId: string }; readyToHatch: boolean }[] } };
    expect(body.ok).toBe(true);
    expect(body.data.eggs.map((e) => [e.egg.eggId, e.readyToHatch])).toEqual([
      ['ready', true],
      ['late', false],
    ]);
  });

  it('returns an empty list when nothing is incubating', async () => {
    const response = await handler(fakePayload({ sessionUser: { id: 'c1' } }))(get());
    expect(await response.json()).toEqual({ ok: true, data: { eggs: [] } });
  });
});
