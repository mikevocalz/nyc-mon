import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FoldLayout } from '@acme/ui/adaptive-panes/parts';
import { insideOneRegion, resolveGameHudLayout, usableRegions, type GameHudLayoutInput } from './hud-layout.ts';

const none = { top: 0, right: 0, bottom: 0, left: 0 };
const base: GameHudLayoutInput = { width: 400, height: 800, insets: none, folds: [], railEdge: null, isRTL: false, controlCount: 6, movePadOpen: false };
const vfold = (x: number, width: number, extra: Partial<FoldLayout> = {}): FoldLayout => ({
  orientation: 'vertical', state: 'flat', posture: 'flat', separating: true, x, y: 0, width, height: 800, ...extra,
});

function assertSafe(input: GameHudLayoutInput) {
  const layout = resolveGameHudLayout(input);
  for (const rect of [layout.controls, layout.attribution, layout.status, ...(layout.movePad ? [layout.movePad] : [])]) {
    assert.ok(insideOneRegion(rect, layout.regions), `rect ${JSON.stringify(rect)} straddles a fold or leaves the safe area`);
  }
  return layout;
}

test('phone portrait: controls trailing (right), attribution bottom-left', () => {
  const l = assertSafe(base);
  assert.equal(l.controls.edge, 'right');
  assert.equal(l.controls.axis, 'vertical');
  assert.ok(l.attribution.x < 50);
});

test('RTL mirrors to the left; a right rail pushes controls left in LTR', () => {
  assert.equal(assertSafe({ ...base, isRTL: true }).controls.edge, 'left');
  assert.equal(assertSafe({ ...base, railEdge: 'right' }).controls.edge, 'left');
  // Physical right rail in RTL (foldable policy): controls stay off the rail edge.
  assert.equal(assertSafe({ ...base, isRTL: true, railEdge: 'left' }).controls.edge, 'right');
});

test('vertical occluding hinge: nothing inside the hinge, controls on the trailing screen', () => {
  const l = assertSafe({ ...base, width: 840, folds: [vfold(400, 40, { occlusionType: 'full' })] });
  assert.equal(l.regions.length, 2);
  assert.ok(l.controls.x >= 440);
  assert.ok(l.attribution.x + l.attribution.width <= 400);
});

test('zero-width separating fold still splits', () => {
  assert.equal(usableRegions(800, 800, none, [vfold(400, 0)]).length, 2);
  assertSafe({ ...base, width: 800, folds: [vfold(400, 0)] });
});

test('flat non-separating, non-occluding crease leaves one region', () => {
  assert.equal(usableRegions(800, 800, none, [vfold(400, 0, { separating: false, occlusionType: 'none' })]).length, 1);
});

test('tabletop: controls, status and attribution all in the lower half', () => {
  const fold: FoldLayout = { orientation: 'horizontal', state: 'halfOpened', posture: 'tabletop', separating: true, x: 0, y: 400, width: 400, height: 0 };
  const l = assertSafe({ ...base, folds: [fold] });
  for (const rect of [l.controls, l.status, l.attribution]) assert.ok(rect.y >= 400);
});

test('trifold: every fold processed, off-container fold ignored', () => {
  const l = assertSafe({ ...base, width: 1200, folds: [vfold(400, 0), vfold(800, 0), vfold(1500, 0)] });
  assert.equal(l.regions.length, 3);
  assert.ok(l.controls.x >= 800);
});

test('short landscape window lays the controls out as a row', () => {
  const l = assertSafe({ ...base, width: 800, height: 340 });
  assert.equal(l.controls.axis, 'horizontal');
});

test('move pad stays in the controls region, beside or above the column', () => {
  assertSafe({ ...base, movePadOpen: true });
  assertSafe({ ...base, width: 840, folds: [vfold(600, 40, { occlusionType: 'full' })], movePadOpen: true });
});

test('safe-area insets are respected', () => {
  const l = assertSafe({ ...base, insets: { top: 59, right: 0, bottom: 34, left: 0 } });
  assert.ok(l.status.y >= 59);
  assert.ok(l.controls.y + l.controls.height <= 800 - 34);
});
