import { postgresAdapter } from '@payloadcms/db-postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  betterAuthCollections,
  createBetterAuthPlugin,
  payloadAdapter,
} from '@delmaredigital/payload-better-auth';
import { betterAuth } from 'better-auth';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { deleteDueCallersTask } from './auth/deletion';
import { AUTH_BASE_PATH, PAYLOAD_API_ROUTE, PAYLOAD_ORIGINS, betterAuthOptions, sendMail } from './auth/options';
import { accountMerge } from './auth/plugins/account-merge';
import { STAFF_ROLES } from './collections/access/roles';
import { adminComponents } from './admin/components';
import { Users } from './collections/Users';
import { Media } from './collections/Media';
import { AuditEvents } from './collections/AuditEvents';
import { CareStates } from './collections/CareStates';
import { Eggs } from './collections/Eggs';
import { GuardianConsents } from './collections/GuardianConsents';
import { IntegrityRuns } from './collections/IntegrityRuns';
import { MonInstances } from './collections/MonInstances';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

export default buildConfig({
  admin: {
    user: Users.slug,
    components: adminComponents,
    importMap: {
      baseDir: dirname,
      // The admin is served by apps/admin-vite (docs/adr/0003-admin-app-split.md).
      importMapFile: path.resolve(dirname, '../../../apps/admin-vite/src/routes/_payload/importMap.js'),
    },
  },
  routes: {
    api: PAYLOAD_API_ROUTE,
  },
  collections: [Users, Media, GuardianConsents, Eggs, MonInstances, CareStates, AuditEvents, IntegrityRuns],
  plugins: [
    // Generates Better Auth's session, account, verification and passkey
    // collections; `users` is written by hand in collections/Users.ts.
    betterAuthCollections({
      betterAuthOptions,
      skipCollections: ['user'],
      // The first account in a dev database becomes ops so the console is
      // reachable. Never in production: the first Caller to sign up would
      // become staff. The plugin's role guard goes with it, which is safe
      // because users.access.create and the role field allow ops alone and
      // Better Auth's `role` has `input: false` (ADR 0004 §8, finding 12).
      ...(isProduction
        ? { firstUserAdmin: false, acknowledgeRoleGuardDisabled: true }
        : { firstUserAdmin: { adminRole: 'ops', defaultRole: 'user' } }),
    }),
    createBetterAuthPlugin({
      authBasePath: AUTH_BASE_PATH,
      admin: {
        login: {
          // Any one staff role opens the console (ADR 0004 §8).
          requiredRole: [...STAFF_ROLES],
          requireAllRoles: false,
          enableSignUp: false,
          enablePasskey: true,
        },
        // Staff manage 2FA and passkeys in the console's own Settings view.
        enableManagementUI: false,
      },
      createAuth: (payload) =>
        betterAuth({
          ...betterAuthOptions,
          // The merge moves eggs and Mons through the Local API, so it needs
          // the live Payload; it adds no schema, so the collection generator
          // above does not need to see it.
          plugins: [...betterAuthOptions.plugins, accountMerge({ payload, sendMail })],
          database: payloadAdapter({ payloadClient: payload }),
        }),
    }),
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
      max: 8,
      connectionTimeoutMillis: 10_000,
      query_timeout: 30_000,
    },
    push: process.env.PAYLOAD_PUSH === 'true',
    schemaName: 'payload',
  }),
  jobs: {
    // Account deletion after the 7-day grace (ADR 0001 as amended by L3).
    tasks: [deleteDueCallersTask],
  },
  cors: PAYLOAD_ORIGINS,
  csrf: PAYLOAD_ORIGINS,
  secret: process.env.PAYLOAD_SECRET || '',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});
