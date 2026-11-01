import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eggs as starterEggs } from '@acme/content/eggs';
import { createEmptySave } from '@acme/core/save';
import {
  applyCareAction, applyCareWrites, createEggRecord, createInitialCareState, deriveMonInstanceId, enqueueCareWrite,
  enqueueEggCreate, mintMonInstance, toCreateEggRequest,
} from '@acme/core/sim';
import type { CareAction, CareState, CareWrite, EggRecord, MonInstance, SaveCurrent } from '@acme/core/types';
import { applySyncReplyToSave, runSync } from './sync-model.ts';
import { adoptRequest, careRequest, careWriteKey, createSyncTransport } from './sync-transport.ts';

const T0 = Date.UTC(2026, 9, 20, 12, 0);
const MIN = 60_000;
const DEVICE = 'device-ipad';
const starter = starterEggs[0]!;

function eggRecord(eggId: string, createdAt = T0): EggRecord {
  return createEggRecord({
    eggId, speciesId: starter.speciesId, hatchesIntoSpeciesId: starter.hatchesIntoSpeciesId, callerId: 'caller-local',
    nickname: null, incubationMinutes: 15, createdAt,
  });
}

/** A save with one hatched Mon, its egg still queued for `POST /v1/eggs`, and `actions` given as care. */
function hatchedSave(actions: readonly CareAction[], eggId = 'egg-1'): SaveCurrent {
  const egg = eggRecord(eggId);
  const mon: MonInstance = { ...mintMonInstance(egg), nickname: 'Pip' };
  let save: SaveCurrent = {
    ...createEmptySave(DEVICE, T0),
    eggs: [egg],
    mons: [mon],
    care: [createInitialCareState(mon.monInstanceId, egg.incubationEndsAt + MIN)],
  };
  save = { ...save, queue: enqueueEggCreate(save.queue, toCreateEggRequest(egg), T0) };
  return actions.reduce((s, action, i) => care(s, mon.monInstanceId, action, egg.incubationEndsAt + (i + 2) * MIN), save);
}

function care(save: SaveCurrent, monInstanceId: string, action: CareAction, at: number): SaveCurrent {
  const mon = save.mons.find((m) => m.monInstanceId === monInstanceId)!;
  const state = save.care.find((c) => c.monInstanceId === monInstanceId)!;
  const result = applyCareAction({ mon, care: state }, action, at);
  const { queue } = enqueueCareWrite(save.queue, { monInstanceId, at: result.state.care.updatedAt, action });
  return {
    ...save,
    queue,
    mons: save.mons.map((m) => (m.monInstanceId === monInstanceId ? result.state.mon : m)),
    care: save.care.map((c) => (c.monInstanceId === monInstanceId ? result.state.care : c)),
  };
}

const ACTIONS: readonly CareAction[] = [{ kind: 'feed' }, { kind: 'play', quality: 0.8 }, { kind: 'rest' }];

interface ServerMon { mon: MonInstance; care: CareState | null; lastSeqByDevice: Record<string, number> }
interface Call { method: string; path: string; key: string | null; body: unknown }

/**
 * An in-memory `/v1` that behaves like game.ts and adopt.ts: Idempotency-Key
 * replay, per-device seq tie-break through the core sim, owner by session.
 */
function fakeServer(options: { signedIn?: boolean } = {}) {
  const mons = new Map<string, ServerMon>();
  const eggs = new Map<string, unknown>();
  const stored = new Map<string, { status: number; body: string }>();
  const calls: Call[] = [];
  let applies = 0;
  /** Requests whose work lands but whose answer is lost (a dropped connection). */
  const loseAnswer = new Set<string>();
  const failWith = new Map<string, { status: number; code: string }>();

  const json = (status: number, body: unknown) => ({ status, body: JSON.stringify(body) });
  const ok = (data: unknown) => json(200, { ok: true, data });
  const err = (status: number, code: string) => json(status, { ok: false, error: { code, message: code } });

  function handle(method: string, path: string, body: any): { status: number; body: string } {
    if (options.signedIn === false) return err(401, 'UNAUTHORIZED');
    const forced = failWith.get(`${method} ${path}`);
    if (forced !== undefined) return err(forced.status, forced.code);
    if (method === 'GET' && path === '/v1/me/mons') {
      return ok({ mons: [...mons.values()].map((m) => ({ mon: m.mon, care: m.care ?? createInitialCareState(m.mon.monInstanceId, m.mon.hatchedAt) })) });
    }
    if (method === 'POST' && path === '/v1/eggs') {
      eggs.set(body.eggId, body);
      return ok({ eggId: body.eggId, monInstanceId: deriveMonInstanceId(body.eggId), incubationEndsAt: T0 + 15 * MIN });
    }
    if (method === 'POST' && path === '/v1/mons/adopt') {
      const existing = mons.get(body.mon.monInstanceId);
      if (existing !== undefined) return ok({ mon: existing.mon, care: existing.care, ackedSeq: existing.lastSeqByDevice[body.deviceId] ?? 0, adopted: false });
      const minted = mintMonInstance({ ...eggRecord(body.egg.eggId, body.egg.createdAt), callerId: 'server-caller' });
      const mon = { ...minted, bond: body.mon.bond, nickname: body.mon.nickname };
      mons.set(mon.monInstanceId, { mon, care: body.care, lastSeqByDevice: { [body.deviceId]: body.appliedThroughSeq } });
      return ok({ mon, care: body.care, ackedSeq: body.appliedThroughSeq, adopted: true });
    }
    const careMatch = /^\/v1\/mons\/([^/]+)\/care$/.exec(path);
    if (method === 'PUT' && careMatch !== null) {
      const record = mons.get(decodeURIComponent(careMatch[1]!));
      if (record === undefined) return err(404, 'NOT_FOUND');
      const writes = body.writes as CareWrite[];
      const before = { ...record.lastSeqByDevice };
      const applied = writes.filter((w) => w.seq > (before[w.deviceId] ?? 0)).length;
      const next = applyCareWrites(
        { state: { mon: record.mon, care: record.care ?? createInitialCareState(record.mon.monInstanceId, record.mon.hatchedAt) }, lastSeqByDevice: before },
        writes,
      );
      applies += applied;
      Object.assign(record, { mon: next.state.mon, care: next.state.care, lastSeqByDevice: next.lastSeqByDevice });
      return ok({ mon: next.state.mon, care: next.state.care, ackedSeq: next.lastSeqByDevice[writes[0]!.deviceId] ?? 0, applied });
    }
    return err(404, 'NO_ROUTE');
  }

  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const path = new URL(url).pathname;
    const method = init.method ?? 'GET';
    const headers = init.headers as Record<string, string>;
    const key = headers['Idempotency-Key'] ?? null;
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, key, body });
    const scoped = key === null ? null : `${method} ${path} ${key}`;
    let answer = scoped === null ? undefined : stored.get(scoped);
    if (answer === undefined) {
      answer = handle(method, path, body);
      if (scoped !== null && answer.status < 500) stored.set(scoped, answer);
    }
    if (key !== null && loseAnswer.delete(key)) throw new TypeError('Network request failed');
    return new Response(answer.body, { status: answer.status, headers: { 'content-type': 'application/json' } });
  };

  return { mons, eggs, calls, fetch, loseAnswer, failWith, get applies() { return applies; } };
}

function transportFor(server: ReturnType<typeof fakeServer>, read: () => SaveCurrent | undefined) {
  return createSyncTransport({ baseUrl: 'http://admin.test', headers: { origin: 'nycmon://' }, fetch: server.fetch, readSave: read });
}

describe('M21 transport: CareWrite to PUT /v1/mons/:id/care', () => {
  it('sends the queued write itself, one per request, keyed by device and seq', () => {
    const write: CareWrite = { deviceId: DEVICE, seq: 7, monInstanceId: 'mon_ab/c', at: T0, action: { kind: 'play', quality: 0.5 } };
    const req = careRequest(write);
    assert.equal(req.path, '/v1/mons/mon_ab%2Fc/care');
    assert.equal(req.key, `care-${DEVICE}-7`);
    assert.deepEqual(req.body, { writes: [write] });
  });

  it("builds an adopt claim from the save: the device's state and the last seq it already holds", () => {
    const save = care(hatchedSave(ACTIONS), deriveMonInstanceId('egg-1'), { kind: 'wake' }, T0 + 60 * MIN);
    const monId = deriveMonInstanceId('egg-1');
    const body = adoptRequest(save, save.queue, monId);
    assert.ok(body);
    assert.equal(body.appliedThroughSeq, 4);
    assert.equal(body.deviceId, DEVICE);
    assert.deepEqual(body.care, save.care[0]);
    assert.equal(body.mon.nickname, 'Pip');
    assert.equal(body.egg.createdAt, T0);
    assert.equal(adoptRequest(save, save.queue, 'mon_unknown'), null);
  });
});

describe('M21 transport against a server that has never seen the Mon', () => {
  it('claims the Mon with its care, then has nothing left to replay', async () => {
    let save = hatchedSave(ACTIONS);
    const server = fakeServer();
    const transport = transportFor(server, () => save);
    const result = await runSync({ online: true, queue: save.queue, transport, nowMs: T0 + DAY() });
    assert.equal(result.outcome, 'synced');
    assert.deepEqual(server.calls.map((c) => `${c.method} ${c.path}`), ['GET /v1/me/mons', 'POST /v1/mons/adopt']);
    assert.equal(server.calls[1]!.key, 'adopt-egg-1');
    const monId = deriveMonInstanceId('egg-1');
    assert.deepEqual(server.mons.get(monId)!.care, save.care[0]);
    assert.deepEqual(server.mons.get(monId)!.lastSeqByDevice, { [DEVICE]: 3 });
    save = applySyncReplyToSave(save, result.reply!);
    assert.equal(save.queue.entries.length, 0);
    assert.equal(save.queue.eggCreates.length, 0);
    assert.equal(server.eggs.size, 0, 'a hatched egg goes up with its Mon, not through POST /v1/eggs');
  });

  it('replays care given after the claim on top, and the server ends where the device is', async () => {
    let save = hatchedSave(ACTIONS);
    const server = fakeServer();
    const monId = deriveMonInstanceId('egg-1');
    const r1 = await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 1 });
    save = applySyncReplyToSave(save, r1.reply!);
    save = care(save, monId, { kind: 'wake' }, T0 + 120 * MIN);
    save = care(save, monId, { kind: 'feed' }, T0 + 130 * MIN);
    const before = server.calls.length;
    const r2 = await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 2 });
    assert.equal(r2.outcome, 'synced');
    const puts = server.calls.slice(before).filter((c) => c.method === 'PUT');
    assert.deepEqual(puts.map((c) => c.key), [careWriteKey({ deviceId: DEVICE, seq: 4 }), careWriteKey({ deviceId: DEVICE, seq: 5 })]);
    assert.deepEqual(server.mons.get(monId)!.care, save.care[0]);
    save = applySyncReplyToSave(save, r2.reply!);
    assert.equal(save.queue.entries.length, 0);
    assert.deepEqual(r2.conflicts, []);
  });

  it('sends an egg that has not hatched here through POST /v1/eggs with its own key', async () => {
    const egg = eggRecord('egg-2');
    const save: SaveCurrent = { ...createEmptySave(DEVICE, T0), eggs: [egg], queue: enqueueEggCreate(createEmptySave(DEVICE, T0).queue, toCreateEggRequest(egg), T0) };
    const server = fakeServer();
    const result = await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 1 });
    assert.equal(result.outcome, 'synced');
    assert.deepEqual(server.calls.map((c) => [c.method, c.path, c.key]), [['POST', '/v1/eggs', 'egg-egg-2']]);
    assert.equal(applySyncReplyToSave(save, result.reply!).queue.eggCreates.length, 0);
  });
});

describe('M21 transport against a server that has the Mon', () => {
  async function seeded(actions: readonly CareAction[]) {
    const save = hatchedSave([]);
    const server = fakeServer();
    const claimed = await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 0 });
    let next = applySyncReplyToSave(save, claimed.reply!);
    const monId = deriveMonInstanceId('egg-1');
    actions.forEach((a, i) => { next = care(next, monId, a, T0 + (30 + i) * MIN); });
    server.calls.length = 0;
    return { server, save: next, monId };
  }

  it('retries after a lost answer with the same keys and applies nothing twice', async () => {
    const { server, save, monId } = await seeded(ACTIONS);
    server.loseAnswer.add(careWriteKey({ deviceId: DEVICE, seq: 2 }));
    const first = await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 1 });
    assert.equal(first.outcome, 'failed');
    const second = await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 2 });
    assert.equal(second.outcome, 'synced');
    const keys = server.calls.filter((c) => c.method === 'PUT').map((c) => c.key);
    assert.deepEqual(keys, ['care-device-ipad-1', 'care-device-ipad-2', 'care-device-ipad-1', 'care-device-ipad-2', 'care-device-ipad-3']);
    assert.equal(server.applies, 3, 'three writes, three applies, whatever the retries');
    assert.deepEqual(server.mons.get(monId)!.care, save.care[0]);
    assert.deepEqual(second.conflicts, []);
  });

  it("maps writes the server set aside to serverKept and a sync-log line", async () => {
    const { server, save, monId } = await seeded(ACTIONS);
    // Another install with this device id already sent seq 2 (a restored save): the server keeps its own.
    server.mons.get(monId)!.lastSeqByDevice[DEVICE] = 2;
    const result = await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 99 });
    assert.equal(result.outcome, 'synced');
    assert.deepEqual(result.reply!.serverKept, [{ monInstanceId: monId, count: 2 }]);
    assert.deepEqual(result.conflicts, [{ id: `99-${monId}`, at: 99, monInstanceId: monId, count: 2 }]);
  });

  it("adopts the server's state and keeps the care queued during the send", async () => {
    const { server, save, monId } = await seeded([{ kind: 'feed' }]);
    // A second device's care already moved the server's meters.
    const record = server.mons.get(monId)!;
    record.care = { ...record.care!, social: 0.95, fullness: 0.2 };
    const result = await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 1 });
    const later = care(save, monId, { kind: 'rest' }, T0 + 50 * MIN);
    const after = applySyncReplyToSave(later, result.reply!);
    assert.deepEqual(after.queue.entries.map((w) => w.seq), [2]);
    const expected = applyCareAction({ mon: after.mons[0]!, care: record.care! }, { kind: 'rest' }, later.queue.entries.at(-1)!.at).state.care;
    assert.deepEqual(after.care[0], expected);
    assert.equal(after.mons[0]!.nickname, 'Pip');
    assert.equal(after.mons[0]!.callerId, 'caller-local', "the save keeps the device's Caller id");
  });
});

describe('M21 transport outcomes', () => {
  const save = hatchedSave(ACTIONS);

  it('reads a 401 as signed out', async () => {
    const server = fakeServer({ signedIn: false });
    assert.equal((await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 1 })).outcome, 'signed-out');
  });

  it('reads a refusal as rejected and a 5xx, a 429 or no answer as failed', async () => {
    for (const [status, code, outcome] of [[400, 'INVALID_RECORD', 'rejected'], [409, 'NOT_READY', 'failed'], [503, 'INTERNAL_ERROR', 'failed'], [429, 'INVALID_RECORD', 'failed']] as const) {
      const server = fakeServer();
      server.failWith.set('POST /v1/mons/adopt', { status, code });
      const result = await runSync({ online: true, queue: save.queue, transport: transportFor(server, () => save), nowMs: 1 });
      assert.equal(result.outcome, outcome, `${status} ${code}`);
    }
    const down = createSyncTransport({ baseUrl: 'http://admin.test', fetch: async () => { throw new TypeError('Network request failed'); }, readSave: () => save });
    assert.equal((await runSync({ online: true, queue: save.queue, transport: down, nowMs: 1 })).outcome, 'failed');
  });

  it('sends the session cookie and the app origin on every call', async () => {
    const server = fakeServer();
    const seen: RequestInit[] = [];
    const transport = createSyncTransport({
      baseUrl: 'http://admin.test', headers: { origin: 'nycmon://' }, readSave: () => save,
      fetch: (url, init) => { seen.push(init); return server.fetch(url, init); },
    });
    await transport.send(save.queue);
    assert.ok(seen.length > 0);
    for (const init of seen) {
      assert.equal(init.credentials, 'include');
      assert.equal((init.headers as Record<string, string>).origin, 'nycmon://');
    }
  });
});

function DAY(): number {
  return 24 * 60 * MIN;
}
