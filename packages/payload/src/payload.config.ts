import { postgresAdapter } from '@payloadcms/db-postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  betterAuthCollections,
  createBetterAuthPlugin,
  payloadAdapter,
} from '@delmaredigital/payload-better-auth';
import { betterAuth } from 'better-auth';
import { mcpPlugin } from '@payloadcms/plugin-mcp';
import { APIError, buildConfig } from 'payload';
import { deleteDueCallersTask, selfDeletionOptions } from './auth/deletion';
import { AUTH_BASE_PATH, PAYLOAD_API_ROUTE, PAYLOAD_CORS_ORIGINS, PAYLOAD_ORIGINS, betterAuthOptions, sendMail } from './auth/options';
import { accountMerge } from './auth/plugins/account-merge';
import { adminComponents } from './admin/components';
import { consoleEndpoints } from './admin/console/endpoints';
import { hasStaffRole, STAFF_ROLES } from './collections/access/roles';
import { Users } from './collections/Users';
import { Media } from './collections/Media';
import { AuditEvents } from './collections/AuditEvents';
import { CareStates } from './collections/CareStates';
import { Eggs } from './collections/Eggs';
import { GuardianConsents } from './collections/GuardianConsents';
import { IdempotencyRecords } from './collections/IdempotencyRecords';
import { IntegrityRuns } from './collections/IntegrityRuns';
import { MonInstances } from './collections/MonInstances';
import { MonModels } from './collections/MonModels';
import { LanguageLexicon } from './collections/LanguageLexicon';
import { Waitlist } from './collections/Waitlist';
import { MonVoices } from './globals/MonVoices';
import { siteContentPlugin } from './site-content/plugin';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const bunnyConfigured = Boolean(
  process.env.BUNNY_STORAGE_ZONE &&
    process.env.BUNNY_STORAGE_PASSWORD &&
    process.env.BUNNY_CDN_URL,
);

if (isProduction && !bunnyConfigured) {
  throw new Error('Bunny Storage must be configured in production.');
}

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
  endpoints: consoleEndpoints,
  collections: [Users, Media, GuardianConsents, Eggs, MonInstances, CareStates, AuditEvents, IntegrityRuns, IdempotencyRecords, Waitlist, LanguageLexicon, MonModels],
  // The Mon's voice casting and delivery; its words are in LanguageLexicon.
  globals: [MonVoices],
  plugins: [
    // POST /payload-api/mcp, staff only. Collection access still decides what
    // each role may do (ops and content edit). Files are uploaded in the
    // console, so MCP gets no create or delete.
    mcpPlugin({
      // Replaces the default resolver, which admits any signed-in user and
      // honours ?overrideAccess=true in development.
      overrideGetAuthorizedMCP: async ({ pluginConfig, req }) => {
        const headers = new Headers(req.headers);
        headers.set('DisableAutologin', 'true');
        req.user = (await req.payload.auth({ headers, req })).user;
        if (!hasStaffRole(req, STAFF_ROLES)) throw new APIError('The MCP endpoint is for NYC-MON staff.', 403);
        // The plugin registers its built-in tools on every collection; this
        // endpoint exists for Mon models only.
        const items = pluginConfig.items.filter((item) => item.type !== 'collectionTool' || item.collectionSlug === 'mon-models');
        return { items, overrideAccess: false };
      },
      collections: {
        'mon-models': {
          description: 'One 3D model (GLB) per Mon form, keyed by speciesId. Only approved models reach the game.',
          tools: { create: false, delete: false },
        },
      },
    }),
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
        loginViewComponent: './admin/console/Chrome#ConsoleLogin',
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
          // Self-service deletion (M20): Mons and eggs pass to the sanctuary
          // before Better Auth removes the user (deletion.ts, DECISIONS L3).
          user: { ...betterAuthOptions.user, deleteUser: selfDeletionOptions(payload) },
          database: payloadAdapter({ payloadClient: payload }),
        }),
    }),
    // Opt in on an isolated database after generating/reviewing the additive migration.
    ...(process.env.NYCMON_SITE_EDITOR === '1' ? [siteContentPlugin] : []),
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
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  jobs: {
    // Account deletion after the 7-day grace (ADR 0001 as amended by L3).
    tasks: [deleteDueCallersTask],
  },
  cors: PAYLOAD_CORS_ORIGINS,
  csrf: PAYLOAD_ORIGINS,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});
