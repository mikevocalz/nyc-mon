/**
 * AMBIENT STAND-IN for `@modelcontextprotocol/sdk` — DELETE THIS FILE when the
 * dependency lands.
 *
 * `@modelcontextprotocol/sdk` is not in the pnpm lockfile yet (checked
 * 2026-10-06). Per the build brief we do not add a dependency version blind;
 * these declarations mirror the documented TypeScript SDK surface (spec
 * 2025-11-25, https://modelcontextprotocol.io/specification/2025-11-25 and
 * https://github.com/modelcontextprotocol/typescript-sdk) just tightly enough
 * for our call sites to compile against the real API shape.
 *
 * When the SDK is installed: delete this file, keep the imports in
 * `src/mcp/server.ts` unchanged, and fix whatever the real types flag.
 */

declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  import type { IncomingMessage, ServerResponse } from 'node:http';
  import type { z } from 'zod';

  /** Loose shape of the SDK's ZodRawShape — an object of zod schemas. */
  export type ToolInputShape = Record<string, z.ZodTypeAny>;

  export interface ToolAnnotations {
    readonly title?: string;
    readonly readOnlyHint?: boolean;
    readonly destructiveHint?: boolean;
    readonly idempotentHint?: boolean;
    readonly openWorldHint?: boolean;
  }

  export interface ToolDefinition {
    readonly description?: string;
    readonly inputSchema?: ToolInputShape;
    readonly outputSchema?: Record<string, z.ZodTypeAny>;
    readonly annotations?: ToolAnnotations;
  }

  export interface CallToolResult {
    readonly content?: readonly { readonly type: 'text'; readonly text: string }[];
    readonly structuredContent?: Record<string, unknown>;
    readonly isError?: boolean;
  }

  export type ToolHandler<Args> = (
    args: Args,
    extra: { readonly authInfo?: unknown; readonly sessionId?: string },
  ) => CallToolResult | Promise<CallToolResult>;

  /**
   * SDK: `new McpServer({ name, version })`, then `registerTool(name, def, handler)`
   * and `server.connect(transport)` (or `server.server.connect`).
   */
  export class McpServer {
    constructor(info: { readonly name: string; readonly version: string });
    registerTool<Args>(
      name: string,
      def: ToolDefinition,
      handler: ToolHandler<Args>,
    ): void;
    connect(transport: unknown): Promise<void>;
    close(): Promise<void>;
  }

  // Referenced so the .d.ts is not flagged for unused imports in stricter modes.
  export type { IncomingMessage, ServerResponse };
}

declare module '@modelcontextprotocol/sdk/server/streamableHttp.js' {
  import type { IncomingMessage, ServerResponse } from 'node:http';

  export interface StreamableHTTPServerTransportOptions {
    /** SDK: session id generator; return undefined for stateless mode. */
    readonly sessionIdGenerator?: () => string | undefined;
    readonly onsessioninitialized?: (sessionId: string) => void;
    readonly onsessionclosed?: (sessionId: string) => void;
    readonly enableJsonResponse?: boolean;
    readonly allowedHosts?: readonly string[];
    readonly allowedOrigins?: readonly string[];
  }

  /**
   * SDK: one transport per logical session; `handleRequest(req, res, body)`
   * serves POST/GET/DELETE on the single Streamable HTTP endpoint.
   */
  export class StreamableHTTPServerTransport {
    constructor(options?: StreamableHTTPServerTransportOptions);
    readonly sessionId: string | undefined;
    handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
    close(): Promise<void>;
  }
}
