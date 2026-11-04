import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNearCohortMask } from './cohort-mask.ts';

const mesh = (name: string, cell: number, cellFade = 1) => ({ name, visible: true, userData: { cell, cellFade } });

test('all required families attach before drawing and finish fading before hiding the shell', () => {
  const mask = createNearCohortMask();
  mask.register('walls', [{ num: 7 }]);
  mask.register('signs', [{ num: 7 }]);
  const wall = mesh('walls', 7), sign = mesh('signs', 7, 0.2);
  assert.equal(mask.update([wall]).has(7), false);
  assert.equal(wall.visible, false);
  assert.equal(mask.update([wall, sign]).has(7), false);
  assert.equal(wall.visible, true);
  assert.equal(sign.visible, true);
  sign.userData.cellFade = 1;
  assert.equal(mask.update([wall, sign]).has(7), true);
  assert.equal(mask.update([wall]).has(7), false, 'eviction restores the shell');
  assert.equal(wall.visible, false);
});

test('overlapping packs, unrelated cells and templates cannot falsely complete a cohort', () => {
  const mask = createNearCohortMask();
  mask.register('walls', [{ num: 7 }, { num: 7 }, { num: 8 }]);
  const first = mesh('walls', 7), second = mesh('walls', 7), other = mesh('walls', 8);
  const template = { name: 'walls', visible: true, userData: {} };
  let complete = mask.update([first, other, template, mesh('unrelated', 7)]);
  assert.equal(complete.has(7), false);
  assert.equal(complete.has(8), true);
  complete = mask.update([first, second, other, template]);
  assert.equal(complete.has(7), true);
  assert.equal(template.visible, true);
  assert.equal(mask.update([first, second, mesh('walls', 7)]).has(7), false, 'duplicate attachment fails closed');
});
