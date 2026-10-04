import { addDataAndFileToRequest, commitTransaction, initTransaction, killTransaction } from 'payload';
import type { PayloadRequest } from 'payload';
import { hasStaffRole, type StaffRole } from '../../../collections/access/roles.ts';
import { isAuditReasonCode, type AuditReasonCode } from '../../../collections/audit/codes.ts';
import { ConsoleError } from './errors.ts';

/** Body as a plain object; missing or unparseable bodies become `undefined`. */
export async function readBody(req: PayloadRequest): Promise<Record<string, unknown> | undefined> {
  if (req.method === 'GET') return undefined;
  if (req.data === undefined) {
    try {
      await addDataAndFileToRequest(req);
    } catch {
      return undefined;
    }
  }
  const data = req.data;
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;
}

export function requireStaff(req: PayloadRequest, roles: readonly StaffRole[]): void {
  if (!hasStaffRole(req, roles)) {
    throw new ConsoleError('FORBIDDEN_ROLE', 403, 'This action requires a staff role.');
  }
}

export function idParam(req: PayloadRequest): string {
  const raw = req.routeParams?.id;
  if (typeof raw !== 'string' || raw === '') {
    throw new ConsoleError('NOT_FOUND', 404, 'Missing record id.');
  }
  return raw;
}

export function readReasonCode(data: Record<string, unknown> | undefined): AuditReasonCode | undefined {
  const raw = data?.reasonCode;
  if (raw === undefined || raw === null) return undefined;
  if (!isAuditReasonCode(raw)) {
    throw new ConsoleError('INVALID_RECORD', 400, 'reasonCode is not a recognised code.');
  }
  return raw;
}

export async function withTransaction<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T> {
  const ownTransaction = await initTransaction(req);
  try {
    const result = await fn();
    if (ownTransaction) await commitTransaction(req);
    return result;
  } catch (error) {
    if (ownTransaction) await killTransaction(req);
    throw error;
  }
}
