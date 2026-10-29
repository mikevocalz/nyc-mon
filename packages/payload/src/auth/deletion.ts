// Account deletion after the 7-day grace (ADR 0001 as amended by
// docs/design/DECISIONS.md L3). Personal data goes; Mons and eggs never do
// (Law 8). Each one passes into Dr. Santoro's care: its owner becomes the
// sanctuary, its nickname is cleared, and its id and history stay. Decision
// #15 does the same when a guardian says no.
import type { CollectionSlug, Payload, PayloadRequest, TaskConfig } from 'payload';
import { commitTransaction, createPayloadRequest, initTransaction, killTransaction } from 'payload';
import { CALLER_DELETION_CONTEXT_KEY } from '../collections/MonInstances.ts';

/**
 * The `callerId` a Mon or egg carries once it is in Santoro's care. A system
 * owner, never a `users` row, so no sign-in can ever reach it. How the
 * sanctuary appears in the story is TODO(canon) (Decision #15).
 */
export const SANCTUARY_CALLER_ID = 'sanctuary:santoro';

/**
 * Rows that belong to a user, with the field that points at them. The
 * collection generator names a relationship `user`; `deviceCode.userId` has no
 * reference in Better Auth's schema, so it stays a text `userId`.
 */
const AUTH_ROWS: readonly (readonly [CollectionSlug, string])[] = [
  ['sessions', 'user'],
  ['accounts', 'user'],
  ['passkeys', 'user'],
  ['twoFactors', 'user'],
  ['deviceCodes', 'userId'],
];

/** Eggs before Mons: the Mon hook reads its egg. */
const CARED_FOR: readonly CollectionSlug[] = ['eggs', 'mon-instances'];

/** What one deletion did. */
export interface CallerDeletion {
  userId: string;
  releasedMonInstanceIds: string[];
  releasedEggIds: string[];
}

/**
 * The `idempotency-records` key prefix for one Caller's stored replies
 * (`admin/console/v1/idempotency.ts`). The trailing pipe keeps `caller:4|`
 * from matching `caller:41|`.
 */
export function idempotencyKeyPrefix(userId: string): string {
  return `caller:${userId}|`;
}

/**
 * Everything a deletion does except removing the `users` row: Mons and eggs
 * pass to the sanctuary with the nickname cleared, and the Caller's sign-in
 * rows and stored replies are deleted. Runs inside the caller's `req`
 * transaction. Safe to run twice: a second pass finds nothing left.
 */
async function releaseCallerData(payload: Payload, userId: string, req: PayloadRequest): Promise<CallerDeletion> {
  const released: CallerDeletion = { userId, releasedMonInstanceIds: [], releasedEggIds: [] };
  for (const collection of CARED_FOR) {
    if (payload.collections[collection] === undefined) continue;
    const { docs } = await payload.find({ collection, where: { callerId: { equals: userId } }, limit: 0, depth: 0, overrideAccess: true, req });
    for (const doc of docs as unknown as Record<string, unknown>[]) {
      await payload.update({
        collection,
        id: String(doc.id),
        // Owner and nickname only; the id, care and history stay (Law 8).
        data: { callerId: SANCTUARY_CALLER_ID, nickname: null },
        // The Mon hook refuses a nickname clear unless this flag is set.
        context: { [CALLER_DELETION_CONTEXT_KEY]: true },
        overrideAccess: true,
        req,
      });
      if (collection === 'eggs') released.releasedEggIds.push(String(doc.eggId));
      else released.releasedMonInstanceIds.push(String(doc.monInstanceId));
    }
  }
  for (const [collection, field] of AUTH_ROWS) {
    if (payload.collections[collection] === undefined) continue;
    await payload.delete({ collection, where: { [field]: { equals: userId } }, overrideAccess: true, req });
  }
  // Stored first replies can carry what the Caller sent (a Caller name, a nickname).
  if (payload.collections['idempotency-records'] !== undefined) {
    const prefix = idempotencyKeyPrefix(userId);
    const { docs } = await payload.find({
      collection: 'idempotency-records',
      where: { key: { like: prefix } },
      limit: 0,
      depth: 0,
      select: { key: true },
      overrideAccess: true,
      req,
    });
    const ids = (docs as unknown as { id: unknown; key: unknown }[])
      .filter((doc) => typeof doc.key === 'string' && doc.key.startsWith(prefix))
      .map((doc) => doc.id as string | number);
    if (ids.length > 0) {
      await payload.delete({ collection: 'idempotency-records', where: { id: { in: ids } }, overrideAccess: true, req });
    }
  }
  return released;
}

/**
 * Deletes one Caller's personal data and releases their Mons and eggs to the
 * sanctuary, in one transaction. Refuses an account whose deletion is not
 * scheduled or not yet due.
 */
export async function deleteCallerAccount(payload: Payload, userId: string, nowMs: number = Date.now()): Promise<CallerDeletion> {
  const req = await createPayloadRequest({ payload });
  const ownTransaction = await initTransaction(req);
  try {
    const user = (await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true, req })) as unknown as Record<string, unknown>;
    const due = typeof user.deletionScheduledFor === 'string' ? Date.parse(user.deletionScheduledFor) : Number.NaN;
    if (!Number.isFinite(due) || due > nowMs) {
      throw new Error(`user ${userId} has no deletion due`);
    }
    const released = await releaseCallerData(payload, userId, req);
    await payload.delete({ collection: 'users', id: userId, overrideAccess: true, req });
    if (ownTransaction) await commitTransaction(req);
    return released;
  } catch (error) {
    if (ownTransaction) await killTransaction(req);
    throw error;
  }
}

/**
 * A Caller deleting their own account from Settings (M20, App Store 5.1.1(v)).
 * Better Auth's `/delete-user` calls this as `beforeDelete`, then removes the
 * `users` row, its accounts and its sessions itself. No grace period: the
 * Caller confirmed in the app, and the privacy notice promises no delay. The
 * 7-day grace stays for deletions staff schedule from the console.
 */
export async function releaseOwnAccount(payload: Payload, userId: string): Promise<CallerDeletion> {
  const req = await createPayloadRequest({ payload });
  const ownTransaction = await initTransaction(req);
  try {
    const released = await releaseCallerData(payload, userId, req);
    if (ownTransaction) await commitTransaction(req);
    return released;
  } catch (error) {
    if (ownTransaction) await killTransaction(req);
    throw error;
  }
}

/**
 * Better Auth's `user.deleteUser` options, bound to the live Payload. Lives
 * here, not in `options.ts`, because the release needs the Payload instance
 * that only `payload.config.ts` holds; the flag adds no schema.
 */
export function selfDeletionOptions(payload: Payload) {
  return {
    enabled: true,
    beforeDelete: async (user: { id: string | number }) => {
      await releaseOwnAccount(payload, String(user.id));
    },
  } as const;
}

/** Runs every deletion whose grace has passed. One failure does not stop the rest. */
export async function runDueCallerDeletions(payload: Payload, nowMs: number = Date.now()): Promise<CallerDeletion[]> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { deletionScheduledFor: { less_than_equal: new Date(nowMs).toISOString() } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });
  const done: CallerDeletion[] = [];
  for (const doc of docs) {
    try {
      done.push(await deleteCallerAccount(payload, String(doc.id), nowMs));
    } catch (error) {
      payload.logger.error({ err: error, userId: doc.id }, '[auth] scheduled account deletion failed');
    }
  }
  return done;
}

/**
 * Hourly Payload job. Payload queues it on schedule; something must still run
 * the queue (a Vercel cron calling the jobs endpoint), recorded in ADR 0004.
 */
export const deleteDueCallersTask: TaskConfig<{ input: object; output: { deleted: number } }> = {
  slug: 'delete-due-callers',
  label: 'Delete accounts past their 7-day grace',
  outputSchema: [{ name: 'deleted', type: 'number', required: true }],
  retries: 2,
  schedule: [{ cron: '0 * * * *', queue: 'default' }],
  handler: async ({ req }) => {
    const done = await runDueCallerDeletions(req.payload);
    return { output: { deleted: done.length } };
  },
};
