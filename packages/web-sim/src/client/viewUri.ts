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

/** For a call that just returned: the result's own _meta first (it comes from the server as it is now), then the tool listing. */
export function liveViewUri(tool: Tool | undefined, result: CallToolResult): string | null {
  return resultViewUri(result) ?? (tool ? toolViewUri(tool) : null);
}

const viewKey = (tools: readonly Tool[]) =>
  tools
    .map((t) => `${t.name}=${toolViewUri(t) ?? ''}`)
    .sort()
    .join('|');

/**
 * Re-lists the server's tools before a fresh result opens its view. The
 * server versions view URIs per build, and a restart behind an open page is
 * invisible to the client (requests just keep working), so the listing from
 * connect time can name the old build's view: that card loads, but it is the
 * old code (a hatch that never plays). Re-listing costs one tools/list per
 * card; a listing that fails or takes longer than `timeoutMs` falls back to
 * the result's own URI, then the cached listing, so a card is never held up.
 * `changed` says the host should keep `tools` as its listing.
 */
export async function freshViewFor(opts: {
  readonly listTools: () => Promise<Tool[]>;
  readonly cached: readonly Tool[];
  readonly toolName: string;
  readonly result: CallToolResult;
  readonly timeoutMs?: number;
}): Promise<{ readonly uri: string | null; readonly tools: readonly Tool[]; readonly changed: boolean }> {
  let fresh: Tool[] | null = null;
  try {
    fresh = await Promise.race([
      opts.listTools(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), opts.timeoutMs ?? 2000)),
    ]);
  } catch {
    fresh = null;
  }
  const tools = fresh ?? opts.cached;
  const changed = fresh !== null && viewKey(fresh) !== viewKey(opts.cached);
  return { uri: liveViewUri(tools.find((t) => t.name === opts.toolName), opts.result), tools, changed };
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
