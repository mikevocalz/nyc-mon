import type { IncomingMessage, ServerResponse } from 'node:http';
// eslint-disable-next-line import/no-unresolved -- SDK not installed yet; ambient types in src/types/mcp-sdk.d.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// eslint-disable-next-line import/no-unresolved -- SDK not installed yet; ambient types in src/types/mcp-sdk.d.ts
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Env } from '../env.ts';
import type { CallerData } from '../data/caller.ts';
import { presenceService } from '../presence/service.ts';
import { authenticate, type AuthContext } from '../auth/oauth.ts';
import { PRM_PATH, buildPrm } from '../auth/prm.ts';
import type { SpeakerHint } from '../auth/actor.ts';
import { tools, type ToolContext, type ToolResult } from './tools.ts';

/**
 * Streamable HTTP wiring (ADR 0005): one `/mcp` endpoint for POST (JSON-RPC),
 * GET (SSE stream) and DELETE (session close), plus the RFC 9728 well-known
 * document. Spec floor: 2025-11-25.
 *
 * NOTE: the SDK imports above resolve through `src/types/mcp-sdk.d.ts`, an
 * ambient stand-in — `@modelcontextprotocol/sdk` is not installed yet. The
 * call shapes below follow the documented TypeScript SDK API; delete the
 * .d.ts when the real package lands and reconcile any type drift.
 */

export interface ServerDeps {
  readonly env: Env;
  readonly data: CallerData;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Build one McpServer with every registered tool bound to a ToolContext. */
function buildMcpServer(ctx: Omit<ToolContext, 'speakerHint'>): McpServer {
  const server = new McpServer({ name: 'nyc-mon-alexa', version: '0.1.0' });
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        // TODO(sdk): zod 4 shapes → SDK expects a ZodRawShape (the .shape of an
        // object) or JSON Schema. For object schemas pass `inputSchema.shape`;
        // for the odd non-object input, wrap or convert first.
        inputSchema: (tool.inputSchema as unknown as { shape?: Record<string, unknown> }).shape as never,
        annotations: tool.annotations,
      },
      async (args: unknown, extra: { authInfo?: unknown }) => {
        // TODO(sdk): map extra.authInfo → SpeakerHint once the SDK surfaces
        // per-request auth metadata; Alexa Voice ID arrives there.
        const speakerHint = (extra.authInfo as { speakerHint?: SpeakerHint } | undefined)?.speakerHint;
        const result: ToolResult = await tool.handler(args, { ...ctx, speakerHint });
        return result;
      },
    );
  }
  return server;
}

export function createHandler(deps: ServerDeps) {
  const { env } = deps;
  const prm = buildPrm({
    resource: env.MCP_RESOURCE_ORIGIN,
    authorizationServers: [env.AUTH_SERVER_ORIGIN],
  });

  // Streamable HTTP sessions: transport per sessionId (spec 2025-11-25).
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', env.MCP_RESOURCE_ORIGIN);

    if (req.method === 'GET' && url.pathname === PRM_PATH) {
      return json(res, 200, prm);
    }
    if (req.method === 'GET' && url.pathname === '/healthz') {
      return json(res, 200, { ok: true });
    }
    if (url.pathname !== '/mcp') {
      return json(res, 404, { error: 'not_found' });
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*', // TODO(cors): tighten to sim + Alexa origins
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization, mcp-session-id',
      });
      res.end();
      return;
    }

    const auth: AuthContext | null = await authenticate(req, res, {
      resourceOrigin: env.MCP_RESOURCE_ORIGIN,
      devBypass: env.OAUTH_DEV_BYPASS === '1',
    });
    if (!auth) return; // 401 + WWW-Authenticate already written

    const ctx: Omit<ToolContext, 'speakerHint'> = {
      auth,
      data: deps.data,
      presence: presenceService,
      devMode: env.MCP_DEV_MODE === '1',
    };

    try {
      const body = req.method === 'POST' ? await readBody(req) : undefined;

      // TODO(sdk): the real StreamableHTTPServerTransport pattern is —
      //   const transport = new StreamableHTTPServerTransport({
      //     sessionIdGenerator: () => randomUUID(),
      //     onsessioninitialized: (id) => sessions.set(id, { transport, server }),
      //   });
      //   server.connect(transport) once per session; reuse by
      //   `mcp-session-id` header thereafter. This scaffold creates a fresh
      //   stateless pair per request until the SDK lands.
      const sessionId = req.headers['mcp-session-id'];
      const existing = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
      const pair = existing ?? { transport: new StreamableHTTPServerTransport(), server: buildMcpServer(ctx) };
      if (!existing) {
        // TODO(sdk): await pair.server.connect(pair.transport) — required in
        // the real SDK before handleRequest.
      }
      await pair.transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) {
        json(res, 500, { error: 'internal', message: err instanceof Error ? err.message : String(err) });
      } else {
        res.end();
      }
    }
  };
}
