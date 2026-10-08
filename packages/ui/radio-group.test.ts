import assert from 'node:assert/strict';
import test from 'node:test';
import { nextRadioIndex, rovingTabIndex } from './radio-group.ts';

test('forward arrows step to the next option and wrap at the end', () => {
  assert.equal(nextRadioIndex(0, 'ArrowRight', 4), 1);
  assert.equal(nextRadioIndex(2, 'ArrowDown', 4), 3);
  assert.equal(nextRadioIndex(3, 'ArrowRight', 4), 0);
  assert.equal(nextRadioIndex(3, 'ArrowDown', 4), 0);
});

test('backward arrows step to the previous option and wrap at the start', () => {
  assert.equal(nextRadioIndex(2, 'ArrowLeft', 4), 1);
  assert.equal(nextRadioIndex(1, 'ArrowUp', 4), 0);
  assert.equal(nextRadioIndex(0, 'ArrowLeft', 4), 3);
  assert.equal(nextRadioIndex(0, 'ArrowUp', 4), 3);
});

test('Home and End jump to the first and last option', () => {
  assert.equal(nextRadioIndex(2, 'Home', 4), 0);
  assert.equal(nextRadioIndex(0, 'End', 4), 3);
  assert.equal(nextRadioIndex(-1, 'End', 4), 3);
});

test('with nothing checked, forward lands first and backward lands last', () => {
  assert.equal(nextRadioIndex(-1, 'ArrowRight', 3), 0);
  assert.equal(nextRadioIndex(-1, 'ArrowLeft', 3), 2);
});

test('other keys and empty groups return null', () => {
  assert.equal(nextRadioIndex(1, 'Tab', 4), null);
  assert.equal(nextRadioIndex(1, ' ', 4), null);
  assert.equal(nextRadioIndex(1, 'Enter', 4), null);
  assert.equal(nextRadioIndex(0, 'ArrowRight', 0), null);
});

test('a single option wraps onto itself', () => {
  assert.equal(nextRadioIndex(0, 'ArrowRight', 1), 0);
  assert.equal(nextRadioIndex(0, 'ArrowLeft', 1), 0);
});

test('roving tabindex: only the checked option is a Tab stop', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => rovingTabIndex(i, 2)), [-1, -1, 0, -1]);
});

test('roving tabindex: nothing checked keeps the first option reachable', () => {
  assert.deepEqual([0, 1, 2].map((i) => rovingTabIndex(i, -1)), [0, -1, -1]);
});
