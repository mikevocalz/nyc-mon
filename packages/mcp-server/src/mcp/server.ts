import type { IncomingMessage, ServerResponse } from 'node:http';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import { buildPrm, prmPathsFor, USER_SCOPES } from '../auth/prm.ts';
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
  /**
   * Send the RFC 6750 / RFC 9728 `WWW-Authenticate: Bearer resource_metadata=…`
   * challenge on 401 and 403 (MCP_WWW_AUTHENTICATE=1). Off by default: Amazon
   * wants a bare 401 (PLATFORM-DOCS §2.3), and the MCP spec lets clients fall
   * back to the well-known URI. Browser MCP clients read the header first.
   */
  readonly wwwAuthenticate?: boolean;
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

/** After a 413, read and discard at most this much more of the upload, for at most this long. */
const DRAIN_MAX_BYTES = 8 * 1024 * 1024;
const DRAIN_TIMEOUT_MS = 2_000;

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Stop buffering but leave the socket open: destroying it here reset
        // the connection before the 413 below could be written. The handler
        // answers with Connection: close and drops the socket after that.
        req.removeAllListeners('data');
        req.pause();
        reject(new BodyError(413, -32600, 'Request body too large'));
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

/** Headers a browser MCP client must be able to read on a cross-origin answer. */
const EXPOSED_HEADERS = 'mcp-protocol-version, mcp-session-id, www-authenticate';

/**
 * The Bearer challenge for a refused request (RFC 6750 §3, RFC 9728 §5.1).
 * No token: no error code. Bad token: `invalid_token`. Valid token without
 * the needed scope: `insufficient_scope` plus the scopes to ask for.
 */
function bearerChallenge(resourceMetadataUrl: string, reason: 'none' | 'invalid' | 'scope'): string {
  const params = [`resource_metadata="${resourceMetadataUrl}"`];
  if (reason === 'invalid') params.push('error="invalid_token"');
  if (reason === 'scope') params.push('error="insufficient_scope"');
  if (reason !== 'invalid') params.push(`scope="${USER_SCOPES.join(' ')}"`);
  return `Bearer ${params.join(', ')}`;
}

/** Builds the `node:http` request handler for the MCP endpoint and its well-known documents. */
export function createHandler(deps: ServerDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const resource = new URL(deps.resourceUrl);
  const prm = buildPrm({ resource: deps.resourceUrl, authorizationServer: deps.authorizationServer });
  const prmPathList = prmPathsFor(deps.resourceUrl);
  const prmPaths = new Set(prmPathList);
  // RFC 9728 §3.1: the metadata URL for a resource with a path carries that path.
  const resourceMetadataUrl = `${resource.origin}${prmPathList[prmPathList.length - 1]}`;
  const allowedOrigins = new Set([resource.origin, ...deps.allowedOrigins.map((o) => new URL(o).origin)]);
  const now = deps.now ?? Date.now;

  return async function handle(req, res) {
    const url = new URL(req.url ?? '/', resource.origin);

    // RFC 9728 metadata is public and carries no credentials, so any page may
    // read it. Answered before the Origin check: a browser MCP client on any
    // origin needs it to find the authorization server.
    if (prmPaths.has(url.pathname) && (req.method === 'GET' || req.method === 'OPTIONS')) {
      res.setHeader('access-control-allow-origin', '*');
      if (req.method === 'GET') return sendJson(res, 200, prm);
      res.writeHead(204, {
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'mcp-protocol-version, content-type, accept',
        'access-control-max-age': '600',
      });
      res.end();
      return;
    }

    // MCP 2025-11-25 transports: validate Origin on every request; 403 when
    // present and not allowed. Alexa's server-to-server calls send none.
    const origin = req.headers.origin;
    if (origin !== undefined) {
      if (!allowedOrigins.has(origin)) return sendJson(res, 403, { error: 'forbidden_origin' });
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-expose-headers', EXPOSED_HEADERS);
    }

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

    const refuse = (status: 401 | 403, reason: 'none' | 'invalid' | 'scope') => {
      if (deps.wwwAuthenticate === true) res.setHeader('www-authenticate', bearerChallenge(resourceMetadataUrl, reason));
      return sendJson(res, status, { error: status === 401 ? 'unauthorized' : 'insufficient_scope' });
    };

    // Auth runs before the body is read: an anonymous request gets its 401
    // (and challenge) whatever it sent, and an unauthenticated caller cannot
    // make the server buffer a body. Amazon wants that 401 bare (PLATFORM-DOCS
    // §2.3), so the challenge is opt-in through `wwwAuthenticate`.
    const auth: RequestAuth =
      deps.verifier === 'dev-bypass' ? devBypassAuth(now()) : await authenticateRequest(req.headers.authorization, deps.verifier);
    if (auth.kind === 'none' || auth.kind === 'invalid') return refuse(401, auth.kind);

    let body: unknown;
    if (req.method === 'POST') {
      try {
        body = await readJsonBody(req);
      } catch (error) {
        if (error instanceof BodyError) {
          if (error.status === 413) {
            res.setHeader('connection', 'close');
            // Drain the rest of the upload before closing: destroying the
            // socket while the client is still writing makes it see EPIPE
            // instead of reading this 413. Bounded so a huge or endless body
            // can't hold the connection open.
            let drained = 0;
            const close = () => req.destroy();
            const cap = setTimeout(close, DRAIN_TIMEOUT_MS);
            req.on('data', (chunk: Buffer) => {
              drained += chunk.length;
              if (drained > DRAIN_MAX_BYTES) close();
            });
            req.once('end', close);
            req.once('close', () => clearTimeout(cap));
            req.resume();
          }
          return sendJson(res, error.status, { jsonrpc: '2.0', id: null, error: { code: error.rpcCode, message: error.message } });
        }
        throw error;
      }
      // 2025-11-25 has no JSON-RPC batching (removed in 2025-06-18); a batch
      // of care calls would otherwise apply every mutation in it.
      if (Array.isArray(body)) {
        return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batch requests are not supported' } });
      }
    }

    // Service token on a user tool: 401 so Alexa starts account linking. User
    // token without the tool's scope: 403.
    const decision = decideAccess(auth, body);
    if (decision !== 'allow') return refuse(decision, decision === 403 ? 'scope' : 'none');

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
