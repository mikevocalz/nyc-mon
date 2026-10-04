import type { Access, FieldAccess, PayloadRequest } from 'payload';

/**
 * Staff roles the console's access rules read from `users.role`.
 *
 * The names are Decision 22 (`docs/canon/DECISIONS.md`): `ops`, `support`,
 * `consent`, `content`, one role per staff member. `users.role` carries them
 * (ADR 0004 §8); Callers hold `user`.
 */
export const STAFF_ROLES = ['ops', 'support', 'consent', 'content'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * The staff role of a signed-in user, or `undefined` for a Caller, an
 * anonymous request or an unknown value. Reads the default `role` field.
 */
export function readStaffRole(user: unknown): StaffRole | undefined {
  if (typeof user !== 'object' || user === null || !('role' in user)) return undefined;
  const role = user.role;
  if (typeof role !== 'string') return undefined;
  return isStaffRole(role) ? role : undefined;
}

/** The staff user's id, or `undefined` when the request has no staff user. */
export function readStaffId(user: unknown): string | number | undefined {
  if (readStaffRole(user) === undefined) return undefined;
  if (typeof user !== 'object' || user === null || !('id' in user)) return undefined;
  const id = user.id;
  return typeof id === 'string' || typeof id === 'number' ? id : undefined;
}

/** True when the request's user holds one of `roles`. */
export function hasStaffRole(req: Pick<PayloadRequest, 'user'>, roles: readonly StaffRole[]): boolean {
  const role = readStaffRole(req.user);
  return role !== undefined && roles.includes(role);
}

/** Collection access: allow the listed staff roles, deny everyone else. */
export function staffRoles(roles: readonly StaffRole[]): Access {
  return ({ req }) => hasStaffRole(req, roles);
}

/**
 * Collection access that no request passes. Writes to these collections come
 * only from server code (`/v1` handlers, console endpoints, hooks) running the
 * Local API with `overrideAccess: true` and the request's `req`.
 */
export const nobody: Access = () => false;

/** Field access that no request passes; see {@link nobody}. */
export const nobodyField: FieldAccess = () => false;
