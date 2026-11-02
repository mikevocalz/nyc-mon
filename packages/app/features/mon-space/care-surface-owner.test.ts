import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmptySave } from '@acme/core/save';
import { createInitialCareState } from '@acme/core/sim';
import type { CallerProfile, MonInstance, SaveCurrent } from '@acme/core/types';
import {
  bindFreshCareCaller, careLinkTarget, careOwnershipChanges, careSaveOwnedBy, clearCareSaveOwner,
  recordFreshCareSave, rememberVerifiedCareOwner, verifyCareSaveRoster,
  verifyCurrentCareOwner,
} from './care-surface-owner.ts';

const now = Date.UTC(2026, 10, 1);
const caller: CallerProfile = { callerId: 'caller-local-a', callerName: 'A', birthYear: 1990, consentStatus: 'not-required', createdAt: now };
const mon: MonInstance = { monInstanceId: 'mon-a', callerId: caller.callerId, speciesId: 'species-a', nickname: 'A',
  stage: 'Baby', hatchedAt: now, bond: 0, gender: null, voiceLineageId: null, originBlock: null, habitatTags: [], activeHours: null };
const fresh = () => createEmptySave('device-a', now);
const owned = (): SaveCurrent => ({ ...fresh(), caller, mons: [mon], care: [createInitialCareState(mon.monInstanceId, now)] });
function memory() {
  const values = new Map<string, string>();
  return { getString: (key: string) => values.get(key), set: (key: string, value: string) => { values.set(key, value); }, remove: (key: string) => { values.delete(key); } };
}

test('new-save Caller binding survives A sign-out and same-account resume but never grants B retained A data', () => {
  const storage = memory();
  recordFreshCareSave(storage, fresh());
  bindFreshCareCaller(storage, fresh(), caller, 'auth-a');
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-a'), true);
  assert.equal(careSaveOwnedBy(storage, { ...owned(), caller: { ...caller, consentStatus: 'approved' } }, 'auth-a'), true);
  assert.equal(careSaveOwnedBy(storage, owned(), null), false);
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-b'), false);
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-a'), true);
  const otherCaller = { ...owned(), caller: { ...caller, callerId: 'caller-local-b' } };
  assert.equal(careSaveOwnedBy(storage, otherCaller, 'auth-a'), false);
});

test('sign-in cannot claim an old populated save or an empty save lacking its creation receipt', () => {
  const storage = memory();
  bindFreshCareCaller(storage, fresh(), caller, 'auth-b');
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-b'), false);
  recordFreshCareSave(storage, owned());
  bindFreshCareCaller(storage, owned(), caller, 'auth-b');
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-b'), false);
  recordFreshCareSave(storage, fresh());
  bindFreshCareCaller(storage, { ...fresh(), savedAt: now + 1 }, caller, 'auth-b');
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-b'), false);
});

test('verified server membership is pinned to the account, Caller, device and exact Mon set', () => {
  const storage = memory();
  rememberVerifiedCareOwner(storage, owned(), 'auth-a');
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-a'), true);
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-b'), false);
  assert.equal(careSaveOwnedBy(storage, { ...owned(), mons: [] }, 'auth-a'), false);
  assert.equal(careSaveOwnedBy(storage, { ...owned(), mons: [mon, { ...mon, monInstanceId: 'new-local' }] }, 'auth-a'), false);
  for (const consentStatus of ['denied', 'pending'] as const) {
    assert.equal(careSaveOwnedBy(storage, { ...owned(), caller: { ...caller, consentStatus } }, 'auth-a'), false);
  }
  const revision = careOwnershipChanges.getState().revision;
  clearCareSaveOwner(storage);
  assert.ok(careOwnershipChanges.getState().revision > revision);
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-a'), false);
});

test('direct widget links cannot enter a retained save while signed out, switched to B or awaiting consent', () => {
  const storage = memory();
  rememberVerifiedCareOwner(storage, owned(), 'auth-a');
  assert.equal(careLinkTarget(storage, owned(), null), '/(auth)/sign-in?intent=sign-in');
  assert.equal(careLinkTarget(storage, owned(), 'auth-b'), '/(auth)/sign-in?intent=sign-in');
  assert.equal(careLinkTarget(storage, owned(), 'auth-a'), '/(home)');
  assert.equal(careLinkTarget(storage, { ...owned(), caller: { ...caller, consentStatus: 'denied' } }, 'auth-a'), '/(auth)/consent?state=denied');
  assert.equal(careLinkTarget(storage, { ...owned(), caller: { ...caller, consentStatus: 'pending' } }, 'auth-a'), '/(auth)/consent');
});

test('legacy ownership proof requires the authenticated roster, not a local Caller-to-auth ID guess', async () => {
  const response = (authCallerId: string, id = mon.monInstanceId) => new Response(JSON.stringify({ ok: true, data: {
    mons: [{ mon: { ...mon, callerId: authCallerId, monInstanceId: id }, care: createInitialCareState(id, now) }],
  } }), { status: 200, headers: { 'content-type': 'application/json' } });
  const proof = (user: string, owner: string, id?: string) => verifyCareSaveRoster(owned(), user, {
    baseUrl: 'https://admin.example', headers: { origin: 'nycmon://' },
    fetch: (async (url, init) => {
      assert.equal(url, 'https://admin.example/v1/me/mons');
      assert.equal(init?.credentials, 'include');
      assert.equal(init?.method, 'GET');
      return response(owner, id);
    }) as typeof fetch,
  });
  assert.equal(await proof('auth-a', 'auth-a'), true);
  assert.equal(await proof('auth-b', 'auth-b', 'mon-b'), false, 'B roster must not adopt retained A data');
  assert.equal(await proof('auth-a', 'auth-b'), false, 'changed cookie account cannot bind to earlier hook identity');
  assert.equal(await proof('auth-a', caller.callerId), false, 'server Caller uses authenticated user ID, not local caller-*');
  assert.equal(await verifyCareSaveRoster(owned(), 'auth-a', { baseUrl: '', fetch: (async () => new Response('{}', { status: 401 })) as typeof fetch }), false);
});

test('a legacy widget link waits for verified ownership before resuming its saved intent', async () => {
  const storage = memory();
  let resolve!: (response: Response) => void;
  let settled = false;
  const pending = verifyCurrentCareOwner(storage, owned, 'auth-a', {
    baseUrl: 'https://admin.example', isCurrent: () => true,
    fetch: (() => new Promise<Response>((done) => { resolve = done; })) as typeof fetch,
  }).then((verified) => { settled = true; return verified; });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(careLinkTarget(storage, owned(), 'auth-a'), '/(auth)/sign-in?intent=sign-in');
  resolve(new Response(JSON.stringify({ ok: true, data: { mons: [{ mon: { ...mon, callerId: 'auth-a' }, care: createInitialCareState(mon.monInstanceId, now) }] } })));
  assert.equal(await pending, true);
  assert.equal(careLinkTarget(storage, owned(), 'auth-a'), '/(home)');
});

test('late proof after sign-out/account switch, save deletion or roster replacement never binds', async () => {
  for (const change of ['session', 'delete', 'replace'] as const) {
    const storage = memory();
    let save: SaveCurrent | undefined = owned();
    let current = true;
    let resolve!: (response: Response) => void;
    const pending = verifyCurrentCareOwner(storage, () => save, 'auth-a', {
      baseUrl: 'https://admin.example', isCurrent: () => current,
      fetch: (() => new Promise<Response>((done) => { resolve = done; })) as typeof fetch,
    });
    if (change === 'session') current = false;
    else if (change === 'delete') save = undefined;
    else save = { ...owned(), mons: [{ ...mon, monInstanceId: 'replacement' }] };
    resolve(new Response(JSON.stringify({ ok: true, data: { mons: [{ mon: { ...mon, callerId: 'auth-a' }, care: createInitialCareState(mon.monInstanceId, now) }] } })));
    assert.equal(await pending, false, change);
    assert.equal(careSaveOwnedBy(storage, owned(), 'auth-a'), false, change);
    assert.equal(careSaveOwnedBy(storage, owned(), 'auth-b'), false, change);
  }
});

test('an unresponsive roster proof has a bounded failure and cannot bind later', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memory();
  const pending = verifyCurrentCareOwner(storage, owned, 'auth-a', {
    baseUrl: 'https://admin.example', isCurrent: () => true,
    fetch: (() => new Promise<Response>(() => {})) as typeof fetch,
  });
  context.mock.timers.tick(10_000);
  assert.equal(await pending, false);
  assert.equal(careSaveOwnedBy(storage, owned(), 'auth-a'), false);
});
