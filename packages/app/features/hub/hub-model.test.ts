import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEggRecord, createHatchState, createInitialCareState, transitionHatch } from '@acme/core/sim';
import type { CareState } from '@acme/core/types';
import { COMPANION_COPY } from '../companion/copy.ts';
import { HATCH_COPY } from '../hatch/copy.ts';
import { HUB_COPY } from './copy.ts';
import { careNeedNow, gameEntry, hatchReminder } from './hub-model.ts';

const T0 = new Date(2026, 9, 8, 15, 0, 0).getTime();
const care = (patch: Partial<CareState>): CareState => ({ ...createInitialCareState('mon-1', T0), energy: 0.8, fullness: 0.8, social: 0.8, ...patch });
const egg = createEggRecord({
  eggId: 'egg-1', speciesId: 'dex-001', hatchesIntoSpeciesId: 'dex-002', callerId: 'caller-1', nickname: null, incubationMinutes: 15, createdAt: T0,
});
const END = egg.incubationEndsAt;

describe('HOME: the one care need', () => {
  it('says hi when nothing is asked, on the H-Lynk', () => {
    assert.deepEqual(careNeedNow(care({})), { status: COMPANION_COPY['m13.status.content'], action: 'hub.need.hi', href: '/(home)', asking: false });
  });
  it('picks food first, even when everything is low', () => {
    const need = careNeedNow(care({ energy: 0.05, fullness: 0.05, social: 0.05 }));
    assert.equal(need.href, '/(home)/feed');
    assert.equal(need.status, COMPANION_COPY['m13.status.food']);
    assert.equal(need.asking, true);
  });
  it('sends a tired Mon to bed and checks on a sleeping one', () => {
    assert.equal(careNeedNow(care({ energy: 0.05 })).action, 'hub.need.rest');
    const asleep = careNeedNow(care({ activity: { kind: 'asleep', since: T0 } }));
    assert.equal(asleep.action, 'hub.need.asleep');
    assert.equal(asleep.asking, false);
  });
  it('asks to play when social is low', () => {
    assert.equal(careNeedNow(care({ social: 0.05 })).href, '/(home)/social');
  });
});

describe('HOME: the hatch reminder', () => {
  const hatch = createHatchState(egg);
  it('counts down with M11 time words', () => {
    const r = hatchReminder(hatch, egg, END - 5 * 60_000);
    assert.equal(r?.title, 'hub.hatch.counting.title');
    assert.equal(r?.line, '5 min left');
    assert.equal(r?.ready, false);
  });
  it('is ready on the edge and after it, and resumes a hatch in progress', () => {
    assert.equal(hatchReminder(hatch, egg, END)?.title, 'hub.hatch.ready.title');
    assert.equal(hatchReminder(hatch, egg, END + 86_400_000)?.line, HATCH_COPY['m11.time.ready']);
    const presenting = transitionHatch(hatch, { type: 'open', now: END }, egg);
    assert.equal(hatchReminder(presenting, egg, END)?.action, 'hub.hatch.resume.action');
  });
});

describe('HOME: the Game entry', () => {
  it('continues a save, starts without one, opens the game when the save failed', () => {
    assert.deepEqual(gameEntry({ kind: 'eligible', savedAtMs: T0, revision: 3 }), { title: 'hub.game.continue', kind: 'continue', savedAtMs: T0 });
    assert.equal(gameEntry({ kind: 'offline', savedAtMs: T0, revision: 3 }).kind, 'continue');
    assert.equal(gameEntry({ kind: 'none' }).title, 'hub.game.start');
    assert.equal(gameEntry({ kind: 'failed', reason: { kind: 'save-unreadable' }, recovery: 'start-new' } as never).kind, 'failed');
  });
});

describe('HOME copy', () => {
  it('stays in canon words: Caller, Mon, H-Lynk; never pet, player, device or "Get started"', () => {
    for (const text of Object.values(HUB_COPY)) {
      assert.doesNotMatch(text, /\b(pet|pets|player|device|user|owner|trainer)\b/i, text);
      assert.doesNotMatch(text, /get started/i, text);
      assert.doesNotMatch(text, /!/, text);
    }
  });
});
