import type { PayloadRequest } from 'payload';
import { writeAuditEvent } from '../../../collections/audit/writeAuditEvent.ts';
import { ConsoleError } from './errors.ts';
import { idParam, readBody, readReasonCode, requireStaff, withTransaction } from './helpers.ts';

const CALLER_MANAGER_ROLES = ['ops', 'support'] as const;
const DELETION_GRACE_DAYS = 7;

function confirmCodeFor(id: string): string {
  return id.slice(-6);
}

async function loadCaller(req: PayloadRequest, id: string): Promise<Record<string, unknown>> {
  const numeric = Number(id);
  const doc = await req.payload.findByID({
    collection: 'users',
    id: Number.isNaN(numeric) ? id : numeric,
    depth: 0,
    overrideAccess: true,
    req,
  });
  if (doc === null || doc === undefined) {
    throw new ConsoleError('NOT_FOUND', 404, 'Caller not found.');
  }
  return doc as unknown as Record<string, unknown>;
}

function callerUpdatedAt(doc: Record<string, unknown>): string | undefined {
  const value = doc.updatedAt;
  return typeof value === 'string' ? value : undefined;
}

function assertUnchanged(doc: Record<string, unknown>, expectedUpdatedAt: unknown): void {
  if (expectedUpdatedAt === undefined) return;
  if (callerUpdatedAt(doc) !== expectedUpdatedAt) {
    throw new ConsoleError('RECORD_CHANGED', 409, 'The Caller was changed by someone else.');
  }
}

export async function scheduleCallerDeletion(req: PayloadRequest): Promise<Response> {
  requireStaff(req, CALLER_MANAGER_ROLES);
  const id = idParam(req);
  const body = await readBody(req);

  return withTransaction(req, async () => {
    const caller = await loadCaller(req, id);
    assertUnchanged(caller, body?.expectedUpdatedAt);

    if (caller.deletionScheduledFor !== undefined && caller.deletionScheduledFor !== null) {
      throw new ConsoleError('ALREADY_SCHEDULED', 409, 'Deletion is already scheduled for this Caller.');
    }

    const confirmText = body?.confirmText;
    if (typeof confirmText !== 'string' || confirmText.trim() !== confirmCodeFor(id)) {
      throw new ConsoleError('CONFIRM_MISMATCH', 400, 'The confirmation text does not match.');
    }

    const reasonCode = readReasonCode(body);
    const scheduledFor = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const actor = req.user;
    const actorId = actor && typeof actor === 'object' && 'id' in actor && typeof actor.id === 'number' ? actor.id : null;

    await req.payload.update({
      collection: 'users',
      id: caller.id as string | number,
      data: {
        deletionScheduledFor: scheduledFor,
        deletionScheduledBy: actorId,
        deletionReason: reasonCode ?? null,
      },
      depth: 0,
      overrideAccess: true,
      req,
    });

    await writeAuditEvent(req, {
      action: 'caller.deletion_scheduled',
      targetType: 'caller',
      targetId: String(caller.id),
      reasonCode,
    });

    return Response.json({ scheduledFor });
  });
}

export async function cancelCallerDeletion(req: PayloadRequest): Promise<Response> {
  requireStaff(req, CALLER_MANAGER_ROLES);
  const id = idParam(req);
  const body = await readBody(req);

  return withTransaction(req, async () => {
    const caller = await loadCaller(req, id);
    assertUnchanged(caller, body?.expectedUpdatedAt);

    if (caller.deletionScheduledFor === undefined || caller.deletionScheduledFor === null) {
      throw new ConsoleError('NOT_SCHEDULED', 409, 'No deletion is scheduled for this Caller.');
    }

    await req.payload.update({
      collection: 'users',
      id: caller.id as string | number,
      data: { deletionScheduledFor: null, deletionScheduledBy: null, deletionReason: null },
      depth: 0,
      overrideAccess: true,
      req,
    });

    await writeAuditEvent(req, {
      action: 'caller.deletion_cancelled',
      targetType: 'caller',
      targetId: String(caller.id),
    });

    return Response.json({});
  });
}

export async function signOutCallerEverywhere(req: PayloadRequest): Promise<Response> {
  requireStaff(req, CALLER_MANAGER_ROLES);
  const id = idParam(req);
  const body = await readBody(req);
  const reasonCode = readReasonCode(body);

  return withTransaction(req, async () => {
    const caller = await loadCaller(req, id);
    const before = await req.payload.count({
      collection: 'sessions',
      where: { user: { equals: caller.id } },
      overrideAccess: true,
      req,
    });

    await req.payload.delete({
      collection: 'sessions',
      where: { user: { equals: caller.id } },
      overrideAccess: true,
      req,
    });

    const after = await req.payload.count({
      collection: 'sessions',
      where: { user: { equals: caller.id } },
      overrideAccess: true,
      req,
    });

    const sessionsEnded = before.totalDocs - after.totalDocs;

    await writeAuditEvent(req, {
      action: 'caller.signed_out_everywhere',
      targetType: 'caller',
      targetId: String(caller.id),
      reasonCode,
    });

    return Response.json({ sessionsEnded });
  });
}
