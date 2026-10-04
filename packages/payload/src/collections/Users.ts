import { betterAuthStrategy, hasAdminRoles, isAdmin, isAdminField, isAdminOrSelf } from '@delmaredigital/payload-better-auth';
import type { CollectionConfig } from 'payload';

// Better Auth owns sign-in (ADR 0001). This collection is Better Auth's `user`
// model, written by hand so it can carry the Caller's birth year and consent
// state; every field Better Auth writes must exist here.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    disableLocalStrategy: true,
    strategies: [betterAuthStrategy()],
  },
  admin: { useAsTitle: 'email' },
  access: {
    read: isAdminOrSelf(),
    update: isAdminOrSelf(),
    delete: isAdmin(),
    admin: hasAdminRoles(),
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
      options: [
        { label: 'User', value: 'user' },
        { label: 'Admin', value: 'admin' },
      ],
      access: { update: isAdminField() },
    },
    { name: 'birthYear', type: 'number', min: 1900 },
    {
      name: 'consentStatus',
      type: 'select',
      defaultValue: 'not-required',
      // Mirrors ConsentStatusSchema in @acme/core (schemas/caller.ts).
      options: ['not-required', 'pending', 'approved', 'denied'],
      access: { update: isAdminField() },
    },
  ],
};
