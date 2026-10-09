import type { IncomingMessage, ServerResponse } from 'node:http';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import { buildPrm, prmPathsFor } from '../auth/prm.ts';
import { authenticateRequest, decideAccess, devBypassAuth, type RequestAuth } from '../auth/request-auth.ts';
import type { TokenVerifier } from '../auth/verifier.ts';
import type { CallerData } from '../data/caller.ts';
import type { FamiliarDirectory } from '../presence/fixtures.ts';
import type { PresenceService } from '../presence/service.ts';
import { registerTools, type ToolContext } from './tools.ts';
import type { McpAppsRegistration } from './ui-seam.ts';

/**
 * Handshake-era protocol versions served (PLATFORM-DOCS §3.1): Alexa+ sends
 * `2025-03-26`, the Local Inspector `2025-06-18`, the spec floor is
 * `2025-11-25`. The stateless 2026-07-28 revision is not served on this
 * endpoint; a client offering an unknown version is answered with 2025-11-25.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;

const MAX_BODY_BYTES = 1_000_000;

export interface ServerDeps {
  /** The exact `/mcp` URL: PRM `resource`, token audience, manifest URI. */
  readonly resourceUrl: string;
  /** The issuer listed first (and only) in PRM `authorization_servers`. */
  readonly authorizationServer: string;
  /** Exact browser origins allowed besides the resource URL's own origin. */
  readonly allowedOrigins: readonly string[];
  /** Token validation, or `dev-bypass` for local and simulator development only. */
  readonly verifier: TokenVerifier | 'dev-bypass';
  readonly data: CallerData;
  readonly presence: PresenceService;
  /** Seeded fixtures; set only in dev mode, which also registers the dev tools. */
  readonly familiar?: FamiliarDirectory;
  /** Lane C's MCP Apps views. See `ui-seam.ts`. */
  readonly ui?: McpAppsRegistration;
  readonly now?: () => number;
}

class BodyError extends Error {
  readonly status: number;
  readonly rpcCode: number;

  constructor(status: number, rpcCode: number, message: string) {
    super(message);
    this.status = status;
    this.rpcCode = rpcCode;
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new BodyError(413, -32600, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new BodyError(400, -32700, 'Parse error'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Builds the `node:http` request handler for the MCP endpoint and its well-known documents. */
export function createHandler(deps: ServerDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const resource = new URL(deps.resourceUrl);
  const prm = buildPrm({ resource: deps.resourceUrl, authorizationServer: deps.authorizationServer });
  const prmPaths = new Set(prmPathsFor(deps.resourceUrl));
  const allowedOrigins = new Set([resource.origin, ...deps.allowedOrigins.map((o) => new URL(o).origin)]);
  const now = deps.now ?? Date.now;

  return async function handle(req, res) {
    const url = new URL(req.url ?? '/', resource.origin);

    // MCP 2025-11-25 transports: validate Origin on every request; 403 when
    // present and not allowed. Alexa's server-to-server calls send none.
    const origin = req.headers.origin;
    if (origin !== undefined) {
      if (!allowedOrigins.has(origin)) return sendJson(res, 403, { error: 'forbidden_origin' });
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-expose-headers', 'mcp-protocol-version');
    }

    if (req.method === 'GET' && prmPaths.has(url.pathname)) return sendJson(res, 200, prm);
    if (req.method === 'GET' && url.pathname === '/healthz') return sendJson(res, 200, { ok: true });
    if (url.pathname !== resource.pathname) return sendJson(res, 404, { error: 'not_found' });

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id',
        'access-control-max-age': '600',
      });
      res.end();
      return;
    }

    let body: unknown;
    if (req.method === 'POST') {
      try {
        body = await readJsonBody(req);
      } catch (error) {
        if (error instanceof BodyError) {
          return sendJson(res, error.status, { jsonrpc: '2.0', id: null, error: { code: error.rpcCode, message: error.message } });
        }
        throw error;
      }
    }

    const auth: RequestAuth =
      deps.verifier === 'dev-bypass' ? devBypassAuth(now()) : await authenticateRequest(req.headers.authorization, deps.verifier);
    // Amazon: 401 with no WWW-Authenticate header (PLATFORM-DOCS §2.3). Clients
    // find the PRM at the well-known path, which the MCP spec allows.
    const decision = decideAccess(auth, body);
    if (decision !== 'allow') {
      return sendJson(res, decision, { error: decision === 401 ? 'unauthorized' : 'insufficient_scope' });
    }

    const ctx: ToolContext = {
      callerId: auth.kind === 'user' ? auth.callerId : undefined,
      birthYear: auth.kind === 'user' ? auth.birthYear : undefined,
      data: deps.data,
      presence: deps.presence,
      familiar: deps.familiar,
      now,
    };

    // Stateless Streamable HTTP: one server and transport per request. Alexa
    // keeps conversation state itself and never relies on Mcp-Session-Id
    // (PLATFORM-DOCS §2.6), and a per-request server binds this request's
    // verified Caller into every tool with no shared mutable session.
    const server = new McpServer(
      { name: 'nyc-mon', title: 'NYC-MON', version: '0.1.0' },
      {
        supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
        instructions:
          "NYC-MON tools read and care for the Caller's Mon. Tools return data only; phrase every reply yourself. Never read ids or numbers from 0 to 1 aloud as-is.",
      },
    );
    deps.ui?.registerResources(server);
    registerTools(server, ctx, deps.ui);

    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  };
}
