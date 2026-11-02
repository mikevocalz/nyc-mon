import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceCare, applyCareAction, createInitialCareState } from '@acme/core/sim';
import { createEmptySave } from '@acme/core/save';
import type { MonInstance } from '@acme/core/types';
import { careSurfacesFromSave, phase1CareSurfaces } from './phase1-care-surfaces.ts';
import { CARE_HORIZON_MS } from './care-notification-plan.ts';

const NOW = Date.UTC(2026, 10, 1, 12);
const mon: MonInstance = {
  monInstanceId: 'mon-1', callerId: 'caller-1', speciesId: 'species-1', nickname: 'Pip',
  stage: 'Baby', hatchedAt: NOW, bond: 0, gender: null, voiceLineageId: null,
  originBlock: null, habitatTags: [], activeHours: null,
};
const care = createInitialCareState(mon.monInstanceId, NOW);

test('save selection uses local Caller identity, and clears when the Mon or care is absent', () => {
  const save = { ...createEmptySave('device-1', NOW),
    caller: { callerId: 'caller-1', callerName: 'Test', birthYear: 1990, consentStatus: 'not-required' as const, createdAt: NOW },
    mons: [mon], care: [care],
  };
  assert.equal(careSurfacesFromSave(save, mon.monInstanceId, NOW, () => 'Pip')?.monName, 'Pip');
  assert.equal(careSurfacesFromSave(save, 'removed-mon', NOW, () => 'Pip'), null);
  assert.equal(careSurfacesFromSave({ ...save, care: [] }, mon.monInstanceId, NOW, () => 'Pip'), null);
  assert.equal(careSurfacesFromSave({ ...save, mons: [{ ...mon, callerId: 'other-caller' }] }, mon.monInstanceId, NOW, () => 'Pip'), null);
  assert.equal(careSurfacesFromSave(undefined, undefined, NOW, () => 'Pip'), null);
  for (const consentStatus of ['denied', 'pending'] as const) {
    assert.equal(careSurfacesFromSave({ ...save, caller: { ...save.caller, consentStatus } }, mon.monInstanceId, NOW, () => 'Pip'), null);
  }
});

test('predictions come from the real sim and do not repeat the hunger request at the lower meter threshold', () => {
  const input = phase1CareSurfaces(mon, care, 'Pip', NOW);
  const events = advanceCare({ mon, care }, NOW + CARE_HORIZON_MS).events;
  const food = events.find((event) => event.type === 'food-requested');
  assert.ok(food);
  assert.deepEqual(input.predictions.filter((p) => p.kind === 'hunger'), [{ kind: 'hunger', at: food.at }]);
  assert.ok(input.predictions.some((p) => p.kind === 'energy'));
  assert.ok(input.predictions.some((p) => p.kind === 'social'));
  assert.ok(input.predictions.every((p) => ['hunger', 'energy', 'social'].includes(p.kind)));
  assert.equal(input.view.attention, 'none');
});

test('elapsed care changes the widget attention, and feeding updates hearts and reschedules the next food request', () => {
  const at = NOW + 3 * 60 * 60 * 1000;
  const before = phase1CareSurfaces(mon, care, 'Pip', at);
  assert.equal(before.view.attention, 'call');
  assert.equal(before.predictions.some((p) => p.kind === 'hunger'), false);
  const fed = applyCareAction({ mon, care }, { kind: 'feed' }, at).state;
  const after = phase1CareSurfaces(fed.mon, fed.care, 'Pip', at);
  assert.equal(after.view.attention, 'none');
  assert.ok(after.view.hearts.fullness > before.view.hearts.fullness);
  assert.ok(after.predictions.some((p) => p.kind === 'hunger' && p.at > at));
});

test('sleeping uses the sim recovery path and never fabricates bedtime, illness or false calls', () => {
  const asleep = applyCareAction({ mon, care: { ...care, energy: 0.3 } }, { kind: 'rest' }, NOW).state;
  const input = phase1CareSurfaces(asleep.mon, asleep.care, 'Pip', NOW);
  assert.equal(input.view.asleep, true);
  assert.equal(input.view.cold, null);
  assert.equal(input.view.poop, 0);
  assert.equal(input.view.paused, false);
  assert.ok(input.predictions.every((p) => !['bedtime', 'cold', 'false-call'].includes(p.kind)));
});
