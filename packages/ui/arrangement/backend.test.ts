// Backend matrix for ArrangementPanes (foldable skill §9 steps 3-5). Unit
// fixtures, not device evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseArrangementBackend, primaryEdgeFor, secondaryShown } from './backend.ts';

const base = { os: 'android', osVersion: 34, headset: false, nativeRegistered: true };

test('Android phones and foldables use the native Arrangement View', () => {
  assert.equal(chooseArrangementBackend(base), 'native');
});

test('a binary without the native view falls back, so JS can ship before the rebuild', () => {
  assert.equal(chooseArrangementBackend({ ...base, nativeRegistered: false }), 'fallback');
});

test('Quest and PICO 2D windows keep the XR adapter (fallback)', () => {
  assert.equal(chooseArrangementBackend({ ...base, headset: true }), 'fallback');
});

test('iOS uses the native view from 27.1 only', () => {
  assert.equal(chooseArrangementBackend({ ...base, os: 'ios', osVersion: '27.0' }), 'fallback');
  assert.equal(chooseArrangementBackend({ ...base, os: 'ios', osVersion: '26.4' }), 'fallback');
  assert.equal(chooseArrangementBackend({ ...base, os: 'ios', osVersion: '27.1' }), 'native');
  assert.equal(chooseArrangementBackend({ ...base, os: 'ios', osVersion: '28' }), 'native');
});

test('web and other runtimes always fall back', () => {
  assert.equal(chooseArrangementBackend({ ...base, os: 'web' }), 'fallback');
  assert.equal(chooseArrangementBackend({ ...base, os: 'windows' }), 'fallback');
});

test('the physical right is trailing in LTR and leading in RTL', () => {
  assert.equal(primaryEdgeFor('right', false), 'trailing');
  assert.equal(primaryEdgeFor('right', true), 'leading');
  assert.equal(primaryEdgeFor('left', false), 'leading');
  assert.equal(primaryEdgeFor('left', true), 'trailing');
});

test('an overlapping overlay hides the companion pane', () => {
  assert.equal(secondaryShown(null), false);
  assert.equal(secondaryShown({ secondaryVisible: true, isOverlapping: true }), false);
  assert.equal(secondaryShown({ secondaryVisible: false, isOverlapping: false }), false);
  assert.equal(secondaryShown({ secondaryVisible: true, isOverlapping: false }), true);
});
