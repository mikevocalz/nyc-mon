// The pure half of Delete account (M20): the error line each failure shows,
// and what leaves the device once the server has deleted the account.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthError } from '@acme/auth';
import { readFileSync } from 'node:fs';
import type { KeyValueStorage } from '../onboarding/storage.types.ts';
import { copy } from '../onboarding/copy.ts';
import { clearLocalAccount, DELETED_PATH, deleteAccountErrorId } from './delete-account-model.ts';

const failure = (code: string, status: number) => ({ ok: false as const, error: new AuthError(code, code, status) });

function memory(entries: Record<string, string>): KeyValueStorage & { keys: () => string[] } {
  const map = new Map(Object.entries(entries));
  return {
    getString: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
    keys: () => [...map.keys()].sort(),
  };
}

test('no response reads as offline', () => {
  assert.equal(deleteAccountErrorId(failure('NETWORK', 0)), 'settings.delete.error.offline');
});

test('a stale or missing session asks the Caller to sign in again', () => {
  assert.equal(deleteAccountErrorId(failure('SESSION_EXPIRED', 400)), 'settings.delete.error.reauth');
  assert.equal(deleteAccountErrorId(failure('UNAUTHORIZED', 401)), 'settings.delete.error.reauth');
});

test('anything else is the generic retry line', () => {
  assert.equal(deleteAccountErrorId(failure('UNKNOWN', 500)), 'settings.delete.error.generic');
  assert.equal(deleteAccountErrorId(failure('UNKNOWN', 404)), 'settings.delete.error.generic');
});

test('every error id has copy', () => {
  for (const id of ['settings.delete.error.offline', 'settings.delete.error.reauth', 'settings.delete.error.generic'] as const) {
    assert.ok(copy(id).length > 0);
  }
});

test('clearLocalAccount removes the save, its device id and the given onboarding flags, and nothing else', () => {
  const keys = { onboarding: ['age-answer', 'has-session', 'consent-requested'], save: 'save' };
  const onboarding = memory({ 'age-answer': '{}', 'has-session': '1', 'consent-requested': '1', 'unrelated-key': 'kept' });
  const save = memory({ save: '{}', 'device-id': 'device-1', other: 'kept' });
  clearLocalAccount(onboarding, save, keys);
  assert.deepEqual(onboarding.keys(), ['unrelated-key']);
  assert.deepEqual(save.keys(), ['other']);
});

test('the binding clears every onboarding key and the save key, and only after the server says ok', () => {
  const binding = readFileSync(new URL('./delete-account.ts', import.meta.url), 'utf8');
  assert.match(binding, /clearLocalAccount\(onboardingStorage, saveStorage, \{ onboarding: Object\.values\(ONBOARDING_KEYS\), save: SAVE_KEY \}\)/);
  assert.ok(binding.indexOf('if (!result.ok) return result;') < binding.indexOf('clearLocalAccount('));
  assert.match(binding, /hydrateOnboarding\(\);\n  useMonStore\.getState\(\)\.hydrate\(\);/);
});

test('after deletion the app goes to the first-run Welcome', () => {
  assert.equal(DELETED_PATH, '/(onboarding)/welcome');
});

test('the confirm copy says what goes, that the Mon is cared for, and that it is final', () => {
  const body = copy('settings.delete.confirm.body');
  for (const word of ['email', 'Caller name', 'birth year', 'sign-in methods', 'Dr. Santoro', 'can\u2019t undo']) {
    assert.ok(body.includes(word), `body names ${word}`);
  }
});
