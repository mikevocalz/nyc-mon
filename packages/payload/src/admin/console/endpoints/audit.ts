import type { PayloadRequest, Where } from 'payload';
import { writeAuditEvent } from '../../../collections/audit/writeAuditEvent.ts';
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../../../collections/audit/codes.ts';
import { requireStaff } from './helpers.ts';

function escapeCsvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function parseDateParam(value: string | null): string | undefined {
  if (value === null) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function buildWhere(req: PayloadRequest): Where {
  const and: Where[] = [];
  const from = parseDateParam(req.searchParams.get('from'));
  const to = parseDateParam(req.searchParams.get('to'));
  if (from !== undefined) and.push({ at: { greater_than_equal: from } });
  if (to !== undefined) and.push({ at: { less_than_equal: to } });

  const action = req.searchParams.get('action');
  if (action !== null && (AUDIT_ACTIONS as readonly string[]).includes(action)) {
    and.push({ action: { equals: action } });
  }
  const targetType = req.searchParams.get('targetType');
  if (targetType !== null && (AUDIT_TARGET_TYPES as readonly string[]).includes(targetType)) {
    and.push({ targetType: { equals: targetType } });
  }
  const actor = req.searchParams.get('actor');
  if (actor !== null && actor.trim() !== '') {
    const numeric = Number(actor);
    and.push({ actor: { equals: Number.isNaN(numeric) ? actor : numeric } });
  }

  if (and.length === 0) return { id: { exists: true } };
  if (and.length === 1) return and[0]!;
  return { and };
}

export async function exportAuditLog(req: PayloadRequest): Promise<Response> {
  requireStaff(req, ['ops']);

  const where = buildWhere(req);
  const rows: string[] = ['at,actorRole,action,targetType,targetId,reasonCode,requestId'];
  let page = 1;
  const pageSize = 1000;
  let total = 0;

  do {
    const result = await req.payload.find({
      collection: 'audit-events',
      where,
      sort: '-at',
      limit: pageSize,
      page,
      depth: 0,
      overrideAccess: true,
      req,
    });
    const docs = result.docs as unknown as Record<string, unknown>[];
    for (const doc of docs) {
      rows.push(
        [
          doc.at,
          doc.actorRole,
          doc.action,
          doc.targetType,
          doc.targetId,
          doc.reasonCode ?? '',
          doc.requestId ?? '',
        ]
          .map(escapeCsvCell)
          .join(','),
      );
    }
    total = result.totalDocs;
    page += 1;
  } while ((page - 1) * pageSize < total);

  await writeAuditEvent(req, {
    action: 'audit.exported',
    targetType: 'audit',
    targetId: 'export',
  });

  const csv = rows.join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-log.csv"',
    },
  });
}
