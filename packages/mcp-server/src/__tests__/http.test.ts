import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, UnsecuredJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import { createJwtVerifier, type TokenVerifier } from '../auth/verifier.ts';
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

describe('protected resource metadata from a browser', () => {
  const PRM_PATHS = ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'];

  it('answers a CORS preflight on both well-known paths with 204 and Allow-Origin *', async () => {
    running = await start();
    for (const path of PRM_PATHS) {
      for (const origin of [ALLOWED_ORIGIN, 'https://elsewhere.example']) {
        const response = await fetch(`${running.url}${path}`, {
          method: 'OPTIONS',
          headers: { origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'mcp-protocol-version' },
        });
        expect(response.status, `${path} ${origin}`).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
        expect(response.headers.get('access-control-allow-headers')).toContain('mcp-protocol-version');
      }
    }
  });

  it('serves the document cross-origin with Allow-Origin *', async () => {
    running = await start();
    for (const path of PRM_PATHS) {
      const response = await fetch(`${running.url}${path}`, { headers: { origin: 'https://elsewhere.example', 'mcp-protocol-version': '2025-11-25' } });
      expect(response.status, path).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(((await json(response)) as { resource: string }).resource).toBe(running.mcpUrl);
    }
  });
});

describe('WWW-Authenticate challenge (MCP_WWW_AUTHENTICATE=1)', () => {
  const challenge = (r: Running) => `resource_metadata="${r.url}/.well-known/oauth-protected-resource/mcp"`;

  it('answers a request with no token with 401 and a Bearer resource_metadata challenge', async () => {
    running = await start({ wwwAuthenticate: true });
    const response = await rpc(running, initialize('2025-11-25'));
    expect(response.status).toBe(401);
    const header = response.headers.get('www-authenticate') ?? '';
    expect(header.startsWith('Bearer ')).toBe(true);
    expect(header).toContain(challenge(running));
    expect(header).not.toContain('error=');
  });

  it('checks auth before the body, so an anonymous bodyless POST gets 401 with the challenge, not 400', async () => {
    running = await start({ wwwAuthenticate: true });
    const response = await fetch(running.mcpUrl, { method: 'POST', headers: { origin: ALLOWED_ORIGIN } });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain(challenge(running));
  });

  it('marks a bad token error="invalid_token"', async () => {
    running = await start({ wwwAuthenticate: true });
    const response = await rpc(running, initialize('2025-11-25'), { token: 'forged' });
    expect(response.status).toBe(401);
    const header = response.headers.get('www-authenticate') ?? '';
    expect(header).toContain('error="invalid_token"');
    expect(header).toContain(challenge(running));
  });

  it('marks a missing care scope 403 error="insufficient_scope"', async () => {
    running = await start({ wwwAuthenticate: true, v1: fakeV1({ rows: [row('caller-adult')] }) });
    const response = await rpc(running, callTool('feed_mon'), { token: 'read-only' });
    expect(response.status).toBe(403);
    const header = response.headers.get('www-authenticate') ?? '';
    expect(header).toContain('error="insufficient_scope"');
    expect(header).toContain('scope="mcp:caller mcp:care"');
    expect(header).toContain(challenge(running));
  });

  it('lets a browser client read the challenge through Access-Control-Expose-Headers', async () => {
    running = await start({ wwwAuthenticate: true });
    const response = await rpc(running, initialize('2025-11-25'), { origin: ALLOWED_ORIGIN });
    expect(response.status).toBe(401);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    const exposed = (response.headers.get('access-control-expose-headers') ?? '').split(',').map((h) => h.trim().toLowerCase());
    expect(exposed).toContain('www-authenticate');
    expect(exposed).toContain('mcp-protocol-version');
  });
});

describe('auth tiers', () => {
  it('answers an anonymous bodyless POST with 401, not a JSON parse error', async () => {
    running = await start();
    const response = await fetch(running.mcpUrl, { method: 'POST' });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
  });

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

/** No stack frames, file paths or internal error names in a response body. */
function expectNoLeak(text: string): void {
  expect(text).not.toMatch(/\n\s+at |\.ts:\d+|node_modules|InvalidTokenError|ECONN|stack/);
}

async function postRaw(target: Running, body: string, token = 'adult'): Promise<{ status: number; text: string }> {
  const response = await fetch(target.mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
      'mcp-protocol-version': '2025-11-25',
    },
    body,
  });
  return { status: response.status, text: await response.text() };
}

describe('malformed JSON-RPC', () => {
  it('answers broken JSON, a wrong jsonrpc version and non-request shapes with 4xx, never 500, and leaks nothing', async () => {
    const v1 = fakeV1({ rows: [row('caller-adult')] });
    running = await start({ v1 });
    const cases: [string, number, number][] = [
      ['{"jsonrpc":', 400, -32700],
      [JSON.stringify({ jsonrpc: '1.0', id: 1, method: 'tools/list' }), 400, -32700],
      [JSON.stringify({ id: 1, method: 'tools/list' }), 400, -32700],
      [JSON.stringify({ jsonrpc: '2.0', id: 1 }), 400, -32700],
      [JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: 'feed_mon' }), 400, -32700],
      ['42', 400, -32700],
      ['null', 400, -32700],
    ];
    for (const [body, status, code] of cases) {
      const { status: got, text } = await postRaw(running, body);
      expect(got, body).toBe(status);
      expect((JSON.parse(text) as { error: { code: number } }).error.code, body).toBe(code);
      expectNoLeak(text);
    }
    expect(v1.calls).toHaveLength(0);
  });

  it('answers an unknown method and an unknown or removed tool as JSON-RPC errors', async () => {
    const v1 = fakeV1({ rows: [row('caller-adult')] });
    running = await start({ v1 });
    const method = await postRaw(running, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'admin/dump' }));
    expect(method.status).toBe(200);
    expect(JSON.parse(method.text)).toMatchObject({ error: { code: -32601 } });
    for (const name of ['heal_mon', 'get_inventory', '__proto__']) {
      const tool = await postRaw(running, JSON.stringify(callTool(name)));
      expect(tool.status, name).toBe(200);
      expect(JSON.parse(tool.text), name).toMatchObject({ error: { code: -32602 } });
      expectNoLeak(tool.text);
    }
    expect(v1.calls).toHaveLength(0);
  });

  it('rejects wrongly typed tool arguments without touching /v1', async () => {
    const v1 = fakeV1({ rows: [row('caller-adult')] });
    running = await start({ v1 });
    for (const call of [callTool('play_with_mon', { quality: 'lots' }), callTool('get_mon_status', { monId: { $ne: null } })]) {
      const { status, text } = await postRaw(running, JSON.stringify(call));
      expect(status).toBe(200);
      expect(JSON.parse(text)).toMatchObject({ result: { isError: true } });
      expectNoLeak(text);
    }
    expect(v1.calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('answers a body over 1 MB with a 413 the client can read, and a forged token with a readable 401 without buffering it', async () => {
    running = await start();
    const big = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { pad: 'x'.repeat(1_100_000) } });
    const signedIn = await postRaw(running, big, 'adult');
    expect(signedIn.status).toBe(413);
    expect(JSON.parse(signedIn.text)).toMatchObject({ jsonrpc: '2.0', id: null, error: { code: -32600 } });
    // Auth runs before the body is read, so a bad token never gets as far as the size check.
    const forged = await postRaw(running, big, 'forged');
    expect(forged.status).toBe(401);
    expect(JSON.parse(forged.text)).toEqual({ error: 'unauthorized' });
    // The listener still serves the next request.
    expect((await rpc(running, initialize('2025-11-25'), { token: 'service' })).status).toBe(200);
  });

  it('refuses JSON-RPC batches before any tool runs, whoever sends them', async () => {
    const v1 = fakeV1({ rows: [row('caller-adult')] });
    running = await start({ v1 });
    const twoMeals = JSON.stringify([callTool('feed_mon', {}, 1), callTool('feed_mon', {}, 2)]);
    for (const token of ['adult', 'service', 'read-only', undefined]) {
      const { status, text } = await postRaw(running, twoMeals, token);
      expect(status).toBe(400);
      expect(JSON.parse(text)).toMatchObject({ jsonrpc: '2.0', id: null, error: { code: -32600 } });
    }
    expect((await postRaw(running, '[]', 'adult')).status).toBe(400);
    expect(v1.calls).toHaveLength(0);
  });
});

describe('real JWT verification over HTTP', () => {
  const ISSUER = 'http://127.0.0.1:5174';

  async function jwtServer(v1 = fakeV1({ rows: [row('caller-adult')] })) {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'EdDSA' }] });
    const holder: { audience?: string } = {};
    const verifier: TokenVerifier = { verify: (t) => createJwtVerifier({ issuer: ISSUER, audience: holder.audience ?? '', jwks }).verify(t) };
    running = await start({ v1, verifier });
    holder.audience = running.mcpUrl;
    const mint = (claims: Record<string, unknown>, opts: { exp?: number; aud?: string } = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'EdDSA', kid: 'k1', typ: 'at+jwt' })
        .setIssuer(ISSUER)
        .setAudience(opts.aud ?? running!.mcpUrl)
        .setIssuedAt()
        .setExpirationTime(opts.exp ?? Math.floor(Date.now() / 1000) + 600)
        .sign(privateKey);
    return { v1, mint };
  }

  it('lets a client_credentials token discover tools but not read or change Caller data', async () => {
    const { v1, mint } = await jwtServer();
    const service = await mint({ sub: 'alexa', client_id: 'alexa', scope: 'mcp:service' });
    expect((await rpc(running!, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token: service })).status).toBe(200);
    for (const name of ['get_mon_status', 'check_on_mon', 'check_incubation', 'feed_mon']) {
      const response = await rpc(running!, callTool(name), { token: service });
      expect(response.status, name).toBe(401);
    }
    // A service token that also names a user in `sub` is still a service token.
    const spoofed = await mint({ sub: 'caller-adult', client_id: 'alexa', scope: 'mcp:service' });
    expect((await rpc(running!, callTool('get_mon_status'), { token: spoofed })).status).toBe(401);
    expect(v1.calls).toHaveLength(0);
  });

  it('answers 401 for an expired, wrong-audience or unsigned user token and never calls /v1', async () => {
    const { v1, mint } = await jwtServer();
    const user = { sub: 'caller-adult', client_id: 'alexa', scope: 'mcp:caller mcp:care', birth_year: 1990 };
    expect((await rpc(running!, callTool('get_mon_status'), { token: await mint(user) })).status).toBe(200);
    const readsBefore = v1.calls.length;
    const bad = [
      await mint(user, { exp: Math.floor(Date.now() / 1000) - 60 }),
      await mint(user, { aud: `${running!.mcpUrl}/` }),
      new UnsecuredJWT(user).setIssuer(ISSUER).setAudience(running!.mcpUrl).setExpirationTime('10m').encode(),
    ];
    for (const token of bad) {
      const response = await rpc(running!, callTool('feed_mon'), { token });
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBeNull();
    }
    expect(v1.calls.length).toBe(readsBefore);
  });
});
