import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { applyCareAction, createInitialCareState, type CareState, type EggRecord, type MonInstance } from '@acme/core';
import type { TokenVerifier, VerifiedToken } from '../auth/verifier.ts';
import { InvalidTokenError } from '../auth/verifier.ts';
import { V1CallerData } from '../data/v1.ts';
import { createHandler, type ServerDeps } from '../mcp/server.ts';
import { FixtureFamiliarDirectory } from '../presence/fixtures.ts';
import { PresenceService } from '../presence/service.ts';

export const NOW = Date.UTC(2026, 9, 8, 15, 0);
export const SERVICE_KEY = 's'.repeat(40);
export const ALLOWED_ORIGIN = 'http://localhost:3100';

export function mon(callerId: string, overrides: Partial<MonInstance> = {}): MonInstance {
  return {
    monInstanceId: 'mon_ratti',
    speciesId: 'dex-002',
    nickname: 'Ratti',
    callerId,
    hatchedAt: NOW - 3_600_000,
    bond: 0.3,
    stage: 'Baby',
    voiceLineageId: null,
    originBlock: null,
    habitatTags: [],
    activeHours: null,
    ...overrides,
  };
}

export interface FakeV1Row {
  mon: MonInstance;
  care: CareState;
}

/** Requests the fake `/v1` received, for asserting headers and bodies. */
export interface V1Call {
  readonly method: string;
  readonly path: string;
  readonly headers: Headers;
  readonly body: unknown;
}

/**
 * An in-memory `/v1` that follows the admin-vite contract: `{ ok, data }`
 * envelopes, the on-behalf-of headers, per-device seq high-water marks.
 */
export function fakeV1(
  options: {
    rows?: FakeV1Row[];
    eggs?: EggRecord[];
    refuse?: 'ADULT_REQUIRED';
    /** First PUT: apply it, then fail like a timeout so the caller never sees the answer. */
    timeoutAfterApplyOnce?: boolean;
    /** First PUT: fail like a dropped connection before anything is applied. */
    dropBeforeApplyOnce?: boolean;
  } = {},
) {
  const rows = options.rows ?? [];
  const eggs = options.eggs ?? [];
  const lastSeq = new Map<string, number>();
  const calls: V1Call[] = [];
  /** Idempotency-Key → stored response body, replayed like payload's runIdempotent. */
  const stored = new Map<string, unknown>();
  let putsSeen = 0;
  const timeout = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method: init?.method ?? 'GET', path: url.pathname, headers, body });

    if (headers.get('X-NYC-MON-Service-Key') !== SERVICE_KEY) {
      return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } }, { status: 401 });
    }
    if (options.refuse !== undefined) {
      return Response.json({ ok: false, error: { code: options.refuse, message: 'x' } }, { status: 403 });
    }
    const callerId = headers.get('X-NYC-MON-On-Behalf-Of') ?? '';

    if (url.pathname === '/v1/me/mons') {
      return Response.json({ ok: true, data: { mons: rows.filter((r) => r.mon.callerId === callerId) } });
    }
    if (url.pathname === '/v1/me/eggs') {
      const mine = eggs.filter((e) => e.callerId === callerId).map((egg) => ({ egg, readyToHatch: egg.incubationEndsAt <= NOW }));
      return Response.json({ ok: true, data: { eggs: mine } });
    }
    const care = /^\/v1\/mons\/([^/]+)\/care$/.exec(url.pathname);
    if (care !== null && init?.method === 'PUT') {
      putsSeen += 1;
      const firstPut = putsSeen === 1;
      if (firstPut && options.dropBeforeApplyOnce === true) throw timeout();
      const key = headers.get('Idempotency-Key');
      if (key !== null && stored.has(key)) return Response.json(stored.get(key), { headers: { 'Idempotent-Replayed': 'true' } });
      const row = rows.find((r) => r.mon.monInstanceId === decodeURIComponent(care[1] ?? '') && r.mon.callerId === callerId);
      if (row === undefined) return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 });
      const { writes } = body as { writes: { deviceId: string; seq: number; at: number; action: Parameters<typeof applyCareAction>[1] }[] };
      let ackedSeq = 0;
      for (const write of writes) {
        if (write.seq <= (lastSeq.get(write.deviceId) ?? 0)) continue;
        const next = applyCareAction({ mon: row.mon, care: row.care }, write.action, write.at).state;
        row.mon = next.mon;
        row.care = next.care;
        lastSeq.set(write.deviceId, write.seq);
        ackedSeq = write.seq;
      }
      const answer = { ok: true, data: { mon: row.mon, care: row.care, ackedSeq } };
      if (key !== null) stored.set(key, answer);
      if (firstPut && options.timeoutAfterApplyOnce === true) throw timeout();
      return Response.json(answer);
    }
    return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 });
  };

  return { fetch: fetchImpl as typeof fetch, calls, rows };
}

export function row(callerId: string, careOverrides: Partial<CareState> = {}, monOverrides: Partial<MonInstance> = {}): FakeV1Row {
  const m = mon(callerId, monOverrides);
  return { mon: m, care: { ...createInitialCareState(m.monInstanceId, NOW - 60_000), ...careOverrides } };
}

/** Tokens the fake verifier accepts. */
export const TOKENS: Record<string, VerifiedToken> = {
  service: { kind: 'service', clientId: 'alexa', scopes: ['mcp:service'], expiresAt: NOW / 1000 + 3600 },
  adult: { kind: 'user', clientId: 'alexa', callerId: 'caller-adult', scopes: ['mcp:caller', 'mcp:care'], expiresAt: NOW / 1000 + 3600, birthYear: 1990 },
  'adult-no-claim': { kind: 'user', clientId: 'alexa', callerId: 'caller-adult', scopes: ['mcp:caller', 'mcp:care'], expiresAt: NOW / 1000 + 3600, birthYear: undefined },
  'read-only': { kind: 'user', clientId: 'alexa', callerId: 'caller-adult', scopes: ['mcp:caller'], expiresAt: NOW / 1000 + 3600, birthYear: 1990 },
  minor: { kind: 'user', clientId: 'alexa', callerId: 'caller-minor', scopes: ['mcp:caller', 'mcp:care'], expiresAt: NOW / 1000 + 3600, birthYear: 2011 },
};

export const fakeVerifier: TokenVerifier = {
  async verify(token) {
    const verified = TOKENS[token];
    if (verified === undefined) throw new InvalidTokenError('unknown token');
    return verified;
  },
};

export interface Running {
  readonly url: string;
  readonly mcpUrl: string;
  readonly close: () => Promise<void>;
}

/** Starts the real handler on an ephemeral port. */
export async function start(overrides: Partial<ServerDeps> & { devMode?: boolean; v1?: ReturnType<typeof fakeV1> } = {}): Promise<Running> {
  const v1 = overrides.v1 ?? fakeV1();
  let resolvedUrl = '';
  const handlerRef: { current?: ReturnType<typeof createHandler> } = {};
  const server: Server = createServer((req, res) => {
    void handlerRef.current?.(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  resolvedUrl = `http://127.0.0.1:${port}`;
  handlerRef.current = createHandler({
    resourceUrl: `${resolvedUrl}/mcp`,
    authorizationServer: 'http://127.0.0.1:5174',
    allowedOrigins: [ALLOWED_ORIGIN],
    verifier: fakeVerifier,
    data: new V1CallerData({ baseUrl: 'http://v1.test', serviceKey: SERVICE_KEY, timeoutMs: 400, fetch: v1.fetch, now: () => NOW }),
    presence: new PresenceService(),
    familiar: overrides.devMode === true ? new FixtureFamiliarDirectory(NOW) : undefined,
    now: () => NOW,
    ...overrides,
  });
  return {
    url: resolvedUrl,
    mcpUrl: `${resolvedUrl}/mcp`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** One raw JSON-RPC POST to `/mcp`. */
export async function rpc(
  running: Running,
  body: unknown,
  options: { token?: string; origin?: string; protocolVersion?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
  if (options.origin !== undefined) headers.origin = options.origin;
  if (options.protocolVersion !== undefined) headers['mcp-protocol-version'] = options.protocolVersion;
  return fetch(running.mcpUrl, { method: 'POST', headers, body: JSON.stringify(body) });
}

export function initialize(protocolVersion: string, id = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: { protocolVersion, capabilities: { roots: { listChanged: true } }, clientInfo: { name: 'Alexa+ MCP Client', version: '1.0.0' } },
  };
}

export function callTool(name: string, args: Record<string, unknown> = {}, id = 2) {
  return { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } };
}
