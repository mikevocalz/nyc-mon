import type { PayloadRequest } from 'payload';
import { deriveMonInstanceId } from '../../../collections/core.ts';
import { ConsoleError } from './errors.ts';
import { requireStaff, withTransaction } from './helpers.ts';

const INTEGRITY_ROLES = ['ops', 'support'] as const;
const STALE_READY_DAYS = 7;
const RUN_COOLDOWN_MS = 60 * 1000;

async function countSharedEgg(req: PayloadRequest): Promise<number> {
  const { docs } = await req.payload.find({
    collection: 'mon-instances',
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  });
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const doc of docs as unknown as Record<string, unknown>[]) {
    const eggId = doc.eggId;
    if (typeof eggId !== 'string') continue;
    if (seen.has(eggId)) shared.add(eggId);
    else seen.add(eggId);
  }
  return shared.size;
}

async function countIdMismatch(req: PayloadRequest): Promise<number> {
  const { docs } = await req.payload.find({
    collection: 'mon-instances',
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  });
  let mismatches = 0;
  for (const doc of docs as unknown as Record<string, unknown>[]) {
    const eggId = doc.eggId;
    const monInstanceId = doc.monInstanceId;
    if (typeof eggId !== 'string' || typeof monInstanceId !== 'string') continue;
    if (monInstanceId !== deriveMonInstanceId(eggId)) mismatches += 1;
  }
  return mismatches;
}

async function countOrphans(req: PayloadRequest): Promise<number> {
  const [eggsResult, monsResult] = await Promise.all([
    req.payload.find({ collection: 'eggs', limit: 0, depth: 0, overrideAccess: true, req }),
    req.payload.find({ collection: 'mon-instances', limit: 0, depth: 0, overrideAccess: true, req }),
  ]);
  const eggs = eggsResult.docs as unknown as Record<string, unknown>[];
  const mons = monsResult.docs as unknown as Record<string, unknown>[];
  const monEggIds = new Set<string>();
  for (const mon of mons) {
    const eggId = mon.eggId;
    if (typeof eggId === 'string') monEggIds.add(eggId);
  }
  const eggIds = new Set<string>();
  for (const egg of eggs) {
    const eggId = egg.eggId;
    if (typeof eggId === 'string') eggIds.add(eggId);
  }
  let orphans = 0;
  for (const egg of eggs) {
    if (egg.hatched === true && !monEggIds.has(egg.eggId as string)) orphans += 1;
  }
  for (const mon of mons) {
    if (!eggIds.has(mon.eggId as string)) orphans += 1;
  }
  return orphans;
}

async function countStaleReady(req: PayloadRequest): Promise<number> {
  const now = Date.now();
  const staleThreshold = now - STALE_READY_DAYS * 24 * 60 * 60 * 1000;
  const { docs } = await req.payload.find({
    collection: 'eggs',
    where: {
      hatched: { equals: false },
      incubationEndsAt: { less_than_equal: staleThreshold },
    },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  });
  return (docs as unknown as Record<string, unknown>[]).length;
}

async function checkRunning(req: PayloadRequest): Promise<boolean> {
  const cooldownStart = new Date(Date.now() - RUN_COOLDOWN_MS).toISOString();
  const { docs } = await req.payload.find({
    collection: 'integrity-runs',
    where: { at: { greater_than_equal: cooldownStart } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  return docs.length > 0;
}

export async function runIntegrityCheck(req: PayloadRequest): Promise<Response> {
  requireStaff(req, INTEGRITY_ROLES);

  return withTransaction(req, async () => {
    if (await checkRunning(req)) {
      throw new ConsoleError('RUN_IN_PROGRESS', 409, 'An integrity run was started in the last minute.');
    }

    const [sharedEgg, idMismatch, orphans, staleReady] = await Promise.all([
      countSharedEgg(req),
      countIdMismatch(req),
      countOrphans(req),
      countStaleReady(req),
    ]);

    const actor = req.user;
    const actorId = actor && typeof actor === 'object' && 'id' in actor && typeof actor.id === 'number' ? actor.id : null;

    const run = await req.payload.create({
      collection: 'integrity-runs',
      data: {
        at: new Date().toISOString(),
        trigger: 'manual',
        actor: actorId,
        sharedEgg,
        idMismatch,
        orphans,
        staleReady,
      },
      depth: 0,
      overrideAccess: true,
      req,
    });

    return Response.json({ run });
  });
}
