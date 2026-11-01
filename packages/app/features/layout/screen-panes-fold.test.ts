import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FoldLayout } from '@acme/ui/adaptive-panes/parts';
import { FOLD_GUTTER, screenPanesFoldSplit } from './screen-panes-fold.ts';

function fold(over: Partial<FoldLayout>): FoldLayout {
  return { orientation: 'vertical', state: 'flat', posture: 'flat', separating: true, x: 600, y: 0, width: 20, height: 800, ...over };
}

const base = { rowWidth: 1200, padStart: 32, padEnd: 32 };

describe('screenPanesFoldSplit', () => {
  it('keeps the class layout with no fold, or before the row is measured', () => {
    assert.equal(screenPanesFoldSplit({ ...base, folds: [] }), null);
    assert.equal(screenPanesFoldSplit({ ...base, rowWidth: null, folds: [fold({})] }), null);
  });

  it('ends the primary pane a gutter before an occluding hinge and clears the hinge', () => {
    const split = screenPanesFoldSplit({ ...base, folds: [fold({})] });
    assert.deepEqual(split, { primaryWidth: 600 - 32 - FOLD_GUTTER, gap: 20 + FOLD_GUTTER * 2 });
    // The trailing pane starts after the hinge's far edge plus the gutter.
    assert.ok(split !== null && 32 + split.primaryWidth + split.gap >= 620 + FOLD_GUTTER);
  });

  it('treats a zero-width separating fold as a boundary', () => {
    assert.deepEqual(screenPanesFoldSplit({ ...base, folds: [fold({ width: 0 })] }), { primaryWidth: 552, gap: FOLD_GUTTER * 2 });
  });

  it('ignores a flat non-separating crease and a horizontal (tabletop) fold', () => {
    assert.equal(screenPanesFoldSplit({ ...base, folds: [fold({ separating: false })] }), null);
    assert.equal(screenPanesFoldSplit({ ...base, folds: [fold({ orientation: 'horizontal' })] }), null);
  });

  it('ignores a fold outside the row (beside a rail or an offset host)', () => {
    assert.equal(screenPanesFoldSplit({ ...base, folds: [fold({ x: -40 })] }), null);
    assert.equal(screenPanesFoldSplit({ ...base, folds: [fold({ x: 1300 })] }), null);
  });

  it('skips an off-row fold and uses the first one inside the row', () => {
    const split = screenPanesFoldSplit({ ...base, folds: [fold({ x: -40 }), fold({ x: 600 })] });
    assert.equal(split?.primaryWidth, 552);
  });

  it('keeps the class layout when either side would be too narrow', () => {
    assert.equal(screenPanesFoldSplit({ ...base, folds: [fold({ x: 200 })] }), null);
    assert.equal(screenPanesFoldSplit({ ...base, folds: [fold({ x: 1000 })] }), null);
  });
});
