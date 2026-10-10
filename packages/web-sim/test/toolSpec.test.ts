import { describe, expect, it } from 'vitest';
import type { Tool } from '@modelcontextprotocol/client';
import { HOST_ONLY_TOOLS, isModelVisible, mcpToolsToClaude, toClaudeInputSchema } from '../src/shared/toolSpec.ts';

const tool = (over: Partial<Tool> & { name: string }): Tool =>
  ({ inputSchema: { type: 'object', properties: {} }, ...over }) as Tool;

describe('mcpToolsToClaude', () => {
  it('maps name, description and JSON Schema input', () => {
    const { tools, skipped } = mcpToolsToClaude([
      tool({
        name: 'feed_mon',
        description: 'Feed a Mon an inventory item.',
        inputSchema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: { itemId: { type: 'string' } },
          required: ['itemId'],
        } as Tool['inputSchema'],
      }),
    ]);
    expect(skipped).toEqual([]);
    expect(tools).toEqual([
      {
        name: 'feed_mon',
        description: 'Feed a Mon an inventory item.',
        input_schema: { type: 'object', properties: { itemId: { type: 'string' } }, required: ['itemId'] },
      },
    ]);
  });

  it('keeps the dev presence hook away from the model', () => {
    expect(HOST_ONLY_TOOLS.has('inject_presence_event')).toBe(true);
    const { tools, skipped } = mcpToolsToClaude([tool({ name: 'inject_presence_event' }), tool({ name: 'check_on_mon' })]);
    expect(tools.map((t) => t.name)).toEqual(['check_on_mon']);
    expect(skipped).toEqual([{ name: 'inject_presence_event', reason: 'host-only (dev panel)' }]);
  });

  it('drops app-only tools (MCP Apps visibility) and keeps model-visible ones', () => {
    const appOnly = tool({ name: 'refresh_view', _meta: { ui: { visibility: ['app'] } } });
    const both = tool({ name: 'get_mon_status', _meta: { ui: { resourceUri: 'ui://nyc-mon/mon.html', visibility: ['model', 'app'] } } });
    expect(isModelVisible(appOnly)).toBe(false);
    expect(isModelVisible(both)).toBe(true);
    const { tools, skipped } = mcpToolsToClaude([appOnly, both]);
    expect(tools.map((t) => t.name)).toEqual(['get_mon_status']);
    expect(skipped[0]?.reason).toBe('app-only visibility');
  });

  it('skips names Claude rejects and duplicates, and sorts for a stable prefix', () => {
    const { tools, skipped } = mcpToolsToClaude([
      tool({ name: 'zeta' }),
      tool({ name: 'has space' }),
      tool({ name: 'alpha' }),
      tool({ name: 'alpha' }),
    ]);
    expect(tools.map((t) => t.name)).toEqual(['alpha', 'zeta']);
    expect(skipped.map((s) => s.reason).sort()).toEqual(['duplicate name', 'name not accepted by Claude']);
  });

  it('falls back to the title, then the name, for a missing description', () => {
    const { tools } = mcpToolsToClaude([tool({ name: 'a', title: 'Check in' }), tool({ name: 'b' })]);
    expect(tools.map((t) => t.description)).toEqual(['Check in', 'b']);
  });

  it('always produces an object schema', () => {
    expect(toClaudeInputSchema(undefined as unknown as Tool['inputSchema'])).toEqual({ type: 'object' });
  });
});
