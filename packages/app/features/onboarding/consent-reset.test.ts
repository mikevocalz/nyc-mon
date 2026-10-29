import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptySave, readBootSave } from '@acme/core/save';
import { resolveBootRoute } from '@acme/core/sim';
import type { ConsentStatus, SaveCurrent } from '@acme/core/types';
import { CONSENT_RESET_KEYS, resetAfterConsentDenied } from './consent-reset.ts';
import type { KeyValueStorage } from './storage.types';

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0);

function memoryStorage(seed: Record<string, string> = {}): KeyValueStorage & { readonly values: Map<string, string> } {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  };
}

function saveWith(consentStatus: ConsentStatus): SaveCurrent {
  return {
    ...createEmptySave('device-a', T0),
    caller: { callerId: 'caller-1', callerName: 'Dee', birthYear: 2016, consentStatus, createdAt: T0 },
  };
}

const AGE = JSON.stringify({ birthYear: 2016, answeredAtMs: T0 });

/** What boot reads after the reset, built the way the app's `buildBootSnapshot` does. */
function bootAfter(onboarding: KeyValueStorage, save: KeyValueStorage) {
  return resolveBootRoute({
    save: readBootSave(save.getString(CONSENT_RESET_KEYS.save)),
    hasSession: onboarding.getString(CONSENT_RESET_KEYS.hasSession) === '1',
    ageAnswer: onboarding.getString(CONSENT_RESET_KEYS.ageAnswer) === undefined ? undefined : JSON.parse(AGE),
    nowMs: T0,
  });
}

describe('resetAfterConsentDenied (M05 denied → Close)', () => {
  it('clears the age answer, the consent marker, a denied save and its session flag; boot then goes to first-run', () => {
    const onboarding = memoryStorage({ 'age-answer': AGE, 'consent-requested': '1', 'has-session': '1' });
    const save = memoryStorage({ save: JSON.stringify(saveWith('denied')) });
    assert.deepEqual(bootAfter(onboarding, save), { kind: 'consent-denied' });

    const result = resetAfterConsentDenied(onboarding, save);

    assert.equal(result.removedDeniedSave, true);
    assert.equal(onboarding.values.size, 0);
    assert.equal(save.values.size, 0);
    assert.deepEqual(bootAfter(onboarding, save), { kind: 'first-run' });
  });

  it('with no save (the ?state=denied link) clears the age answer and boots to first-run', () => {
    const onboarding = memoryStorage({ 'age-answer': AGE, 'consent-requested': '1' });
    const save = memoryStorage();
    assert.deepEqual(bootAfter(onboarding, save), { kind: 'resume-onboarding', step: 'guardian-consent' });

    assert.equal(resetAfterConsentDenied(onboarding, save).removedDeniedSave, false);
    assert.deepEqual(bootAfter(onboarding, save), { kind: 'first-run' });
  });

  it('never deletes a save whose Caller was not denied', () => {
    const onboarding = memoryStorage({ 'age-answer': AGE, 'has-session': '1' });
    const raw = JSON.stringify(saveWith('pending'));
    const save = memoryStorage({ save: raw });

    assert.equal(resetAfterConsentDenied(onboarding, save).removedDeniedSave, false);
    assert.equal(save.getString('save'), raw);
    assert.equal(onboarding.getString('has-session'), '1');
  });

  it('leaves an unreadable save for M22', () => {
    const save = memoryStorage({ save: '{not json' });
    assert.equal(resetAfterConsentDenied(memoryStorage(), save).removedDeniedSave, false);
    assert.equal(save.getString('save'), '{not json');
  });
});
