import type { McpServer } from '@modelcontextprotocol/server';
import type { ToolName } from './tools.ts';

/**
 * The seam lane C's MCP Apps views (`src/ui/**`) plug into. This package
 * registers no `ui://` resource of its own and ships no placeholder view.
 *
 * Lane C passes one value to `createHandler({ ui })` (see `server.ts`):
 * - `registerResources` runs once per request-scoped `McpServer`, before any
 *   tool is listed or called. It registers the `ui://…` HTML resources with
 *   MIME `text/html;profile=mcp-app` (for example through
 *   `@modelcontextprotocol/ext-apps/server`'s `registerAppResource`). It must
 *   not touch Caller data: a service token may call `resources/read`.
 * - `toolResourceUris` maps a tool name to the `ui://` URI its results render
 *   in. The server sets `_meta.ui.resourceUri` and `visibility: ['model', 'app']`
 *   on that tool's registration.
 *
 * Lane C's `mcpAppsRegistration()` (`src/ui/index.ts`) is the implementation.
 */
export interface McpAppsRegistration {
  readonly registerResources: (server: McpServer) => void;
  readonly toolResourceUris: Partial<Record<ToolName, string>>;
}

