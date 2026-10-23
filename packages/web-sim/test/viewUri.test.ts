import type { CallToolResult, Tool } from '@modelcontextprotocol/client';
import { describe, expect, it } from 'vitest';
import type { TranscriptItem } from '../src/client/session.ts';
import { currentViewUri, liveViewUri } from '../src/client/viewUri.ts';

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>;

const OLD = 'ui://nyc-mon/mon-card-7187307d.html';
const NEW = 'ui://nyc-mon/mon-card-a1b2c3d4.html';

function tool(name: string, uri?: unknown): Tool {
  return {
    name,
    inputSchema: { type: 'object' },
    ...(uri === undefined ? {} : { _meta: { ui: { resourceUri: uri, visibility: ['model', 'app'] } } }),
  } as Tool;
}

function restored(name: string): ToolItem {
  const result: CallToolResult = { content: [{ type: 'text', text: 'ok' }], _meta: { ui: { resourceUri: OLD } } };
  return { kind: 'tool', id: 't-1', name, title: 'Mon status', input: { a: 1 }, result, resourceUri: OLD, at: 1 };
}

describe('currentViewUri', () => {
  it('resolves a restored card against the current server, not the saved hash', () => {
    const tools = new Map([['get_mon_status', tool('get_mon_status', NEW)]]);
    expect(currentViewUri(restored('get_mon_status'), tools)).toBe(NEW);
  });

  it('drops the card when the tool is gone from the server', () => {
    expect(currentViewUri(restored('get_mon_status'), new Map())).toBeNull();
  });

  it('drops the card when the tool no longer has a view', () => {
    const tools = new Map([['get_mon_status', tool('get_mon_status')]]);
    expect(currentViewUri(restored('get_mon_status'), tools)).toBeNull();
  });

  it('drops the card when the tool advertises an invalid view URI', () => {
    const tools = new Map([['get_mon_status', tool('get_mon_status', 'https://example.com/card.html')]]);
    expect(currentViewUri(restored('get_mon_status'), tools)).toBeNull();
  });
});

describe('liveViewUri', () => {
  it('prefers the tool listing and falls back to the result for a fresh call', () => {
    const result: CallToolResult = { content: [], _meta: { ui: { resourceUri: NEW } } };
    expect(liveViewUri(tool('x', NEW), { content: [] })).toBe(NEW);
    expect(liveViewUri(undefined, result)).toBe(NEW);
    expect(liveViewUri(tool('x'), { content: [] })).toBeNull();
  });
});
