// Account merge and account deletion against a real Postgres (ADR 0004 §3;
// docs/design/DECISIONS.md L3). Opt-in like the X1 suite: set X1_DATABASE_URL
// to an empty, disposable database; the schema is pushed on init.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deriveMonInstanceId } from '../../collections/core.ts';
import { deleteCallerAccount, SANCTUARY_CALLER_ID } from '../deletion.ts';
import { transferAccount } from '../plugins/account-merge.ts';

const url = process.env.X1_DATABASE_URL;

describe.skipIf(url === undefined)('merge and deletion on Postgres', () => {
  let payload: Payload;
  const run = Date.now().toString(36);
  const createdAtMs = 1_759_600_000_000;

  async function caller(tag: string, birthYear: number | null = 2000): Promise<string> {
    const user = await payload.create({
      collection: 'users',
      data: { email: `${tag}-${run}@example.com`, role: 'user', birthYear, consentStatus: 'not-required' },
      overrideAccess: true,
    });
    return String(user.id);
  }

  async function hatchFor(callerId: string, tag: string): Promise<{ eggId: string; monInstanceId: string }> {
    const eggId = `egg_${tag}_${run}`;
    const monInstanceId = deriveMonInstanceId(eggId);
    const hatchedAt = createdAtMs + 15 * 60_000;
    await payload.create({
      collection: 'eggs',
      data: {
        eggId,
        monInstanceId,
        speciesId: 'dex-001',
        hatchesIntoSpeciesId: 'dex-002',
        callerId,
        nickname: 'Pip',
        incubationMinutes: 15,
        createdAtMs,
        incubationEndsAt: hatchedAt,
        hatched: false,
      },
      overrideAccess: true,
    });
    await payload.create({
      collection: 'mon-instances',
      data: { monInstanceId, eggId, speciesId: 'dex-002', nickname: 'Pip', callerId, hatchedAt, bond: 0, stage: 'Baby' },
      overrideAccess: true,
    });
    return { eggId, monInstanceId };
  }

  async function monsOf(callerId: string) {
    const { docs } = await payload.find({ collection: 'mon-instances', where: { callerId: { equals: callerId } }, overrideAccess: true });
    return docs;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.PAYLOAD_PUSH = 'true';
    process.env.PAYLOAD_SECRET ??= 'auth-integration-only';
    const { getPayload } = await import('payload');
    const { default: config } = await import('../../payload.config.ts');
    payload = await getPayload({ config });
  }, 120_000);

  afterAll(async () => {
    await payload?.destroy();
  });

  it('moves both starters to the survivor, keeps their ids, and deletes nothing (DECISIONS #18)', async () => {
    const survivor = await caller('survivor');
    const merged = await caller('merged', null);
    const kept = await hatchFor(survivor, 's');
    const moved = await hatchFor(merged, 'm');

    const result = await transferAccount(payload, survivor, merged);

    expect(result.monInstanceIds).toEqual([moved.monInstanceId]);
    const mons = await monsOf(survivor);
    expect(mons.map((m) => m.monInstanceId).sort()).toEqual([kept.monInstanceId, moved.monInstanceId].sort());
    const survivorDoc = await payload.findByID({ collection: 'users', id: survivor, overrideAccess: true });
    // Two Mons: Home asks which one is active.
    expect(survivorDoc.activeMonInstanceId ?? null).toBeNull();
    const gone = await payload.find({ collection: 'users', where: { id: { equals: merged } }, overrideAccess: true });
    expect(gone.totalDocs).toBe(0);
    const audit = await payload.find({
      collection: 'audit-events',
      where: { targetId: { equals: moved.monInstanceId } },
      overrideAccess: true,
    });
    expect(audit.docs.some((event) => event.action === 'mon.caller_changed')).toBe(true);
  });

  it('refuses two accounts with different birth years and changes nothing', async () => {
    const a = await caller('year-a', 1999);
    const b = await caller('year-b', 2001);
    const egg = await hatchFor(b, 'y');
    await expect(transferAccount(payload, a, b)).rejects.toMatchObject({ body: { code: 'MERGE_BIRTH_YEAR_MISMATCH' } });
    expect((await monsOf(b)).map((m) => m.monInstanceId)).toEqual([egg.monInstanceId]);
  });

  it('deletion releases Mons and eggs to the sanctuary with the nickname cleared (L3)', async () => {
    const leaving = await caller('leaving');
    const { eggId, monInstanceId } = await hatchFor(leaving, 'd');
    await payload.update({
      collection: 'users',
      id: leaving,
      data: { deletionScheduledFor: new Date(Date.now() - 1000).toISOString() },
      overrideAccess: true,
    });

    const result = await deleteCallerAccount(payload, leaving);

    expect(result.releasedMonInstanceIds).toEqual([monInstanceId]);
    const [mon] = (await payload.find({ collection: 'mon-instances', where: { monInstanceId: { equals: monInstanceId } }, overrideAccess: true })).docs;
    expect(mon?.callerId).toBe(SANCTUARY_CALLER_ID);
    expect(mon?.nickname ?? null).toBeNull();
    const [egg] = (await payload.find({ collection: 'eggs', where: { eggId: { equals: eggId } }, overrideAccess: true })).docs;
    expect(egg?.callerId).toBe(SANCTUARY_CALLER_ID);
    expect((await payload.find({ collection: 'users', where: { id: { equals: leaving } }, overrideAccess: true })).totalDocs).toBe(0);
  });

  it('refuses a deletion that is not yet due', async () => {
    const staying = await caller('staying');
    await payload.update({
      collection: 'users',
      id: staying,
      data: { deletionScheduledFor: new Date(Date.now() + 86_400_000).toISOString() },
      overrideAccess: true,
    });
    await expect(deleteCallerAccount(payload, staying)).rejects.toThrow(/no deletion due/);
  });
});
