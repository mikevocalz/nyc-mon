import assert from 'node:assert/strict';
import test from 'node:test';
import { cycleFocusIndex, shouldReturnFocus } from './focus-cycle.ts';

test('Tab moves forward through the ring and wraps from last to first', () => {
  assert.equal(cycleFocusIndex(0, 4, false), 1);
  assert.equal(cycleFocusIndex(2, 4, false), 3);
  assert.equal(cycleFocusIndex(3, 4, false), 0);
});

test('Shift+Tab moves backward and wraps from first to last', () => {
  assert.equal(cycleFocusIndex(3, 4, true), 2);
  assert.equal(cycleFocusIndex(0, 4, true), 3);
});

test('focus outside the ring re-enters at the matching end', () => {
  assert.equal(cycleFocusIndex(-1, 4, false), 0);
  assert.equal(cycleFocusIndex(-1, 4, true), 3);
});

test('an empty ring does nothing; a one-element ring holds focus', () => {
  assert.equal(cycleFocusIndex(0, 0, false), null);
  assert.equal(cycleFocusIndex(-1, 0, true), null);
  assert.equal(cycleFocusIndex(0, 1, false), 0);
  assert.equal(cycleFocusIndex(0, 1, true), 0);
});

test('focus that fell out of the unmounted menu returns to the toggle', () => {
  assert.equal(shouldReturnFocus({ tagName: 'BODY' }), true);
  assert.equal(shouldReturnFocus(null), true);
  assert.equal(shouldReturnFocus(undefined), true);
});

test('focus the user moved to a real control is left alone', () => {
  assert.equal(shouldReturnFocus({ tagName: 'INPUT' }), false);
  assert.equal(shouldReturnFocus({ tagName: 'BUTTON' }), false);
  assert.equal(shouldReturnFocus({ tagName: 'A' }), false);
});
