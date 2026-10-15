import { afterEach, describe, expect, it } from 'vitest';
import type { McpAppsRegistration } from '../mcp/ui-seam.ts';
import { rpc, start, type Running } from './harness.ts';

let running: Running | undefined;
afterEach(async () => {
  await running?.close();
  running = undefined;
});

const URI = 'ui://nyc-mon/mon-card-abc123.html';
const HTML = '<!doctype html><title>card</title>';

/** A minimal registration in the shape lane C's `mcpAppsRegistration()` returns. */
const registration: McpAppsRegistration = {
  toolResourceUris: { get_mon_status: URI, feed_mon: URI },
  registerResources(server) {
    server.registerResource('Mon card', URI, { mimeType: 'text/html;profile=mcp-app' }, async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/html;profile=mcp-app', text: HTML }],
    }));
  },
};

describe('MCP Apps registration seam', () => {
  it('links tools to their view, app-visible, and leaves the rest data-only', async () => {
    running = await start({ ui: registration });
    const list = (await (await rpc(running, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token: 'service' })).json()) as {
      result: { tools: { name: string; _meta?: { ui?: { resourceUri?: string; visibility?: string[] } } }[] };
    };
    const byName = new Map(list.result.tools.map((t) => [t.name, t]));
    expect(byName.get('get_mon_status')?._meta?.ui).toEqual({ resourceUri: URI, visibility: ['model', 'app'] });
    expect(byName.get('feed_mon')?._meta?.ui?.resourceUri).toBe(URI);
    expect(byName.get('check_on_mon')?._meta).toBeUndefined();
  });

  it('lets a service token read the ui:// resource (no Caller data in it)', async () => {
    running = await start({ ui: registration });
    const read = (await (
      await rpc(running, { jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: URI } }, { token: 'service' })
    ).json()) as { result: { contents: { uri: string; mimeType: string; text: string }[] } };
    expect(read.result.contents[0]).toEqual({ uri: URI, mimeType: 'text/html;profile=mcp-app', text: HTML });
  });
});
