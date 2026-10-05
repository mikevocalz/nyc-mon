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
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage';
import sharp from 'sharp';
import { AUTH_BASE_PATH, PAYLOAD_API_ROUTE, PAYLOAD_ORIGINS, betterAuthOptions } from './auth/options';
import { adminComponents } from './admin/components';
import { Users } from './collections/Users';
import { Media } from './collections/Media';
import { bunnyStorage } from './storage/bunnyStorage';
import { AuditEvents } from './collections/AuditEvents';
import { CareStates } from './collections/CareStates';
import { Eggs } from './collections/Eggs';
import { GuardianConsents } from './collections/GuardianConsents';
import { IntegrityRuns } from './collections/IntegrityRuns';
import { MonInstances } from './collections/MonInstances';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const bunnyConfigured = Boolean(
  process.env.BUNNY_STORAGE_ZONE &&
    process.env.BUNNY_STORAGE_PASSWORD &&
    process.env.BUNNY_CDN_URL,
);

if (process.env.NODE_ENV === 'production' && !bunnyConfigured) {
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
  collections: [Users, Media, GuardianConsents, Eggs, MonInstances, CareStates, AuditEvents, IntegrityRuns],
  plugins: [
    cloudStoragePlugin({
      enabled: bunnyConfigured,
      collections: {
        [Media.slug]: {
          adapter: bunnyStorage({
            zone: process.env.BUNNY_STORAGE_ZONE || '',
            accessKey: process.env.BUNNY_STORAGE_PASSWORD || '',
            cdnUrl: process.env.BUNNY_CDN_URL || '',
            region: process.env.BUNNY_STORAGE_REGION || 'ny',
          }),
          disableLocalStorage: true,
          disablePayloadAccessControl: true,
        },
      },
    }),
    // Generates Better Auth's session, account, verification and passkey
    // collections; `users` is written by hand in collections/Users.ts.
    betterAuthCollections({ betterAuthOptions, skipCollections: ['user'] }),
    createBetterAuthPlugin({
      authBasePath: AUTH_BASE_PATH,
      createAuth: (payload) =>
        betterAuth({
          ...betterAuthOptions,
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
  cors: PAYLOAD_ORIGINS,
  csrf: PAYLOAD_ORIGINS,
  secret: process.env.PAYLOAD_SECRET || '',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});
