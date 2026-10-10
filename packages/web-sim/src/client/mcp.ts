import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  auth,
  discoverOAuthProtectedResourceMetadata,
  type Tool,
} from '@modelcontextprotocol/client';
import { userScopes, type AuthMode, type SimOAuthProvider } from '../shared/auth.ts';

/**
 * The simulator's MCP client: initialize, tools/list, tools/call and
 * resources/read over Streamable HTTP (MCP 2025-11-25), straight from the
 * browser to the NYC-MON MCP server. In OAuth mode the SDK attaches the bearer
 * token, refreshes it, and on a 401 sends the person through sign-in.
 */

export const MCP_APPS_EXTENSION = 'io.modelcontextprotocol/ui';
export const MCP_APP_MIME = 'text/html;profile=mcp-app';

export interface McpSession {
  readonly client: Client;
  readonly tools: Tool[];
  readonly serverName: string;
  close(): Promise<void>;
}

export class SignInRequired extends Error {
  override readonly name = 'SignInRequired';
}

export async function connectMcp(opts: {
  url: string;
  mode: AuthMode;
  provider: SimOAuthProvider;
}): Promise<McpSession> {
  const client = new Client(
    { name: 'nyc-mon-simulator', version: '0.1.0' },
    {
      // Advertise MCP Apps support so the server can attach ui:// views.
      capabilities: { extensions: { [MCP_APPS_EXTENSION]: { mimeTypes: [MCP_APP_MIME] } } } as never,
    },
  );
  const transport = new StreamableHTTPClientTransport(new URL(opts.url), {
    ...(opts.mode === 'oauth' ? { authProvider: opts.provider } : {}),
  });
  try {
    await client.connect(transport);
  } catch (err) {
    if (err instanceof UnauthorizedError) throw new SignInRequired('Sign in to talk to your Mon.');
    throw err;
  }
  const tools: Tool[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  return {
    client,
    tools,
    serverName: client.getServerVersion()?.name ?? 'MCP server',
    close: () => client.close(),
  };
}

/** Start sign-in: discovery + PKCE, then a redirect to the authorization server. */
export async function beginSignIn(url: string, provider: SimOAuthProvider): Promise<void> {
  const prm = await discoverOAuthProtectedResourceMetadata(url);
  const scope = userScopes(prm.scopes_supported);
  await auth(provider, { serverUrl: url, ...(scope ? { scope } : {}) });
}

/** Finish sign-in on /oauth/callback: exchange the code for tokens. */
export async function completeSignIn(url: string, provider: SimOAuthProvider, code: string, iss: string | null): Promise<void> {
  const result = await auth(provider, { serverUrl: url, authorizationCode: code, ...(iss ? { iss } : {}) });
  if (result !== 'AUTHORIZED') throw new Error('Sign-in didn’t finish. Try again.');
}
