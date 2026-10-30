import assert from 'node:assert/strict';
import test from 'node:test';
import { cellText, filterRows, pageWindow, rowMatches, toggleId, toggleVisible, visibleSelection } from './data-table-model.ts';

const rows = [
  { id: 'a', name: 'Lil’ Ratti', stage: 'Baby', dex: 2 },
  { id: 'b', name: 'Squeaklet', stage: 'Baby', dex: 1 },
  { id: 'c', name: 'Café Pigeon', stage: 'Adult', dex: 14 },
];
const pick = (row: (typeof rows)[number]) => [row.name, row.stage, row.dex];

test('an empty or blank query keeps every row in order', () => {
  assert.deepEqual(filterRows(rows, '', pick).map((r) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(filterRows(rows, '   ', pick).map((r) => r.id), ['a', 'b', 'c']);
});

test('matching ignores case and accents', () => {
  assert.deepEqual(filterRows(rows, 'SQUEAK', pick).map((r) => r.id), ['b']);
  assert.deepEqual(filterRows(rows, 'cafe', pick).map((r) => r.id), ['c']);
});

test('every term must match some column', () => {
  assert.deepEqual(filterRows(rows, 'baby ratti', pick).map((r) => r.id), ['a']);
  assert.deepEqual(filterRows(rows, 'baby pigeon', pick), []);
});

test('numbers and arrays are searchable, objects are not', () => {
  assert.equal(rowMatches([14], '14'), true);
  assert.equal(rowMatches([['seeds', 'crumbs']], 'crumb'), true);
  assert.equal(rowMatches([{ secret: 'x' }], 'secret'), false);
  assert.equal(cellText(null), '');
  assert.equal(cellText(new Date('invalid')), '');
});

test('pageWindow clamps the page and slices the rows', () => {
  assert.deepEqual(pageWindow(45, 0, 20), { page: 0, pageCount: 3, start: 0, end: 20 });
  assert.deepEqual(pageWindow(45, 2, 20), { page: 2, pageCount: 3, start: 40, end: 45 });
  // A filter that shrinks the rows pulls an out-of-range page back.
  assert.deepEqual(pageWindow(5, 4, 20), { page: 0, pageCount: 1, start: 0, end: 5 });
  assert.deepEqual(pageWindow(0, 0, 20), { page: 0, pageCount: 1, start: 0, end: 0 });
  assert.deepEqual(pageWindow(7, 3, 0), { page: 0, pageCount: 1, start: 0, end: 7 });
});

test('row selection toggles one id', () => {
  assert.deepEqual(toggleId([], 'a'), ['a']);
  assert.deepEqual(toggleId(['a', 'b'], 'a'), ['b']);
});

test('the header checkbox selects or clears only the visible page', () => {
  assert.deepEqual(toggleVisible(['z'], ['a', 'b']), ['z', 'a', 'b']);
  assert.deepEqual(toggleVisible(['z', 'a', 'b'], ['a', 'b']), ['z']);
  assert.deepEqual(toggleVisible(['a'], ['a', 'b']), ['a', 'b']);
  assert.deepEqual(toggleVisible(['a'], []), ['a']);
});

test('visibleSelection reports all, some or none', () => {
  assert.equal(visibleSelection(['a', 'b'], ['a', 'b']), 'all');
  assert.equal(visibleSelection(['a'], ['a', 'b']), 'some');
  assert.equal(visibleSelection(['z'], ['a', 'b']), 'none');
  assert.equal(visibleSelection([], []), 'none');
});
