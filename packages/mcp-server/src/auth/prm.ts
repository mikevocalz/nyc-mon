import { z } from 'zod';

/**
 * RFC 9728 Protected Resource Metadata (ADR 0006 §3, PLATFORM-DOCS §2.5).
 *
 * Alexa reads the document at the root well-known path and uses only the
 * first `authorization_servers` entry. `resource` must equal the add-on
 * manifest URI exactly, so it is the full `/mcp` URL, never an origin.
 * Spec: https://www.rfc-editor.org/rfc/rfc9728
 */
export const ProtectedResourceMetadataSchema = z.object({
  resource: z.url(),
  authorization_servers: z.array(z.url()).min(1),
  bearer_methods_supported: z.array(z.literal('header')),
  scopes_supported: z.array(z.string()),
  resource_name: z.string().optional(),
  resource_documentation: z.url().optional(),
});
export type ProtectedResourceMetadata = z.infer<typeof ProtectedResourceMetadataSchema>;

/**
 * Scopes, matching the issuer's contract (lane B, docs/alexa/AUTH.md) and
 * Amazon's two tiers (PLATFORM-DOCS §2.4):
 * - `mcp:service` rides on a client_credentials token and opens discovery
 *   only (initialize, tools/list, resources). It never reaches Caller data.
 * - `mcp:caller` (read the linked Caller's Mons) and `mcp:care` (the four care
 *   actions) ride on an authorization-code token for one Caller.
 * Alexa shows every listed scope to the customer at linking.
 */
export const SERVICE_SCOPE = 'mcp:service';
export const CALLER_SCOPE = 'mcp:caller';
export const CARE_SCOPE = 'mcp:care';
export const USER_SCOPES = [CALLER_SCOPE, CARE_SCOPE] as const;
export const MCP_SCOPES = [SERVICE_SCOPE, CALLER_SCOPE, CARE_SCOPE] as const;

/** The RFC 9728 root well-known path Alexa requests. */
export const PRM_PATH = '/.well-known/oauth-protected-resource' as const;

/** The resource URL's path appended to the well-known path, for RFC 9728 §3.1 clients. */
export function prmPathsFor(resourceUrl: string): readonly string[] {
  const path = new URL(resourceUrl).pathname.replace(/\/$/, '');
  return path === '' ? [PRM_PATH] : [PRM_PATH, `${PRM_PATH}${path}`];
}

export function buildPrm(input: { resource: string; authorizationServer: string }): ProtectedResourceMetadata {
  return ProtectedResourceMetadataSchema.parse({
    resource: input.resource,
    authorization_servers: [input.authorizationServer],
    bearer_methods_supported: ['header'],
    scopes_supported: [...MCP_SCOPES],
    resource_name: 'NYC-MON',
    resource_documentation: 'https://github.com/mikevocalz/nyc-mon/tree/main/docs/architecture/system-design.md',
  });
}
