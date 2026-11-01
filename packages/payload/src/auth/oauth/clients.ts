// Static client registration (ADR 0016). Amazon supports neither dynamic
// registration nor client ID metadata documents, so `alexa` and `nyc-mon-sim`
// come from env and are written to the provider's `oauthClient` table at
// boot, with their `oauthClientResource` links to the MCP resource. The
// provider's admin create endpoint (`adminCreateOAuthClient`) always
// generates the client_id, so it cannot register a fixed id; this plugin
// writes the rows through Better Auth's adapter instead.
import type { BetterAuthPlugin } from 'better-auth';
import { ALL_SCOPES, SERVICE_SCOPE, type StaticClient } from './config';

/** SHA-256, base64url without padding. Passed to the provider as `storeClientSecret.hash`. */
export async function hashClientSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Buffer.from(digest).toString('base64url');
}

/** The subset of Better Auth's `DBAdapter` the seed uses. */
export interface SeedAdapter {
  findOne<T>(args: { model: string; where: { field: string; value: string }[] }): Promise<T | null>;
  create<T extends Record<string, unknown>>(args: { model: string; data: T; forceAllowId?: boolean }): Promise<unknown>;
  update<T>(args: { model: string; where: { field: string; value: string }[]; update: Record<string, unknown> }): Promise<T | null>;
}

/** The `oauthClient` row for one static client, in the provider's schema field names. */
export async function clientRow(client: StaticClient, now: Date): Promise<Record<string, unknown>> {
  const secret = client.clientSecret;
  const isPublic = secret === undefined;
  return {
    clientId: client.clientId,
    clientSecret: isPublic ? null : await hashClientSecret(secret),
    name: client.name,
    disabled: false,
    skipConsent: false,
    scopes: ALL_SCOPES.filter((scope) => scope !== SERVICE_SCOPE),
    clientCredentialsScopes: client.grantTypes.includes('client_credentials') ? [SERVICE_SCOPE] : [],
    redirectUris: [...client.redirectUris],
    grantTypes: [...client.grantTypes],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: isPublic ? 'none' : 'client_secret_basic',
    requirePKCE: true,
    updatedAt: now,
  };
}

/**
 * Upserts each client and its resource link. Idempotent: a restart rewrites
 * the same values, so env is the source of truth (a rotated secret or a new
 * redirect URI takes effect on the next boot).
 */
export async function seedStaticClients(
  adapter: SeedAdapter,
  clients: readonly StaticClient[],
  resource: string,
  now: Date = new Date(),
): Promise<void> {
  for (const client of clients) {
    const row = await clientRow(client, now);
    const where = [{ field: 'clientId', value: client.clientId }];
    const existing = await adapter.findOne<Record<string, unknown>>({ model: 'oauthClient', where });
    if (existing === null) {
      await adapter.create({ model: 'oauthClient', data: { ...row, createdAt: now } });
    } else {
      await adapter.update({ model: 'oauthClient', where, update: row });
    }
    const link = await adapter.findOne({
      model: 'oauthClientResource',
      where: [
        { field: 'clientId', value: client.clientId },
        { field: 'resourceId', value: resource },
      ],
    });
    if (link === null) {
      await adapter.create({ model: 'oauthClientResource', data: { clientId: client.clientId, resourceId: resource, createdAt: now } });
    }
  }
}

/**
 * Seeds the static clients when Better Auth starts. A failure is logged, not
 * thrown: a missing table (migration not applied) should break linking, not
 * the admin console.
 */
export function staticOAuthClients(options: { clients: readonly StaticClient[]; resource: string | undefined }) {
  return {
    id: 'nycmon-static-oauth-clients',
    init: async (ctx) => {
      if (options.resource === undefined || options.clients.length === 0) return;
      try {
        await seedStaticClients(ctx.adapter as unknown as SeedAdapter, options.clients, options.resource);
      } catch (error) {
        console.error('[auth] seeding OAuth clients failed; Alexa+ linking will not work', error);
      }
    },
  } satisfies BetterAuthPlugin;
}
