import type { CallToolResult, Tool } from '@modelcontextprotocol/client';
import { describe, expect, it } from 'vitest';
import type { TranscriptItem } from '../src/client/session.ts';
import { currentViewUri, freshViewFor, liveViewUri } from '../src/client/viewUri.ts';

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
  it("prefers the result's own view and falls back to the tool listing for a fresh call", () => {
    const result: CallToolResult = { content: [], _meta: { ui: { resourceUri: NEW } } };
    expect(liveViewUri(tool('x', NEW), { content: [] })).toBe(NEW);
    expect(liveViewUri(undefined, result)).toBe(NEW);
    expect(liveViewUri(tool('x'), { content: [] })).toBeNull();
  });
});

describe('freshViewFor (a server rebuilt while the page stayed open)', () => {
  /** A client whose listing serves the old build's hash until the server restarts. */
  function rebuildingServer() {
    let uri = OLD;
    let lists = 0;
    return {
      restart: () => (uri = NEW),
      lists: () => lists,
      listTools: async () => {
        lists++;
        return [tool('hatch_egg', uri), tool('get_mon_status', uri)];
      },
    };
  }
  const hatchResult: CallToolResult = { content: [], structuredContent: { hatching: true } };

  it('the next result after a restart opens the new hash, not the cached one', async () => {
    const server = rebuildingServer();
    const cached = await server.listTools();
    server.restart();
    const fresh = await freshViewFor({ listTools: server.listTools, cached, toolName: 'hatch_egg', result: hatchResult });
    expect(fresh.uri).toBe(NEW);
    expect(fresh.changed).toBe(true);
    expect(fresh.tools.map((t) => currentViewUri({ ...restored(t.name) }, new Map([[t.name, t]])))).toEqual([NEW, NEW]);
  });

  it('an unchanged server keeps the listing it had', async () => {
    const server = rebuildingServer();
    const cached = await server.listTools();
    const fresh = await freshViewFor({ listTools: server.listTools, cached, toolName: 'hatch_egg', result: hatchResult });
    expect(fresh).toMatchObject({ uri: OLD, changed: false });
  });

  it("prefers the result's own resourceUri over any listing", async () => {
    const server = rebuildingServer();
    const cached = await server.listTools();
    const result: CallToolResult = { content: [], _meta: { ui: { resourceUri: NEW } } };
    const fresh = await freshViewFor({ listTools: server.listTools, cached, toolName: 'hatch_egg', result });
    expect(fresh.uri).toBe(NEW);
  });

  it('a listing that fails or hangs falls back to the result, then the cache, without blocking', async () => {
    const cached = [tool('hatch_egg', OLD)];
    const failed = await freshViewFor({ listTools: async () => Promise.reject(new Error('down')), cached, toolName: 'hatch_egg', result: hatchResult });
    expect(failed).toMatchObject({ uri: OLD, changed: false });
    const hung = await freshViewFor({ listTools: () => new Promise(() => {}), cached, toolName: 'hatch_egg', result: hatchResult, timeoutMs: 20 });
    expect(hung).toMatchObject({ uri: OLD, changed: false });
  });
});
