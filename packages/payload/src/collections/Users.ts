import { betterAuthStrategy } from '@delmaredigital/payload-better-auth';
import type { Access, CollectionConfig, FieldAccess } from 'payload';
import { hasStaffRole, readStaffRole, STAFF_ROLES } from './access/roles.ts';

// Better Auth owns sign-in (ADR 0001). This collection is Better Auth's `user`
// model, written by hand so it can carry the Caller's birth year and consent
// state; every field Better Auth or one of its plugins writes must exist here
// with the plugin's name (ADR 0004 §1).

/** `users.role` values: every Caller is `user`; staff hold exactly one staff role (DECISIONS #22). */
export const USER_ROLES = ['user', ...STAFF_ROLES] as const;

/** Staff who may sign in to the console when a second factor is also required. */
const requireStaffTwoFactor = process.env.AUTH_STAFF_REQUIRE_TWO_FACTOR === 'true';

const isOps: Access = ({ req }) => hasStaffRole(req, ['ops']);
const isOpsField: FieldAccess = ({ req }) => hasStaffRole(req, ['ops']);
const canManageCallers: FieldAccess = ({ req }) => hasStaffRole(req, ['ops', 'support']);

/** A Caller reads and edits their own row; ops reads any. Other staff go through the console's reveal endpoint. */
const opsOrSelf: Access = ({ req }) => {
  if (hasStaffRole(req, ['ops'])) return true;
  const id = req.user?.id;
  return id === undefined ? false : { id: { equals: id } };
};

/**
 * The console admits staff only (ADR 0004 §8). With
 * AUTH_STAFF_REQUIRE_TWO_FACTOR=true it also needs 2FA on the account; that
 * switch stays off until the console's Settings view can enrol TOTP, so no
 * staff member is locked out with no way to enrol.
 */
const canUseAdmin = ({ req }: { req: { user?: unknown } }): boolean => {
  if (readStaffRole(req.user) === undefined) return false;
  if (!requireStaffTwoFactor) return true;
  const user = req.user;
  return typeof user === 'object' && user !== null && 'twoFactorEnabled' in user && user.twoFactorEnabled === true;
};

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    disableLocalStrategy: true,
    strategies: [betterAuthStrategy()],
  },
  admin: { useAsTitle: 'email' },
  access: {
    // Accounts are created by Better Auth through the adapter (overrideAccess);
    // nobody creates one over REST. This is what lets `firstUserAdmin` stay off
    // in production without opening role self-assignment (ADR 0004 finding 12).
    create: isOps,
    read: opsOrSelf,
    update: opsOrSelf,
    delete: isOps,
    admin: canUseAdmin,
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'emailVerified', type: 'checkbox', defaultValue: false },
    { name: 'name', type: 'text' },
    { name: 'image', type: 'text' },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'user',
      options: [...USER_ROLES],
      access: { create: isOpsField, update: isOpsField },
    },
    { name: 'birthYear', type: 'number', min: 1900 },
    {
      name: 'consentStatus',
      type: 'select',
      defaultValue: 'not-required',
      // Mirrors ConsentStatusSchema in @acme/core (schemas/caller.ts).
      options: ['not-required', 'pending', 'approved', 'denied'],
      access: { create: isOpsField, update: isOpsField },
    },
    {
      // Second guardian approval for phone features after the Caller turns 13
      // (DECISIONS #21). Set only by the consent flow.
      name: 'phoneConsentAt',
      type: 'date',
      access: { create: isOpsField, update: isOpsField },
    },
    // twoFactor plugin (better-auth/plugins/two-factor, schema.mjs).
    { name: 'twoFactorEnabled', type: 'checkbox', defaultValue: false },
    {
      // Where 2FA one-time codes go; SMS only when the phone gate passes (ADR 0004 §1).
      name: 'twoFactorOtpChannel',
      type: 'select',
      defaultValue: 'email',
      options: ['email', 'sms'],
    },
    // phoneNumber plugin (better-auth/plugins/phone-number, schema.mjs).
    { name: 'phoneNumber', type: 'text', unique: true, index: true },
    { name: 'phoneNumberVerified', type: 'checkbox', defaultValue: false },
    // username plugin (better-auth/plugins/username, schema).
    { name: 'username', type: 'text', unique: true, index: true },
    { name: 'displayUsername', type: 'text' },
    {
      // The Mon Home shows when the Caller has more than one (DECISIONS #18).
      // Null means Home asks.
      name: 'activeMonInstanceId',
      type: 'text',
      maxLength: 128,
    },
    {
      // Account deletion (M20 and the console): set to server time + 7 days;
      // the deletion task runs when it passes (ADR 0001 as amended by L3).
      name: 'deletionScheduledFor',
      type: 'date',
      index: true,
      access: { update: canManageCallers },
    },
  ],
};
