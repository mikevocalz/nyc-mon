import { describe, expect, it, vi } from 'vitest';
import { createCompanionMemoryHandler, type MemoryCaller } from '../companion-memory-handler.ts';
import { CompanionPreferencesSchema, MemoryConflict, MemoryWriteSchema, PostgresMemoryStore, type MemorySnapshot, type MemoryStore } from '../companion-memory-store.ts';

const now = Date.UTC(2026, 9, 24);
const adult: MemoryCaller = { callerId: '12', user: { id: 12, birthYear: 1986, consentStatus: 'not-required' } };
const snapshot: MemorySnapshot = { revision: 1, preferences: { interests: ['music'], approvedNote: '' }, consentedAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
const makeStore = (): MemoryStore => ({ read: vi.fn(async () => snapshot), write: vi.fn(async () => snapshot), forget: vi.fn(async () => ({ ...snapshot, revision: 2, preferences: null, consentedAt: null })) });
const request = (method = 'GET', body?: unknown, extra: Record<string, string> = {}) => new Request('https://auth.example/v1/me/companion-memory', {
  method, headers: { origin: 'https://auth.example', 'content-type': 'application/json', ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const valid = { expectedRevision: 0, consent: true as const, preferences: { interests: ['music'], approvedNote: '' } };

describe('Caller-owned companion memory', () => {
  it('exports only the authenticated adult Caller memory and sets no-store', async () => {
    const store = makeStore(); const handler = createCompanionMemoryHandler({ store, authenticate: async () => adult, now: () => now });
    const response = await handler(request());
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(store.read).toHaveBeenCalledWith('12'); expect(JSON.stringify(await response.json())).not.toContain('callerId');
  });
  it('propagates failed auth without reading or writing', async () => {
    const store = makeStore(); const handler = createCompanionMemoryHandler({ store, authenticate: async () => new Response(null, { status: 401 }) });
    expect((await handler(request())).status).toBe(401); expect(store.read).not.toHaveBeenCalled();
  });
  it.each([{}, { birthYear: 2010 }, { birthYear: 2008 }, { birthYear: 1986, consentStatus: 'pending' }, { birthYear: 1986, deletionScheduledFor: '2026-11-01' }])('refuses ineligible accounts %j', async (user) => {
    const store = makeStore(); const handler = createCompanionMemoryHandler({ store, authenticate: async () => ({ callerId: '12', user }), now: () => now });
    expect((await handler(request('PUT', valid))).status).toBe(403); expect(store.write).not.toHaveBeenCalled();
  });
  it.each([{ ...valid, consent: false }, { ...valid, callerId: '13' }, { ...valid, preferences: { password: 'no' } }])('refuses missing consent, forged owner, and arbitrary fields', async (body) => {
    const store = makeStore(); const handler = createCompanionMemoryHandler({ store, authenticate: async () => adult, now: () => now });
    expect((await handler(request('PUT', body))).status).toBe(400); expect(store.write).not.toHaveBeenCalled();
  });
  it('requires same-origin for cookie-authenticated writes', async () => {
    const store = makeStore(); const handler = createCompanionMemoryHandler({ store, authenticate: async () => adult, now: () => now });
    expect((await handler(request('PUT', valid, { origin: 'https://evil.example' }))).status).toBe(403);
  });
  it('permits an explicit consented save and explicit forgetting', async () => {
    const store = makeStore(); const handler = createCompanionMemoryHandler({ store, authenticate: async () => adult, now: () => now });
    expect((await handler(request('PUT', valid))).status).toBe(200); expect(store.write).toHaveBeenCalledWith('12', valid);
    expect((await handler(request('DELETE', { expectedRevision: 1 }))).status).toBe(200); expect(store.forget).toHaveBeenCalledWith('12', 1);
  });
  it('returns conflict instead of silently overwriting another session', async () => {
    const store = makeStore(); store.write = vi.fn(async () => { throw new MemoryConflict(); });
    const handler = createCompanionMemoryHandler({ store, authenticate: async () => adult, now: () => now });
    expect((await handler(request('PUT', valid))).status).toBe(409);
  });
  it('does not expose internal errors', async () => {
    const store = makeStore(); store.read = vi.fn(async () => { throw new Error('SQL secret'); });
    const response = await createCompanionMemoryHandler({ store, authenticate: async () => adult, now: () => now })(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
  });
  it('bounds data and rejects nonconsented writes in the store as well', () => {
    expect(CompanionPreferencesSchema.safeParse({ approvedNote: 'x'.repeat(501) }).success).toBe(false);
    expect(MemoryWriteSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });
  it('binds owners as SQL parameters, never as query text', async () => {
    const query = vi.fn(async (_sql: string, _values: unknown[]) => ({ rows: [snapshot] }));
    const store = new PostgresMemoryStore({ query }); await store.read('12');
    expect(query.mock.calls[0]?.[1]).toEqual([12]); expect(query.mock.calls[0]?.[0]).toContain('caller_id = $1');
    await expect(store.read("12 OR 1=1")).rejects.toThrow(); expect(query).toHaveBeenCalledTimes(1);
  });
  it('uses INSERT-only revision zero and conditional UPDATE for existing rows', async () => {
    const query = vi.fn(async (_sql: string, _values: unknown[]) => ({ rows: [snapshot] }));
    const store = new PostgresMemoryStore({ query }); await store.write('12', valid);
    expect(query.mock.calls[0]?.[0]).toContain('ON CONFLICT (caller_id) DO NOTHING');
    await store.forget('12', 1); expect(query.mock.calls[1]?.[0]).toContain('AND revision = $3');
    expect(query.mock.calls[1]?.[1]).toEqual([12, null, 1]);
  });
  it('treats zero affected rows as a revision conflict', async () => {
    const store = new PostgresMemoryStore({ query: async () => ({ rows: [] }) });
    await expect(store.write('12', valid)).rejects.toThrow(MemoryConflict);
    expect((await store.read('12')).revision).toBe(0);
  });
});
