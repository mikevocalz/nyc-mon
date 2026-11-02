import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SYSTEM_COPY } from './copy.ts';
import {
  ACTION_COPY, parseRecoveryState, RECOVERY_STATES, recoveryHref, recoveryPlan, stageFailureState, type RecoveryContext,
} from './recovery-model.ts';

const ctx = (over: Partial<RecoveryContext> = {}): RecoveryContext => ({ lastGood: 'none', canGoBack: false, ...over });

describe('M22 recovery model', () => {
  it('round-trips every state through its href param', () => {
    for (const state of RECOVERY_STATES) {
      const href = recoveryHref(state);
      assert.equal(href, `/(system)/error?state=${state}`);
      assert.equal(parseRecoveryState(new URLSearchParams(href.split('?')[1]).get('state')), state);
    }
  });

  it('rejects unknown params instead of guessing a state', () => {
    assert.equal(parseRecoveryState('nope'), undefined);
    assert.equal(parseRecoveryState(undefined), undefined);
    assert.equal(parseRecoveryState(['context-lost']), 'context-lost');
  });

  it('offers the last good save first when one reads cleanly', () => {
    const plan = recoveryPlan('save-recovered', ctx({ lastGood: 'available', reason: 'corrupt' }));
    assert.equal(plan.primary, 'restore');
    assert.deepEqual(plan.secondary, ['start-over']);
    assert.equal(plan.bodyId, 'm22.save.body.restore');
    assert.equal(plan.noteId, 'm22.save.kept');
  });

  it('falls back to a new save when no clean copy exists', () => {
    for (const lastGood of ['none', 'unreadable'] as const) {
      const plan = recoveryPlan('save-recovered', ctx({ lastGood, reason: 'invalid' }));
      assert.equal(plan.primary, 'start-over');
      assert.deepEqual(plan.secondary, []);
      assert.equal(plan.bodyId, 'm22.save.body.none');
    }
  });

  it('tells a newer-version save to update the app', () => {
    assert.equal(recoveryPlan('save-recovered', ctx({ reason: 'future-version' })).bodyId, 'm22.save.body.newer');
  });

  it('keeps 2D first when 3D cannot run, and retry first when it was lost', () => {
    assert.equal(recoveryPlan('webgpu-unavailable', ctx()).primary, 'use-2d');
    assert.deepEqual(recoveryPlan('webgpu-unavailable', ctx()).secondary, ['retry-3d']);
    assert.equal(recoveryPlan('context-lost', ctx()).primary, 'retry-3d');
    assert.deepEqual(recoveryPlan('context-lost', ctx()).secondary, ['use-2d']);
  });

  it('reloads a missing Mon and offers restore only when a copy exists', () => {
    assert.equal(recoveryPlan('mon-missing', ctx()).primary, 'reload');
    assert.deepEqual(recoveryPlan('mon-missing', ctx()).secondary, []);
    assert.deepEqual(recoveryPlan('mon-missing', ctx({ lastGood: 'available' })).secondary, ['restore']);
  });

  it('sends an unknown Dex id home, with Back only when there is somewhere to go', () => {
    assert.equal(recoveryPlan('dex-not-found', ctx()).primary, 'home');
    assert.deepEqual(recoveryPlan('dex-not-found', ctx()).secondary, []);
    assert.deepEqual(recoveryPlan('dex-not-found', ctx({ canGoBack: true })).secondary, ['back']);
  });

  it('never leaves a state without an action, and every id has copy', () => {
    for (const state of RECOVERY_STATES) {
      for (const lastGood of ['available', 'none', 'unreadable'] as const) {
        const plan = recoveryPlan(state, ctx({ lastGood }));
        assert.ok(plan.primary);
        for (const id of [plan.titleId, plan.bodyId, ...(plan.noteId ? [plan.noteId] : [])]) assert.ok(SYSTEM_COPY[id]);
        for (const action of [plan.primary, ...plan.secondary]) assert.ok(SYSTEM_COPY[ACTION_COPY[action]]);
      }
    }
  });

  it('names a stage failure by whether the stage ever ran', () => {
    assert.equal(stageFailureState(false), 'webgpu-unavailable');
    assert.equal(stageFailureState(true), 'context-lost');
  });
});
