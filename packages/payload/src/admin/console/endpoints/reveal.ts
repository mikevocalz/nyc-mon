import type { CollectionSlug, PayloadRequest } from 'payload';
import { STAFF_ROLES, type StaffRole } from '../../../collections/access/roles.ts';
import type { AuditReasonCode, AuditTargetType } from '../../../collections/audit/codes.ts';
import { REVEAL_CONTEXT_KEY } from '../../../collections/audit/reveal.ts';
import { ConsoleError } from './errors.ts';
import { readBody, readReasonCode, requireStaff, withTransaction } from './helpers.ts';

interface RevealTarget {
  collection: CollectionSlug;
  idField: 'id' | 'monInstanceId' | 'eggId';
  fields: readonly string[];
  roles: readonly StaffRole[];
}

const REVEAL_TARGETS: Readonly<Record<AuditTargetType, RevealTarget | undefined>> = {
  caller: {
    collection: 'users',
    idField: 'id',
    fields: ['email', 'name', 'birthYear'],
    roles: ['ops', 'support'],
  },
  consent: {
    collection: 'guardian-consents',
    idField: 'id',
    fields: ['parentEmail', 'birthYear'],
    roles: ['ops', 'consent'],
  },
  mon: {
    collection: 'mon-instances',
    idField: 'monInstanceId',
    fields: ['nickname'],
    roles: ['ops', 'support'],
  },
  egg: {
    collection: 'eggs',
    idField: 'eggId',
    fields: ['nickname'],
    roles: ['ops', 'support'],
  },
  staff: undefined,
  audit: undefined,
  integrity: undefined,
};

function targetFrom(body: Record<string, unknown> | undefined): {
  target: RevealTarget;
  targetId: string;
  field: string;
  reasonCode: AuditReasonCode | undefined;
} {
  if (body === undefined) {
    throw new ConsoleError('INVALID_RECORD', 400, 'Request body is missing or invalid.');
  }
  const targetType = body.targetType;
  if (typeof targetType !== 'string') {
    throw new ConsoleError('INVALID_RECORD', 400, 'targetType is required.');
  }
  const target = REVEAL_TARGETS[targetType as AuditTargetType];
  if (target === undefined) {
    throw new ConsoleError('NOT_FOUND', 404, 'That target type cannot be revealed.');
  }
  const targetId = body.targetId;
  if (typeof targetId !== 'string' || targetId === '') {
    throw new ConsoleError('INVALID_RECORD', 400, 'targetId is required.');
  }
  const field = body.field;
  if (typeof field !== 'string' || !target.fields.includes(field)) {
    throw new ConsoleError('NOT_FOUND', 404, 'That field cannot be revealed on this target.');
  }
  const reasonCode = readReasonCode(body);
  if (reasonCode === undefined) {
    throw new ConsoleError('INVALID_RECORD', 400, 'reasonCode is required.');
  }
  return { target, targetId, field, reasonCode };
}

export async function handleReveal(req: PayloadRequest): Promise<Response> {
  requireStaff(req, STAFF_ROLES);
  const body = await readBody(req);
  const { target, targetId, field, reasonCode } = targetFrom(body);
  requireStaff(req, target.roles);

  return withTransaction(req, async () => {
    req.context[REVEAL_CONTEXT_KEY] = {
      collection: target.collection,
      field,
      reasonCode,
    };

    let doc: Record<string, unknown> | undefined;
    if (target.idField === 'id') {
      const id = Number(targetId);
      doc = (await req.payload.findByID({
        collection: target.collection,
        id: Number.isNaN(id) ? targetId : id,
        depth: 0,
        user: req.user,
        overrideAccess: false,
        req,
      })) as unknown as Record<string, unknown> | undefined;
    } else {
      const result = await req.payload.find({
        collection: target.collection,
        where: { [target.idField]: { equals: targetId } },
        limit: 1,
        depth: 0,
        user: req.user,
        overrideAccess: false,
        req,
      });
      doc = result.docs[0] as unknown as Record<string, unknown> | undefined;
    }

    if (doc === undefined || !(field in doc)) {
      throw new ConsoleError('AUDIT_WRITE_FAILED', 500, 'The value could not be revealed.');
    }
    const value = doc[field];
    return Response.json({ value });
  });
}
