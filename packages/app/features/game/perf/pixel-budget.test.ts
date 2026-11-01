import assert from 'node:assert/strict';
import { it } from 'node:test';
import { PHYSICAL_PIXEL_BUDGET, budgetedPixelRatio } from './pixel-budget.ts';

it('keeps 2x on a phone-sized window and caps a 12.9" iPad to the phone budget', () => {
  assert.equal(budgetedPixelRatio(402, 874, 2), 2);
  const r = budgetedPixelRatio(1366, 1024, 2);
  assert.ok(r < 2 && r > 1.4, String(r));
  assert.ok(1366 * r * 1024 * r <= PHYSICAL_PIXEL_BUDGET + 1);
  assert.equal(budgetedPixelRatio(0, 0, 2), 2);
});
