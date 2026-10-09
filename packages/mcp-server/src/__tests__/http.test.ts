import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CORE_TOOL_NAMES, DEV_TOOL_NAMES } from '../mcp/tools.ts';
import { ALLOWED_ORIGIN, callTool, fakeV1, initialize, row, rpc, start, type Running } from './harness.ts';

let running: Running | undefined;
afterEach(async () => {
  await running?.close();
  running = undefined;
});

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('initialize handshake', () => {
  it('answers a 2025-11-25 initialize with 2025-11-25', async () => {
    running = await start();
    const response = await rpc(running, initialize('2025-11-25'), { token: 'service' });
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.result).toMatchObject({ protocolVersion: '2025-11-25', serverInfo: { name: 'nyc-mon' } });
  });

  it("negotiates down to Alexa's 2025-03-26 initialize payload", async () => {
    running = await start();
    const response = await rpc(running, initialize('2025-03-26'), { token: 'service' });
    expect(response.status).toBe(200);
    expect((await json(response)).result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} } });
  });

  it('answers the Local Inspector 2025-06-18 version with itself', async () => {
    running = await start();
    const body = await json(await rpc(running, initialize('2025-06-18'), { token: 'service' }));
    expect(body.result).toMatchObject({ protocolVersion: '2025-06-18' });
  });

  it('works end to end with the SDK client over Streamable HTTP', async () => {
    running = await start();
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(running.mcpUrl), { requestInit: { headers: { authorization: 'Bearer service' } } }),
    );
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...CORE_TOOL_NAMES].sort());
    await client.close();
  });
});

describe('Origin validation', () => {
  it('rejects a foreign Origin with 403 before auth', async () => {
    running = await start();
    const response = await rpc(running, initialize('2025-11-25'), { token: 'service', origin: 'https://evil.example' });
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('echoes an allowed Origin, never *', async () => {
    running = await start();
    const response = await rpc(running, initialize('2025-11-25'), { token: 'service', origin: ALLOWED_ORIGIN });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
  });

  it('answers a preflight from an allowed Origin and refuses one from elsewhere', async () => {
    running = await start();
    const ok = await fetch(running.mcpUrl, { method: 'OPTIONS', headers: { origin: ALLOWED_ORIGIN } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    const bad = await fetch(running.mcpUrl, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    expect(bad.status).toBe(403);
  });

  it('treats a matching hostname on another port as a different origin', async () => {
    running = await start();
    const response = await rpc(running, initialize('2025-11-25'), { token: 'service', origin: 'http://localhost:9999' });
    expect(response.status).toBe(403);
  });
});

describe('protected resource metadata', () => {
  it('serves the exact /mcp URL as resource at both well-known paths', async () => {
    running = await start();
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const body = await json(await fetch(`${running.url}${path}`));
      expect(body.resource).toBe(running.mcpUrl);
      expect(body.authorization_servers).toEqual(['http://127.0.0.1:5174']);
      expect(body.scopes_supported).toEqual(['mcp:service', 'mcp:caller', 'mcp:care']);
      expect(body.bearer_methods_supported).toEqual(['header']);
    }
  });
});

describe('auth tiers', () => {
  it('returns 401 with no WWW-Authenticate when no token is sent', async () => {
    running = await start();
    const response = await rpc(running, initialize('2025-11-25'));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
  });

  it('returns 401 for an unknown token and for a token in the query string', async () => {
    running = await start();
    expect((await rpc(running, initialize('2025-11-25'), { token: 'forged' })).status).toBe(401);
    const query = await fetch(`${running.mcpUrl}?access_token=service`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify(initialize('2025-11-25')),
    });
    expect(query.status).toBe(401);
  });

  it('lets a service token initialize and list tools', async () => {
    running = await start();
    const response = await rpc(running, { jsonrpc: '2.0', id: 3, method: 'tools/list' }, { token: 'service', protocolVersion: '2025-03-26' });
    expect(response.status).toBe(200);
    const result = (await json(response)).result as { tools: { name: string }[] };
    expect(result.tools.length).toBe(CORE_TOOL_NAMES.length);
  });

  it('answers a service-token tools/call with 401 so Alexa starts account linking', async () => {
    const v1 = fakeV1({ rows: [row('caller-adult')] });
    running = await start({ v1 });
    const response = await rpc(running, callTool('get_mon_status'), { token: 'service', protocolVersion: '2025-03-26' });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(v1.calls).toHaveLength(0);
  });

  it('runs a user tool with a user token', async () => {
    running = await start({ v1: fakeV1({ rows: [row('caller-adult')] }) });
    const response = await rpc(running, callTool('get_mon_status'), { token: 'adult', protocolVersion: '2025-11-25' });
    expect(response.status).toBe(200);
    const result = (await json(response)).result as { isError?: boolean; structuredContent: { mon: { name: string } } };
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.mon.name).toBe('Ratti');
  });

  it('answers 403 for a care tool when the user token lacks mcp:care, but still serves reads', async () => {
    const v1 = fakeV1({ rows: [row('caller-adult')] });
    running = await start({ v1 });
    const write = await rpc(running, callTool('feed_mon'), { token: 'read-only' });
    expect(write.status).toBe(403);
    expect(write.headers.get('www-authenticate')).toBeNull();
    expect(v1.calls.some((c) => c.method === 'PUT')).toBe(false);
    expect((await rpc(running, callTool('get_mon_status'), { token: 'read-only' })).status).toBe(200);
  });

  it('gives an under-18 token no data and never calls /v1', async () => {
    const v1 = fakeV1({ rows: [row('caller-minor')] });
    running = await start({ v1 });
    const result = (await json(await rpc(running, callTool('get_mon_status'), { token: 'minor' }))).result as {
      isError: boolean;
      structuredContent: { error: { reason: string } };
    };
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error.reason).toBe('adults-only');
    expect(v1.calls).toHaveLength(0);
  });

  it('refuses when /v1 says the account is under 18 even without a birth-year claim', async () => {
    running = await start({ v1: fakeV1({ rows: [row('caller-adult')], refuse: 'ADULT_REQUIRED' }) });
    const result = (await json(await rpc(running, callTool('check_on_mon'), { token: 'adult-no-claim' }))).result as {
      isError: boolean;
      structuredContent: { error: { reason: string } };
      content: { text: string }[];
    };
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error.reason).toBe('adults-only');
    expect(result.content[0]?.text).toBe('NYC-MON on Alexa is only for accounts 18 and older. Keep caring for your Mon in the NYC-MON app.');
  });
});

describe('dev-only tools', () => {
  it('are absent from tools/list in production mode', async () => {
    running = await start();
    const result = (await json(await rpc(running, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token: 'service' }))).result as {
      tools: { name: string; inputSchema: { properties?: Record<string, unknown> } }[];
    };
    const names = result.tools.map((t) => t.name);
    for (const dev of DEV_TOOL_NAMES) expect(names).not.toContain(dev);
    expect(names).not.toContain('heal_mon');
    expect(names).not.toContain('get_inventory');
    for (const tool of result.tools) expect(tool.inputSchema.properties ?? {}).not.toHaveProperty('speakerHint');
  });

  it('are listed in dev mode, with every tool carrying an output schema', async () => {
    running = await start({ devMode: true });
    const result = (await json(await rpc(running, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token: 'service' }))).result as {
      tools: { name: string; outputSchema?: unknown }[];
    };
    expect(result.tools.map((t) => t.name).sort()).toEqual([...CORE_TOOL_NAMES, ...DEV_TOOL_NAMES].sort());
    for (const tool of result.tools) expect(tool.outputSchema).toMatchObject({ type: 'object' });
  });

  it('publishes the real output schema, e.g. check_incubation and the care result', async () => {
    running = await start();
    const result = (await json(await rpc(running, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token: 'service' }))).result as {
      tools: { name: string; outputSchema: Record<string, unknown> }[];
    };
    const schemaOf = (name: string) => result.tools.find((t) => t.name === name)?.outputSchema;
    expect(schemaOf('check_incubation')).toMatchObject({
      type: 'object',
      required: ['incubating', 'eggs'],
      properties: {
        incubating: { type: 'boolean' },
        eggs: {
          type: 'array',
          items: {
            type: 'object',
            required: ['eggId', 'speciesId', 'incubationEndsAt', 'minutesRemaining', 'readyToHatch'],
            properties: { minutesRemaining: { type: 'integer', minimum: 0 }, readyToHatch: { type: 'boolean' } },
          },
        },
      },
    });
    expect(schemaOf('feed_mon')).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['applied', 'mon', 'care', 'mood']),
      properties: {
        applied: { type: 'boolean' },
        effect: { enum: ['eaten', 'overfed', 'fell-asleep', 'woke', 'woke-early', 'played'] },
        declinedBecause: { enum: ['asleep', 'sluggish', 'already-asleep', 'already-awake', 'too-tired'] },
      },
    });
  });
});
