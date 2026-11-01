import { describe, expect, it, vi } from 'vitest';
import { BABY_TALK_MS, createInitialCareState } from '@acme/core';
import { createMcpMonRoster, createV1MonRoster, rosterFromStatus, serverVoice, type ServerMon } from '../server/mon-roster.ts';

const NOW = Date.UTC(2026, 9, 29, 12);
const KEY = 'k'.repeat(40);

function v1Mon(id: string, stage: string, hatchedAt: number, voiceLineageId: string | null) {
  return {
    mon: { monInstanceId: id, speciesId: 'dex-001', nickname: null, callerId: '12', stage, bond: 0, hatchedAt, gender: 'female', voiceLineageId },
    care: createInitialCareState(id, hatchedAt),
  };
}

describe('serverVoice: the server decides, a claim only lowers', () => {
  const egg: ServerMon = { speciesId: 'dex-001', stage: 'Egg', hatchedAt: null, voiceLineageId: 'dex-001/female/1' };
  const small: ServerMon = { speciesId: 'dex-002', stage: 'Small', hatchedAt: NOW - 9 * BABY_TALK_MS, voiceLineageId: 'dex-001/male/2' };
  const baby: ServerMon = { speciesId: 'dex-001', stage: 'Baby', hatchedAt: NOW - 1000, voiceLineageId: 'dex-001/female/3' };

  it('an Egg claiming Max and full still babbles', () => {
    expect(serverVoice([egg], { lineageId: egg.voiceLineageId!, stage: 'Max', voiceStage: 'full' }, NOW).voiceStage).toBe('baby-talk');
  });
  it('a first-day Baby babbles, then is limited', () => {
    expect(serverVoice([baby], {}, NOW).voiceStage).toBe('baby-talk');
    expect(serverVoice([baby], {}, NOW + BABY_TALK_MS).voiceStage).toBe('limited');
  });
  it('a Small speaks, unless the claim lowers it', () => {
    expect(serverVoice([small], {}, NOW).voiceStage).toBe('full');
    expect(serverVoice([small], { stage: 'Baby' }, NOW).voiceStage).toBe('limited');
    expect(serverVoice([small], { voiceStage: 'baby-talk' }, NOW).voiceStage).toBe('baby-talk');
  });
  it('picks the claimed lineage among the Caller’s Mons, else the companion', () => {
    expect(serverVoice([small, egg], { lineageId: egg.voiceLineageId! }, NOW)).toEqual({ mon: egg, voiceStage: 'baby-talk' });
    expect(serverVoice([small, egg], {}, NOW).mon).toBe(small);
  });
  it('unknown roster, no Mon, or someone else’s lineage: babble', () => {
    expect(serverVoice(null, { stage: 'Max' }, NOW).voiceStage).toBe('baby-talk');
    expect(serverVoice([], { stage: 'Max' }, NOW).voiceStage).toBe('baby-talk');
    expect(serverVoice([small], { lineageId: 'dex-061/female/1' }, NOW).voiceStage).toBe('baby-talk');
  });
});

describe('createV1MonRoster', () => {
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  it('asks /v1/me/mons on behalf of the Caller with the service key, companion first', async () => {
    const fetch = answer({ ok: true, data: { mons: [v1Mon('mon_a', 'Small', NOW - 5000, 'dex-001/female/1'), v1Mon('mon_b', 'Baby', NOW - 1000, 'dex-001/male/2')], activeMonInstanceId: 'mon_a' } });
    const roster = await createV1MonRoster({ baseUrl: 'http://v1.test', serviceKey: KEY, fetch })('12');
    expect(roster?.map((m) => m.stage)).toEqual(['Small', 'Baby']);
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('http://v1.test/v1/me/mons');
    const headers = new Headers(init.headers);
    expect(headers.get('X-NYC-MON-On-Behalf-Of')).toBe('12');
    expect(headers.get('X-NYC-MON-Service-Key')).toBe(KEY);
  });

  it('without a companion, newest hatch first; caches per Caller', async () => {
    const fetch = answer({ ok: true, data: { mons: [v1Mon('mon_a', 'Small', NOW - 5000, null), v1Mon('mon_b', 'Baby', NOW - 1000, null)], activeMonInstanceId: null } });
    const lookup = createV1MonRoster({ baseUrl: 'http://v1.test', serviceKey: KEY, fetch, now: () => NOW });
    expect((await lookup('12'))?.[0]?.stage).toBe('Baby');
    await lookup('12');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('is null when /v1 fails or answers off-contract, and does not keep the failure', async () => {
    const down = vi.fn(async () => { throw new Error('down'); });
    const lookup = createV1MonRoster({ baseUrl: 'http://v1.test', serviceKey: KEY, fetch: down });
    expect(await lookup('12')).toBeNull();
    expect(await lookup('12')).toBeNull();
    expect(down).toHaveBeenCalledTimes(2);
    expect(await createV1MonRoster({ baseUrl: 'http://v1.test', serviceKey: KEY, fetch: answer({ ok: true, data: { nope: 1 } }) })('12')).toBeNull();
    expect(await createV1MonRoster({ baseUrl: 'http://v1.test', serviceKey: KEY, fetch: answer({}, 500) })('12')).toBeNull();
  });
});

describe('the MCP roster (get_mon_status as the person)', () => {
  const status = { content: [], structuredContent: { mon: { speciesId: 'dex-001', stage: 'Egg', hatchedAt: NOW, voice: { lineageId: 'dex-001/female/1' } } } };

  it('reads the one Mon get_mon_status reports', () => {
    expect(rosterFromStatus(status)).toEqual([{ speciesId: 'dex-001', stage: 'Egg', hatchedAt: NOW, voiceLineageId: 'dex-001/female/1' }]);
    expect(rosterFromStatus({ content: [], isError: true, structuredContent: { error: { reason: 'no-mon' } } })).toEqual([]);
    expect(rosterFromStatus({ content: [], isError: true, structuredContent: { error: { reason: 'upstream' } } })).toBeNull();
    expect(rosterFromStatus({ content: [], structuredContent: { mon: { stage: 'Adult' } } })).toBeNull();
  });

  it('calls with the request’s own authorization, caches by it, and is null when MCP fails', async () => {
    const callStatus = vi.fn(async () => status);
    const lookup = createMcpMonRoster({ mcpUrl: 'http://mcp.test/mcp', callStatus, now: () => NOW });
    await lookup('Bearer a');
    await lookup('Bearer a');
    await lookup('Bearer b');
    expect(callStatus.mock.calls.map((c) => (c as unknown[])[0])).toEqual(['Bearer a', 'Bearer b']);
    const failing = createMcpMonRoster({ mcpUrl: 'http://mcp.test/mcp', callStatus: async () => { throw new Error('down'); } });
    expect(await failing('Bearer a')).toBeNull();
  });
});
