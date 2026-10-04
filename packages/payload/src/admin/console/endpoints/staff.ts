import type { PayloadRequest } from 'payload';
import type { StaffRole } from '../../../collections/access/roles.ts';
import { STAFF_ROLES } from '../../../collections/access/roles.ts';
import { writeAuditEvent } from '../../../collections/audit/writeAuditEvent.ts';
import { ConsoleError } from './errors.ts';
import { idParam, readBody, readReasonCode, requireStaff, withTransaction } from './helpers.ts';

function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

async function loadUser(req: PayloadRequest, id: string): Promise<Record<string, unknown>> {
  const numeric = Number(id);
  const doc = await req.payload.findByID({
    collection: 'users',
    id: Number.isNaN(numeric) ? id : numeric,
    depth: 0,
    overrideAccess: true,
    req,
  });
  if (doc === null || doc === undefined) {
    throw new ConsoleError('NOT_FOUND', 404, 'Staff member not found.');
  }
  return doc as unknown as Record<string, unknown>;
}

function readRole(data: Record<string, unknown> | undefined): StaffRole {
  const raw = data?.role;
  if (typeof raw !== 'string' || !isStaffRole(raw)) {
    throw new ConsoleError('INVALID_RECORD', 400, 'role must be a recognised staff role.');
  }
  return raw;
}

async function countOtherOps(req: PayloadRequest, excludeId: string | number): Promise<number> {
  const { totalDocs } = await req.payload.count({
    collection: 'users',
    where: {
      and: [
        { role: { equals: 'ops' } },
        { id: { not_equals: excludeId } },
      ],
    },
    overrideAccess: true,
    req,
  });
  return totalDocs;
}

function assertLastOps(remainingOps: number): void {
  if (remainingOps === 0) {
    throw new ConsoleError('LAST_OPS', 409, 'Cannot remove or deactivate the last ops staff member.');
  }
}

export async function createStaff(req: PayloadRequest): Promise<Response> {
  requireStaff(req, ['ops']);
  const body = await readBody(req);

  return withTransaction(req, async () => {
    const email = body?.email;
    if (typeof email !== 'string' || email.trim() === '') {
      throw new ConsoleError('INVALID_RECORD', 400, 'email is required.');
    }
    const role = readRole(body);

    const user = await req.payload.create({
      collection: 'users',
      data: { email: email.trim(), role },
      depth: 0,
      user: req.user,
      overrideAccess: false,
      req,
    });

    await writeAuditEvent(req, {
      action: 'staff.added',
      targetType: 'staff',
      targetId: String((user as unknown as Record<string, unknown>).id),
    });

    return Response.json({ user });
  });
}

export async function updateStaff(req: PayloadRequest): Promise<Response> {
  requireStaff(req, ['ops']);
  const id = idParam(req);
  const body = await readBody(req);

  return withTransaction(req, async () => {
    const user = await loadUser(req, id);
    if (!isStaffRole(String(user.role))) {
      throw new ConsoleError('NOT_STAFF', 400, 'The user is not a staff member.');
    }

    const newRole = readRole(body);
    const currentRole = user.role as StaffRole;

    if (currentRole === 'ops' && newRole !== 'ops') {
      assertLastOps(await countOtherOps(req, user.id as string | number));
    }

    const updated = await req.payload.update({
      collection: 'users',
      id: user.id as string | number,
      data: { role: newRole },
      depth: 0,
      user: req.user,
      overrideAccess: false,
      req,
    });

    await writeAuditEvent(req, {
      action: 'staff.role_changed',
      targetType: 'staff',
      targetId: String(user.id),
    });

    return Response.json({ user: updated });
  });
}

export async function removeStaff(req: PayloadRequest): Promise<Response> {
  requireStaff(req, ['ops']);
  const id = idParam(req);
  const body = await readBody(req);
  const reasonCode = readReasonCode(body);

  return withTransaction(req, async () => {
    const user = await loadUser(req, id);
    if (!isStaffRole(String(user.role))) {
      throw new ConsoleError('NOT_STAFF', 400, 'The user is not a staff member.');
    }

    if (user.role === 'ops') {
      assertLastOps(await countOtherOps(req, user.id as string | number));
    }

    await req.payload.delete({
      collection: 'users',
      id: user.id as string | number,
      user: req.user,
      overrideAccess: false,
      req,
    });

    await writeAuditEvent(req, {
      action: 'staff.removed',
      targetType: 'staff',
      targetId: String(user.id),
      reasonCode: reasonCode as unknown as undefined,
    });

    return Response.json({});
  });
}
