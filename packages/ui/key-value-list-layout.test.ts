import assert from 'node:assert/strict';
import test from 'node:test';
import { keyValueListColumns, keyValuePairClassName } from './key-value-list-layout.ts';

test('columns follow the actual pane at and around the 600-unit boundary', () => {
  for (const width of [0, 320, 599, 599.99]) assert.equal(keyValueListColumns(width), 1);
  for (const width of [600, 600.01, 640, 768, 1024, 1280]) assert.equal(keyValueListColumns(width), 2);
});

test('one-column callers stay stacked on every pane size', () => {
  for (const width of [0, 320, 599, 600, 768, 1024, 1280]) {
    assert.equal(keyValueListColumns(width, 1), 1);
  }
});

test('unmeasured and invalid sizes cannot opt into two columns', () => {
  for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(keyValueListColumns(width), 1);
  }
});

test('resizing repeatedly across the breakpoint restores the same layout', () => {
  assert.deepEqual([1024, 599, 600, 320, 1280, 600].map((width) => keyValueListColumns(width)), [2, 1, 2, 1, 2, 2]);
});

test('two-column pairs have half widths and complementary logical half-gutters', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((index) => keyValuePairClassName(2, index)), [
    'w-1/2 pe-4', 'w-1/2 ps-4', 'w-1/2 pe-4', 'w-1/2 ps-4', 'w-1/2 pe-4',
  ]);
});

test('stacked pairs use the full pane with no leftover gutter or viewport breakpoint', () => {
  for (const index of [0, 1, 2, 3]) assert.equal(keyValuePairClassName(1, index), 'w-full');
  for (const columns of [1, 2] as const) {
    for (const index of [0, 1]) {
      assert.doesNotMatch(keyValuePairClassName(columns, index), /calc\(|(?:sm|md|lg):/);
    }
  }
});
