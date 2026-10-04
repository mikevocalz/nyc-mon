// Payload Local API against a real Postgres. Opt-in: set X1_DATABASE_URL to an
// empty, disposable database; the schema is pushed on init. Without it the
// suite is skipped and the unit tests in this folder still run.
import type { Payload } from 'payload';
import type { User } from '../../payload-types.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REVEAL_CONTEXT_KEY } from '../audit/reveal.ts';
import { deriveMonInstanceId } from '../core.ts';
import { RecordError } from '../errors.ts';

const url = process.env.X1_DATABASE_URL;

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

const codeOf = (error: unknown) => (error instanceof RecordError ? error.code : undefined);

describe.skipIf(url === undefined)('X1 collections on Postgres', () => {
  let payload: Payload;
  let staffId: number;
  const run = Date.now().toString(36);
  const eggId = `egg_${run}`;
  const monInstanceId = deriveMonInstanceId(eggId);
  const createdAtMs = 1_759_600_000_000;

  // TODO(adr-0004): `users.role` cannot hold the staff roles yet, so the Local
  // API gets the signed-in staff member as an object with the role it will have.
  const staffUser = (role: string): User & { collection: 'users' } => ({
    id: staffId,
    role: role as User['role'],
    collection: 'users',
    email: 'staff@example.com',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.PAYLOAD_PUSH = 'true';
    process.env.PAYLOAD_SECRET ??= 'x1-integration-only';
    const { getPayload } = await import('payload');
    const { default: config } = await import('../../payload.config.ts');
    payload = await getPayload({ config });
    const user = await payload.create({
      collection: 'users',
      data: { email: `staff-${run}@example.com`, role: 'admin' },
      overrideAccess: true,
    });
    staffId = user.id;
  }, 120_000);

  afterAll(async () => {
    await payload?.destroy();
  });

  const egg = () => ({
    eggId,
    monInstanceId,
    speciesId: 'dex-001',
    hatchesIntoSpeciesId: 'dex-002',
    callerId: '41',
    nickname: 'Pip',
    incubationMinutes: 15,
    createdAtMs,
    incubationEndsAt: createdAtMs + 15 * 60_000,
    hatched: false,
  });

  const mon = () => ({
    monInstanceId,
    eggId,
    speciesId: 'dex-002',
    nickname: 'Pip',
    callerId: '41',
    hatchedAt: createdAtMs + 15 * 60_000,
    bond: 0,
    stage: 'Baby' as const,
  });

  it('stores an egg and refuses a second row for the same eggId', async () => {
    await payload.create({ collection: 'eggs', data: egg(), overrideAccess: true });
    const dup = await rejection(payload.create({ collection: 'eggs', data: egg(), overrideAccess: true }));
    expect(String(dup)).toMatch(/unique|already|eggId|monInstanceId/i);
  });

  it('mints the Mon, marks the egg hatched, and refuses a second Mon for the egg', async () => {
    await payload.create({ collection: 'mon-instances', data: mon(), overrideAccess: true });
    const stored = await payload.find({ collection: 'eggs', where: { eggId: { equals: eggId } }, overrideAccess: true });
    expect(stored.docs[0]?.hatched).toBe(true);
    const second = await rejection(payload.create({ collection: 'mon-instances', data: mon(), overrideAccess: true }));
    expect(String(second)).toMatch(/unique|already|eggId|monInstanceId/i);
  });

  it('has a database unique index on mon-instances.eggId even with hooks bypassed', async () => {
    // payload.db writes straight through the adapter: no hooks, no access.
    const raw = await rejection(
      payload.db.create({
        collection: 'mon-instances',
        data: { ...mon(), monInstanceId: `mon_${run}_raw` },
      }),
    );
    expect(String(raw)).toMatch(/unique|already|eggId/i);
    const rawEgg = await rejection(payload.db.create({ collection: 'eggs', data: { ...egg(), monInstanceId: `x_${run}` } }));
    expect(String(rawEgg)).toMatch(/unique|already|eggId/i);
  });

  it('refuses to delete an egg, a Mon or a care row, even with overrideAccess (Law 8)', async () => {
    const care = await payload.create({
      collection: 'care-states',
      data: {
        monInstanceId,
        energy: 1,
        fullness: 0.5,
        social: 0.5,
        updatedAtMs: createdAtMs + 15 * 60_000,
        activity: { kind: 'awake' },
        lastSeqByDevice: {},
      },
      overrideAccess: true,
    });
    const [storedEgg] = (await payload.find({ collection: 'eggs', where: { eggId: { equals: eggId } }, overrideAccess: true })).docs;
    const [storedMon] = (
      await payload.find({ collection: 'mon-instances', where: { eggId: { equals: eggId } }, overrideAccess: true })
    ).docs;
    if (storedEgg === undefined || storedMon === undefined) throw new Error('fixtures missing');

    const attempts = [
      () => payload.delete({ collection: 'eggs', id: storedEgg.id, overrideAccess: true }),
      () => payload.delete({ collection: 'mon-instances', id: storedMon.id, overrideAccess: true }),
      () => payload.delete({ collection: 'care-states', id: care.id, overrideAccess: true }),
    ];
    for (const attempt of attempts) {
      expect(codeOf(await rejection(attempt()))).toBe('DELETE_FORBIDDEN');
    }
    // A bulk delete reports per-document errors instead of throwing.
    const bulk = await payload.delete({ collection: 'mon-instances', where: { eggId: { equals: eggId } }, overrideAccess: true });
    expect(bulk.docs).toHaveLength(0);
    expect(bulk.errors).toHaveLength(1);

    for (const collection of ['eggs', 'mon-instances'] as const) {
      const left = await payload.count({ collection, where: { eggId: { equals: eggId } }, overrideAccess: true });
      expect(left.totalDocs, collection).toBe(1);
    }
  });

  it('denies every staff write and hides nicknames until a logged reveal', async () => {
    const write = await rejection(
      payload.update({
        collection: 'mon-instances',
        where: { eggId: { equals: eggId } },
        data: { bond: 1 },
        user: staffUser('ops'),
        overrideAccess: false,
      }),
    );
    expect(String(write)).toMatch(/not allowed|forbidden/i);

    const masked = await payload.find({
      collection: 'mon-instances',
      where: { eggId: { equals: eggId } },
      user: staffUser('support'),
      overrideAccess: false,
    });
    expect(masked.docs[0]?.monInstanceId).toBe(monInstanceId);
    expect(masked.docs[0]).not.toHaveProperty('nickname');

    const byNickname = await rejection(
      payload.find({
        collection: 'mon-instances',
        where: { nickname: { equals: 'Pip' } },
        user: staffUser('support'),
        overrideAccess: false,
      }),
    );
    expect(String(byNickname)).toMatch(/cannot be queried|nickname/i);

    const before = await payload.count({ collection: 'audit-events', where: { targetId: { equals: monInstanceId } }, overrideAccess: true });
    const revealed = await payload.find({
      collection: 'mon-instances',
      where: { eggId: { equals: eggId } },
      user: staffUser('support'),
      overrideAccess: false,
      context: { [REVEAL_CONTEXT_KEY]: { collection: 'mon-instances', field: 'nickname', reasonCode: 'caller_request' } },
    });
    expect(revealed.docs[0]?.nickname).toBe('Pip');
    const events = await payload.find({
      collection: 'audit-events',
      where: { targetId: { equals: monInstanceId } },
      sort: '-at',
      overrideAccess: true,
    });
    expect(events.totalDocs).toBe(before.totalDocs + 1);
    expect(events.docs[0]).toMatchObject({ action: 'mon.value_shown', actorRole: 'support', reasonCode: 'caller_request' });
    expect(JSON.stringify(events.docs[0])).not.toContain('Pip');

    const contentRole = await rejection(
      payload.find({ collection: 'mon-instances', user: staffUser('content'), overrideAccess: false }),
    );
    expect(String(contentRole)).toMatch(/not allowed|forbidden/i);
  });

  it('keeps audit events append-only for server code too', async () => {
    const [event] = (await payload.find({ collection: 'audit-events', limit: 1, overrideAccess: true })).docs;
    if (event === undefined) throw new Error('no audit event to test with');
    const update = await rejection(
      payload.update({ collection: 'audit-events', id: event.id, data: { reasonCode: 'legal' }, overrideAccess: true }),
    );
    expect(codeOf(update)).toBe('APPEND_ONLY');
    const remove = await rejection(payload.delete({ collection: 'audit-events', id: event.id, overrideAccess: true }));
    expect(codeOf(remove)).toBe('DELETE_FORBIDDEN');
  });

  it('masks guardian data, refuses queries on it, and leaves a deletion receipt without it', async () => {
    const birthYear = new Date().getUTCFullYear() - 9;
    const consent = await payload.create({
      collection: 'guardian-consents',
      data: {
        parentEmail: `parent-${run}@example.com`,
        birthYear,
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        emailsSent: 0,
        parentRequest: 'none',
      },
      overrideAccess: true,
    });
    const seen = await payload.findByID({
      collection: 'guardian-consents',
      id: consent.id,
      user: staffUser('consent'),
      overrideAccess: false,
    });
    expect(seen).not.toHaveProperty('parentEmail');
    expect(seen).not.toHaveProperty('birthYear');
    expect(seen.status).toBe('pending');

    const support = await rejection(
      payload.findByID({ collection: 'guardian-consents', id: consent.id, user: staffUser('support'), overrideAccess: false }),
    );
    expect(String(support)).toMatch(/not allowed|forbidden/i);

    const probe = await rejection(
      payload.find({
        collection: 'guardian-consents',
        where: { parentEmail: { equals: `parent-${run}@example.com` } },
        user: staffUser('consent'),
        overrideAccess: false,
      }),
    );
    expect(String(probe)).toMatch(/cannot be queried|parentEmail/i);

    await payload.delete({ collection: 'guardian-consents', id: consent.id, overrideAccess: true });
    const trail = await payload.find({
      collection: 'audit-events',
      where: { targetType: { equals: 'consent' }, targetId: { equals: String(consent.id) } },
      sort: 'at',
      overrideAccess: true,
    });
    expect(trail.docs.map((e) => e.action)).toEqual(['consent.requested', 'consent.deleted']);
    expect(JSON.stringify(trail.docs)).not.toContain('@example.com');
    expect(JSON.stringify(trail.docs)).not.toContain(String(birthYear));
  });
});
