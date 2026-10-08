import assert from 'node:assert/strict';
import test from 'node:test';
import { cycleFocusIndex, shouldReturnFocus, visibleRing } from './focus-cycle.ts';

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

const el = (name: string, rects: number) => ({ name, getClientRects: () => ({ length: rects }) });

test('hidden ring members are dropped; a fully hidden ring is empty and Tab is left alone', () => {
  const ring = [el('toggle', 0), el('home', 0), el('story', 0)];
  const visible = visibleRing(ring);
  assert.equal(visible.length, 0);
  assert.equal(cycleFocusIndex(-1, visible.length, false), null);
});

test('only rendered members stay in the ring, in order', () => {
  const ring = [el('toggle', 1), el('home', 0), el('story', 2)];
  assert.deepEqual(visibleRing(ring).map((e) => e.name), ['toggle', 'story']);
});
