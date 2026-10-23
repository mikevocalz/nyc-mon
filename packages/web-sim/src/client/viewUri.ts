import type { CallToolResult, Tool } from '@modelcontextprotocol/client';
import { getToolUiResourceUri } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { TranscriptItem } from './session.ts';

/**
 * Which ui:// view a tool call shows. The MCP server versions its view URIs
 * with a content hash, so a URI is only good for the server build that issued
 * it. A saved conversation outlives that build: the URI stored with a
 * transcript item is a record of what was shown, never something to fetch.
 */

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>;

/** The tool's listed view, or null when it has none or lists an invalid one. */
function toolViewUri(tool: Tool): string | null {
  try {
    return getToolUiResourceUri(tool) ?? null;
  } catch {
    return null;
  }
}

function resultViewUri(result: CallToolResult): string | null {
  const ui = (result._meta as { ui?: { resourceUri?: unknown } } | undefined)?.ui;
  return typeof ui?.resourceUri === 'string' && ui.resourceUri.startsWith('ui://') ? ui.resourceUri : null;
}

/** For a call that just returned: the tool listing first, then the result's own _meta. */
export function liveViewUri(tool: Tool | undefined, result: CallToolResult): string | null {
  return (tool ? toolViewUri(tool) : null) ?? resultViewUri(result);
}

/**
 * For any transcript item, fresh or restored: the view its tool lists on the
 * server this session is connected to. Null when that server no longer has the
 * tool or the tool no longer has a view; the display then shows its idle state.
 */
export function currentViewUri(item: ToolItem, toolsByName: ReadonlyMap<string, Tool>): string | null {
  const tool = toolsByName.get(item.name);
  return tool ? toolViewUri(tool) : null;
}
