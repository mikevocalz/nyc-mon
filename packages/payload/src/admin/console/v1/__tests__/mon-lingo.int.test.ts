// Opt-in: set MON_LINGO_DATABASE_URL to a database that ran every migration
// (`pnpm payload:migrate` in apps/admin-vite). Checks that what Payload serves
// after the seed migration is exactly the bundled offline fallback.
import { FALLBACK_MON_LINGO } from '@acme/content/lingo';
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readMonLingoFromPayload } from '../mon-lingo.ts';

const url = process.env.MON_LINGO_DATABASE_URL;

describe.skipIf(url === undefined)('GET /v1/mon-lingo against a migrated Postgres', () => {
  let payload: Payload;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.PAYLOAD_SECRET ??= 'mon-lingo-integration-only';
    const { getPayload } = await import('payload');
    const { default: config } = await import('../../../../payload.config.ts');
    payload = await getPayload({ config });
  }, 120_000);

  afterAll(async () => {
    await payload?.destroy();
  });

  it('serves the seeded rows and voices exactly as the offline fallback plans them', async () => {
    expect(await readMonLingoFromPayload(payload)).toEqual(FALLBACK_MON_LINGO);
  });
});
