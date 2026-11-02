import { createHash } from 'node:crypto';
import { Client, StreamableHTTPClientTransport, type CallToolResult } from '@modelcontextprotocol/client';
import { ListMyMonsResponseSchema, capVoiceStage, voiceStage as voiceStageAt, type LifecycleStage, type VoiceStage } from '@acme/core';
import { LIFECYCLE_STAGES } from '@acme/core';
import { z } from 'zod';

/**
 * The Caller's Mons as this server finds them out, never as a request body
 * says they are. Decision 32's speech gate needs a Mon's lifecycle stage and
 * `hatchedAt`; a browser that could name them could make an Egg talk. So
 * /api/model and /api/tts look the Mon up here, and a stage or voice stage
 * from the browser can only lower what the Mon may say.
 *
 * Two sources:
 * - the NVIDIA companion: admin-vite's `GET /v1/me/mons` with the service
 *   key on behalf of the signed-in Caller (the same delegation as companion
 *   memory and the MCP server's data layer);
 * - the Bedrock simulator: the MCP server's `get_mon_status`, called with the
 *   person's own MCP bearer token (or none in dev-bypass).
 *
 * A roster is null when the server could not find out (no sign-in, /v1 or MCP
 * down); callers then treat the Mon as the most restrictive stage. An empty
 * roster means the Caller has no Mon: an Egg at most, so babble too.
 */

export interface ServerMon {
  readonly speciesId: string;
  readonly stage: LifecycleStage;
  readonly hatchedAt: number | null;
  readonly voiceLineageId: string | null;
}

/** The companion (active) Mon first. Null: unknown. */
export type MonRoster = readonly ServerMon[] | null;

/**
 * One request's roster lookup; `authorization` is the request's header.
 * `claim` is what the request body says, passed only so a test double can
 * echo it; a production lookup never reads it.
 */
export type MonRosterLookup = (authorization: string | null, claim?: { readonly lineageId: string; readonly stage: LifecycleStage }) => Promise<MonRoster>;

const RANK: Readonly<Record<VoiceStage, number>> = { 'baby-talk': 0, limited: 1, full: 2 };
const lower = (a: VoiceStage, b: VoiceStage): VoiceStage => (RANK[a] <= RANK[b] ? a : b);

/** What the server lets a Mon say, and as which Mon. */
export interface ServerVoice {
  /** The Mon the line belongs to; undefined when the server knows of none. */
  readonly mon: ServerMon | undefined;
  readonly voiceStage: VoiceStage;
}

/**
 * The Mon speaking and its voice stage at `now`. The Mon is the roster's one
 * with the claimed lineage, else the companion. A claimed stage and voice stage
 * lower the result through `capVoiceStage` and never raise it. No roster, no
 * Mon, or a lineage that is not the Caller's: `baby-talk`.
 */
export function serverVoice(
  roster: MonRoster,
  claim: { readonly lineageId?: string | undefined; readonly stage?: LifecycleStage | undefined; readonly voiceStage?: VoiceStage | undefined },
  now: number,
): ServerVoice {
  if (roster === null || roster.length === 0) return { mon: undefined, voiceStage: 'baby-talk' };
  const mon = claim.lineageId === undefined ? roster[0] : roster.find((m) => m.voiceLineageId === claim.lineageId);
  if (mon === undefined) return { mon: undefined, voiceStage: 'baby-talk' };
  let stage = voiceStageAt({ stage: mon.stage, hatchedAt: mon.hatchedAt }, now);
  if (claim.stage !== undefined) stage = lower(stage, capVoiceStage(claim.stage, claim.voiceStage));
  else if (claim.voiceStage !== undefined) stage = lower(stage, claim.voiceStage);
  return { mon, voiceStage: stage };
}

/** Caches one lookup per key for `maxAgeMs`, and shares one in flight. */
function cached<K>(lookup: (key: K) => Promise<MonRoster>, keyOf: (key: K) => string, maxAgeMs: number, now: () => number) {
  const entries = new Map<string, { at: number; roster: Promise<MonRoster> }>();
  return (key: K): Promise<MonRoster> => {
    const k = keyOf(key);
    const hit = entries.get(k);
    if (hit && now() - hit.at < maxAgeMs) return hit.roster;
    const roster = lookup(key).catch(() => null);
    entries.set(k, { at: now(), roster });
    // A failed lookup is not kept: the next request asks again.
    void roster.then((r) => { if (r === null) entries.delete(k); });
    if (entries.size > 1000) entries.delete(entries.keys().next().value as string);
    return roster;
  };
}

const SERVICE_KEY_HEADER = 'X-NYC-MON-Service-Key';
const ON_BEHALF_OF_HEADER = 'X-NYC-MON-On-Behalf-Of';
const Envelope = z.object({ ok: z.literal(true), data: ListMyMonsResponseSchema });

/** The roster from `/v1/me/mons`, the companion first, then newest hatch first. */
export function createV1MonRoster(options: {
  readonly baseUrl: string;
  readonly serviceKey: string;
  readonly fetch?: (url: URL, init: RequestInit) => Promise<Response>;
  readonly timeoutMs?: number;
  readonly maxAgeMs?: number;
  readonly now?: () => number;
}): (callerId: string) => Promise<MonRoster> {
  const doFetch = options.fetch ?? ((url, init) => fetch(url, init));
  const lookup = async (callerId: string): Promise<MonRoster> => {
    const res = await doFetch(new URL('/v1/me/mons', options.baseUrl), {
      method: 'GET',
      headers: { accept: 'application/json', [SERVICE_KEY_HEADER]: options.serviceKey, [ON_BEHALF_OF_HEADER]: callerId },
      signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
    });
    if (!res.ok) return null;
    const parsed = Envelope.safeParse(await res.json());
    if (!parsed.success) return null;
    const { mons, activeMonInstanceId } = parsed.data.data;
    const ordered = [...mons].sort((a, b) =>
      (a.mon.monInstanceId === activeMonInstanceId ? -1 : 0) - (b.mon.monInstanceId === activeMonInstanceId ? -1 : 0) || b.mon.hatchedAt - a.mon.hatchedAt);
    return ordered.map(({ mon }) => ({ speciesId: mon.speciesId, stage: mon.stage, hatchedAt: mon.hatchedAt, voiceLineageId: mon.voiceLineageId ?? null }));
  };
  return cached(lookup, (callerId) => callerId, options.maxAgeMs ?? 10_000, options.now ?? Date.now);
}

const isStage = (v: unknown): v is LifecycleStage => (LIFECYCLE_STAGES as readonly unknown[]).includes(v);

/** The roster `get_mon_status` reports: one Mon, `[]` for `no-mon`, null when it can't be read. */
export function rosterFromStatus(result: CallToolResult): MonRoster {
  const sc = result.structuredContent as { mon?: unknown; error?: { reason?: unknown } } | undefined;
  if (result.isError) return sc?.error?.reason === 'no-mon' ? [] : null;
  const mon = sc?.mon as { speciesId?: unknown; stage?: unknown; hatchedAt?: unknown; voice?: { lineageId?: unknown } | null } | undefined;
  if (!mon || typeof mon.speciesId !== 'string' || !isStage(mon.stage)) return null;
  return [{
    speciesId: mon.speciesId,
    stage: mon.stage,
    hatchedAt: typeof mon.hatchedAt === 'number' && Number.isFinite(mon.hatchedAt) ? mon.hatchedAt : null,
    voiceLineageId: typeof mon.voice?.lineageId === 'string' ? mon.voice.lineageId : null,
  }];
}

/** The roster from the MCP server's `get_mon_status`, called as the person (their bearer token). */
export function createMcpMonRoster(options: {
  readonly mcpUrl: string;
  /** Tests pass a fake; the default opens one MCP session per lookup. */
  readonly callStatus?: (authorization: string | null) => Promise<CallToolResult>;
  readonly maxAgeMs?: number;
  readonly now?: () => number;
}): MonRosterLookup {
  const callStatus = options.callStatus ?? (async (authorization: string | null) => {
    const client = new Client({ name: 'nyc-mon-sim-server', version: '0.1.0' });
    const transport = new StreamableHTTPClientTransport(new URL(options.mcpUrl), {
      requestInit: { headers: authorization ? { authorization } : {} },
    });
    await client.connect(transport);
    try {
      return (await client.callTool({ name: 'get_mon_status', arguments: {} })) as CallToolResult;
    } finally {
      await client.close().catch(() => {});
    }
  });
  // Keyed by a hash of the header, so the token itself is never a map key.
  const keyOf = (authorization: string | null) => createHash('sha256').update(authorization ?? '').digest('hex');
  return cached(async (authorization: string | null) => rosterFromStatus(await callStatus(authorization)), keyOf, options.maxAgeMs ?? 10_000, options.now ?? Date.now);
}
