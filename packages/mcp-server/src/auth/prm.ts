import { z } from 'zod';

/**
 * RFC 9728 Protected Resource Metadata (ADR 0006 §3).
 *
 * Two halves, both derived from one config so the 401 challenge and the
 * well-known document can never drift:
 *   1. `GET /.well-known/oauth-protected-resource` → JSON document.
 *   2. `WWW-Authenticate: Bearer resource_metadata="<url>"` on any 401.
 *
 * Spec: https://www.rfc-editor.org/rfc/rfc9728
 */
export const ProtectedResourceMetadataSchema = z.object({
  /** Canonical URL of this MCP server — the `resource` clients bind tokens to. */
  resource: z.string().url(),
  /** Issuers allowed to mint tokens for this resource — the admin-vite auth host. */
  authorization_servers: z.array(z.string().url()).min(1),
  bearer_methods_supported: z.array(z.literal('header')).default(['header']),
  scopes_supported: z.array(z.string()),
  resource_name: z.string().optional(),
  resource_documentation: z.string().url().optional(),
});
export type ProtectedResourceMetadata = z.infer<typeof ProtectedResourceMetadataSchema>;

/** MCP scopes (ADR 0006 §5 — coarse on purpose; the per-person matrix is data). */
export const MCP_SCOPES = ['mcp:care', 'mcp:caller'] as const;

export function buildPrm(input: { resource: string; authorizationServers: string[] }): ProtectedResourceMetadata {
  return ProtectedResourceMetadataSchema.parse({
    resource: input.resource,
    authorization_servers: input.authorizationServers,
    bearer_methods_supported: ['header'],
    scopes_supported: [...MCP_SCOPES],
    resource_name: 'NYC-MON Alexa+ MCP',
    resource_documentation: 'https://github.com/mikevocalz/nyc-mon/tree/main/docs/architecture/system-design.md',
  });
}

/** `/.well-known/oauth-protected-resource` route shape. */
export const PRM_PATH = '/.well-known/oauth-protected-resource' as const;

/** RFC 9728 §5.3: the 401 challenge that tells clients where the PRM lives. */
export function bearerChallenge(resourceOrigin: string): string {
  return `Bearer resource_metadata="${resourceOrigin}${PRM_PATH}"`;
}
