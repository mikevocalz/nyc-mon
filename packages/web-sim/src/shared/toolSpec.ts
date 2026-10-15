import type Anthropic from '@anthropic-ai/sdk';
import type { Tool as McpTool } from '@modelcontextprotocol/client';

/**
 * MCP `tools/list` entries → Claude tool definitions (Messages API shape, which
 * the Bedrock Mantle endpoint takes unchanged).
 *
 * Rules:
 * - Tools the MCP Apps spec marks app-only (`_meta.ui.visibility: ["app"]`)
 *   stay out of the model's list; views reach them over the bridge.
 * - Host-only tools (the dev presence hook) stay out too: the dev panel calls
 *   them, the model never does.
 * - `inputSchema` passes through as JSON Schema. `$schema` is dropped and a
 *   missing `type` becomes `object`, which is what Claude requires.
 * - Names Claude would reject are skipped, not renamed: a renamed tool could
 *   not be mapped back to the MCP server with certainty.
 */

/** Tools the simulator calls itself and never offers to the model. */
export const HOST_ONLY_TOOLS: ReadonlySet<string> = new Set(['inject_presence_event']);

const CLAUDE_TOOL_NAME = /^[a-zA-Z0-9_-]{1,128}$/;

export interface ConversionResult {
  readonly tools: Anthropic.Tool[];
  /** Tools left out, with the reason; shown in the dev panel. */
  readonly skipped: readonly { name: string; reason: string }[];
}

function visibility(tool: McpTool): readonly string[] | undefined {
  const ui = (tool._meta as { ui?: { visibility?: unknown } } | undefined)?.ui;
  return Array.isArray(ui?.visibility) ? (ui.visibility as string[]) : undefined;
}

export function isModelVisible(tool: McpTool): boolean {
  const v = visibility(tool);
  return v === undefined || v.includes('model');
}

export function toClaudeInputSchema(schema: McpTool['inputSchema']): Anthropic.Tool.InputSchema {
  const { $schema: _drop, ...rest } = (schema ?? {}) as Record<string, unknown>;
  return { ...rest, type: 'object' } as Anthropic.Tool.InputSchema;
}

export function mcpToolsToClaude(mcpTools: readonly McpTool[]): ConversionResult {
  const tools: Anthropic.Tool[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const seen = new Set<string>();

  // Sorted by name so the tools prefix is byte-stable across reconnects (the
  // prompt cache is a prefix match: tools render before system).
  const sorted = [...mcpTools].sort((a, b) => a.name.localeCompare(b.name));
  for (const tool of sorted) {
    if (HOST_ONLY_TOOLS.has(tool.name)) {
      skipped.push({ name: tool.name, reason: 'host-only (dev panel)' });
      continue;
    }
    if (!isModelVisible(tool)) {
      skipped.push({ name: tool.name, reason: 'app-only visibility' });
      continue;
    }
    if (!CLAUDE_TOOL_NAME.test(tool.name)) {
      skipped.push({ name: tool.name, reason: 'name not accepted by Claude' });
      continue;
    }
    if (seen.has(tool.name)) {
      skipped.push({ name: tool.name, reason: 'duplicate name' });
      continue;
    }
    seen.add(tool.name);
    tools.push({
      name: tool.name,
      description: tool.description ?? tool.title ?? tool.name,
      input_schema: toClaudeInputSchema(tool.inputSchema),
    });
  }
  return { tools, skipped };
}
