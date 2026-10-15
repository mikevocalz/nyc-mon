import { afterEach, describe, expect, it } from 'vitest';
import { deviceIdFor } from '../data/v1.ts';
import { callTool, fakeV1, NOW, row, rpc, SERVICE_KEY, start, type Running } from './harness.ts';

let running: Running | undefined;
afterEach(async () => {
  await running?.close();
  running = undefined;
});

interface ToolResponse {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent: Record<string, unknown> & { error?: { reason: string; message: string; nextStep: string } };
}

async function call(name: string, args: Record<string, unknown> = {}, id: number = nextId++): Promise<ToolResponse> {
  if (running === undefined) throw new Error('server not started');
  const response = await rpc(running, callTool(name, args, id), { token: 'adult', protocolVersion: '2025-11-25' });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { result?: ToolResponse; error?: unknown };
  if (body.result === undefined) throw new Error(`JSON-RPC error: ${JSON.stringify(body.error)}`);
  return body.result;
}

const ADULT = 'caller-adult';
let nextId = 100;

describe('read tools', () => {
  it('get_mon_status returns current meters, mood and needs', async () => {
    running = await start({ v1: fakeV1({ rows: [row(ADULT, { fullness: 0.1 })] }) });
    const result = await call('get_mon_status');
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      mon: { monId: 'mon_ratti', name: 'Ratti', stage: 'Baby' },
      care: { activity: 'awake' },
      mood: 'needs-fullness',
    });
    expect(result.structuredContent.needs).toContain('fullness');
    expect(JSON.parse(result.content[0]?.text ?? '')).toEqual(result.structuredContent);
  });

  it('check_on_mon suggests the care that helps most', async () => {
    running = await start({ v1: fakeV1({ rows: [row(ADULT, { fullness: 0.1, social: 0.1 })] }) });
    const result = await call('check_on_mon');
    expect(result.structuredContent).toMatchObject({ mood: 'needs-fullness', suggestedCare: ['feed', 'play'] });
    expect(result.structuredContent).not.toHaveProperty('presentPeople');
  });

  it('check_on_mon picks the named Mon when monId is given', async () => {
    const second = row(ADULT, {}, { monInstanceId: 'mon_older', nickname: 'Pidge', hatchedAt: NOW - 86_400_000 });
    running = await start({ v1: fakeV1({ rows: [row(ADULT), second] }) });
    expect((await call('check_on_mon')).structuredContent).toMatchObject({ mon: { name: 'Ratti' } });
    expect((await call('check_on_mon', { monId: 'mon_older' })).structuredContent).toMatchObject({ mon: { name: 'Pidge' } });
  });

  it('check_incubation reports minutes left and readiness from /v1/me/eggs', async () => {
    const egg = {
      eggId: 'egg_1',
      monInstanceId: 'mon_egg_1',
      speciesId: 'dex-001',
      hatchesIntoSpeciesId: 'dex-002',
      callerId: ADULT,
      nickname: null,
      incubationMinutes: 30 as const,
      createdAt: NOW - 20 * 60_000,
      incubationEndsAt: NOW + 10 * 60_000,
    };
    const v1 = fakeV1({ eggs: [egg] });
    running = await start({ v1 });
    const result = await call('check_incubation');
    expect(result.structuredContent).toEqual({
      incubating: true,
      eggs: [{ eggId: 'egg_1', speciesId: 'dex-001', incubationEndsAt: NOW + 600_000, minutesRemaining: 10, readyToHatch: false }],
    });
    expect(v1.calls[0]?.path).toBe('/v1/me/eggs');
  });

  it('check_incubation says nothing is incubating when there are no eggs', async () => {
    running = await start();
    expect((await call('check_incubation')).structuredContent).toEqual({ incubating: false, eggs: [] });
  });

  it('talk_to_mon returns state for the client model and writes nothing', async () => {
    const v1 = fakeV1({ rows: [row(ADULT)] });
    running = await start({ v1 });
    const result = await call('talk_to_mon');
    expect(result.structuredContent).toMatchObject({ mon: { name: 'Ratti' }, activity: 'awake', speaker: { kind: 'caller' } });
    expect(v1.calls.every((c) => c.method === 'GET')).toBe(true);
  });
});

describe('care tools', () => {
  it('feed_mon shares a meal through PUT /v1/mons/:id/care with no food item', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { fullness: 0.2 })] });
    running = await start({ v1 });
    const result = await call('feed_mon');
    expect(result.structuredContent).toMatchObject({ applied: true, effect: 'eaten' });
    const put = v1.calls.find((c) => c.method === 'PUT');
    expect(put?.path).toBe('/v1/mons/mon_ratti/care');
    const write = (put?.body as { writes: Record<string, unknown>[] }).writes[0];
    expect(write).toMatchObject({ action: { kind: 'feed' }, monInstanceId: 'mon_ratti', at: NOW, deviceId: deviceIdFor(ADULT) });
    expect(put?.headers.get('X-NYC-MON-Service-Key')).toBe(SERVICE_KEY);
    expect(put?.headers.get('X-NYC-MON-On-Behalf-Of')).toBe(ADULT);
    expect(put?.headers.get('authorization')).toBeNull();
  });

  it('rest_mon then wake_mon round-trips through /v1', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { energy: 0.9 })] });
    running = await start({ v1 });
    expect((await call('rest_mon')).structuredContent).toMatchObject({ applied: true, effect: 'fell-asleep', care: { activity: 'asleep' } });
    expect((await call('wake_mon')).structuredContent).toMatchObject({ applied: true, effect: 'woke', care: { activity: 'awake' } });
  });

  it('play_with_mon sends the requested quality', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { energy: 0.9, social: 0.2 })] });
    running = await start({ v1 });
    const result = await call('play_with_mon', { quality: 0.8 });
    expect(result.structuredContent).toMatchObject({ applied: true, effect: 'played' });
    const write = (v1.calls.find((c) => c.method === 'PUT')?.body as { writes: { action: unknown }[] }).writes[0];
    expect(write?.action).toEqual({ kind: 'play', quality: 0.8 });
  });

  it('a declined action writes nothing and says why', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { activity: { kind: 'asleep', since: NOW - 60_000 }, energy: 0.2 })] });
    running = await start({ v1 });
    const result = await call('feed_mon');
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ applied: false, declinedBecause: 'asleep' });
    expect(v1.calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('reuses key, seq and time only for an explicit retry-stable intent UUID', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { fullness: 0.2 })] });
    running = await start({ v1 });
    const intentId = '43e358c8-97b5-4fd9-9217-70e0e65f6df4';
    const first = await call('feed_mon', { intentId }, 7);
    const resent = await call('feed_mon', { intentId }, 7);
    expect(first.structuredContent).toMatchObject({ applied: true, effect: 'eaten' });
    const puts = v1.calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts[1]?.headers.get('Idempotency-Key')).toBe(puts[0]?.headers.get('Idempotency-Key'));
    expect(puts[1]?.body).toEqual(puts[0]?.body);
    expect(v1.rows[0]?.care.fullness).toBeCloseTo(0.55);
    expect((resent.structuredContent.care as { fullness: number }).fullness).toBeCloseTo(0.55);
  });

  it('separate care intents never collide when JSON-RPC ids are reused', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { fullness: 0.2 })] });
    running = await start({ v1 });
    await call('feed_mon', {}, 7);
    await call('feed_mon', {}, 7);
    const puts = v1.calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts[0]?.headers.get('Idempotency-Key')).not.toBe(puts[1]?.headers.get('Idempotency-Key'));
  });

  it('a timed-out PUT that landed is confirmed by a re-read and reported once', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { fullness: 0.2 })], timeoutAfterApplyOnce: true });
    running = await start({ v1 });
    const result = await call('feed_mon', {}, 8);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ applied: true, effect: 'eaten' });
    expect(v1.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /v1/me/mons',
      'PUT /v1/mons/mon_ratti/care',
      'GET /v1/me/mons',
    ]);
    expect(v1.rows[0]?.care.fullness).toBeCloseTo(0.55);
  });

  it('a PUT dropped before it applied says it could not confirm, and the resend applies exactly once', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { fullness: 0.2 })], dropBeforeApplyOnce: true });
    running = await start({ v1 });
    const dropped = await call('feed_mon', {}, 9);
    expect(dropped.isError).toBe(true);
    expect(dropped.structuredContent.error?.reason).toBe('not-confirmed');
    expect(dropped.content[0]?.text).toBe("I couldn't confirm that went through. Ask how your Mon is doing to check before trying again.");
    expect(v1.rows[0]?.care.fullness).toBe(0.2);
    expect((await call('feed_mon', {}, 9)).structuredContent).toMatchObject({ applied: true });
    expect(v1.rows[0]?.care.fullness).toBeCloseTo(0.55);
  });

  it('sends a stable device id, a monotonic seq, and an Idempotency-Key per write', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { energy: 1, social: 0.1 })] });
    running = await start({ v1 });
    await call('play_with_mon', { quality: 0.5 });
    await call('play_with_mon', { quality: 0.5 });
    const puts = v1.calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(2);
    const writes = puts.map((p) => (p.body as { writes: { deviceId: string; seq: number }[] }).writes[0]);
    expect(writes[0]?.deviceId).toBe(writes[1]?.deviceId);
    expect(writes[1]?.seq).toBeGreaterThan(writes[0]?.seq ?? Infinity);
    const keys = puts.map((p) => p.headers.get('Idempotency-Key'));
    expect(keys[0]).toMatch(/^mcp-care-[0-9a-f]{40}$/);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('returns no-mon when the Caller has not hatched a Mon', async () => {
    running = await start();
    const result = await call('feed_mon');
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error?.reason).toBe('no-mon');
  });

  it('returns mon-not-found for an unknown monId', async () => {
    running = await start({ v1: fakeV1({ rows: [row(ADULT)] }) });
    expect((await call('rest_mon', { monId: 'mon_nope' })).structuredContent.error?.reason).toBe('mon-not-found');
  });

  it('rejects a quality outside 0..1 as invalid input', async () => {
    running = await start({ v1: fakeV1({ rows: [row(ADULT)] }) });
    const result = await call('play_with_mon', { quality: 3 });
    expect(result.isError).toBe(true);
  });
});

describe('errors stay human', () => {
  it('turns a /v1 outage into plain text with a next step and no codes', async () => {
    const broken = { fetch: (async () => new Response('nope', { status: 502 })) as typeof fetch, calls: [], rows: [] };
    running = await start({ v1: broken });
    const result = await call('get_mon_status');
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe("NYC-MON can't reach your Mon right now. Try again in a minute.");
    expect(result.content[0]?.text).not.toMatch(/502|unavailable|_|\{/);
  });
});

describe('familiar people (dev mode, fictional fixtures)', () => {
  async function injectJames(confidence = 0.95) {
    return call('inject_presence_event', { personId: 'person-james', confidence });
  }

  it('lists the seeded fictional people', async () => {
    running = await start({ devMode: true });
    const people = (await call('get_familiar_people')).structuredContent.people as { displayName: string; fictional: boolean }[];
    expect(people.map((p) => p.displayName)).toEqual(['James', 'Dana']);
    expect(people.every((p) => p.fictional)).toBe(true);
  });

  it('shows James present after a presence event, and in check_on_mon', async () => {
    running = await start({ devMode: true, v1: fakeV1({ rows: [row(ADULT)] }) });
    expect((await injectJames()).isError).toBeFalsy();
    expect((await call('get_present_people')).structuredContent.people).toEqual([
      { personId: 'person-james', displayName: 'James', tier: 'present', confidence: 0.95 },
    ]);
    expect((await call('check_on_mon')).structuredContent.presentPeople).toHaveLength(1);
  });

  it('refuses a meal from James but lets him play (the demo beat)', async () => {
    const v1 = fakeV1({ rows: [row(ADULT, { energy: 1, fullness: 0.2 })] });
    running = await start({ devMode: true, v1 });
    await injectJames();
    const feed = await call('feed_mon', { speakerHint: { personId: 'person-james' } });
    expect(feed.isError).toBe(true);
    expect(feed.structuredContent.error).toMatchObject({ reason: 'not-permitted', speaker: { kind: 'familiar', displayName: 'James' } });
    expect(v1.calls.some((c) => c.method === 'PUT')).toBe(false);
    const play = await call('play_with_mon', { speakerHint: { personId: 'person-james' } });
    expect(play.structuredContent).toMatchObject({ applied: true });
  });

  it('talk_to_mon reads speakerHint and names the speaker', async () => {
    running = await start({ devMode: true, v1: fakeV1({ rows: [row(ADULT)] }) });
    await injectJames();
    const result = await call('talk_to_mon', { speakerHint: { personId: 'person-james' } });
    expect(result.structuredContent.speaker).toEqual({ kind: 'familiar', personId: 'person-james', displayName: 'James' });
  });

  it('a speaker hint with no presence event narrows to talking only', async () => {
    running = await start({ devMode: true, v1: fakeV1({ rows: [row(ADULT)] }) });
    const talk = await call('talk_to_mon', { speakerHint: { personId: 'person-dana' } });
    expect(talk.structuredContent.speaker).toEqual({ kind: 'unverified', personId: 'person-dana' });
    expect((await call('rest_mon', { speakerHint: { personId: 'person-dana' } })).structuredContent.error?.reason).toBe('not-permitted');
  });

  it('acknowledge_person records a memory only for someone present', async () => {
    running = await start({ devMode: true });
    expect((await call('acknowledge_person', { personId: 'person-james', acknowledgedAs: 'greeted' })).structuredContent.error?.reason).toBe(
      'not-detected',
    );
    await injectJames();
    expect((await call('acknowledge_person', { personId: 'person-james', acknowledgedAs: 'greeted' })).isError).toBeFalsy();
    const memories = (await call('get_shared_memories', { personId: 'person-james' })).structuredContent.memories as { summary: string }[];
    expect(memories.map((m) => m.summary)).toEqual(['Greeted James.', 'Played Peek on the stoop after school.']);
  });

  it('answers person-not-found for an unknown person on every person tool', async () => {
    running = await start({ devMode: true });
    for (const name of ['get_person_relationship', 'get_shared_memories', 'inject_presence_event']) {
      const args = name === 'inject_presence_event' ? { personId: 'person-x', confidence: 0.9 } : { personId: 'person-x' };
      expect((await call(name, args)).structuredContent.error?.reason).toBe('person-not-found');
    }
    const relationship = await call('get_person_relationship', { personId: 'person-james' });
    expect(relationship.structuredContent).toMatchObject({ person: { relationship: 'friend', permissions: { feed: false } } });
  });
});
