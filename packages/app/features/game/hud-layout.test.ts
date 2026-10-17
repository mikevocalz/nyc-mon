import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FoldLayout } from '@acme/ui/adaptive-panes/parts';
import { HUD_MARGIN, insideOneRegion, resolveGameHudLayout, usableRegions, type GameHudLayoutInput } from './hud-layout.ts';

const none = { top: 0, right: 0, bottom: 0, left: 0 };
const base: GameHudLayoutInput = { width: 400, height: 800, insets: none, folds: [], railEdge: null, isRTL: false };
const vfold = (x: number, width: number, extra: Partial<FoldLayout> = {}): FoldLayout => ({
  orientation: 'vertical', state: 'flat', posture: 'flat', separating: true, x, y: 0, width, height: 800, ...extra,
});

function assertSafe(input: GameHudLayoutInput) {
  const layout = resolveGameHudLayout(input);
  for (const rect of [layout.status, layout.blocking]) {
    assert.ok(insideOneRegion(rect, layout.regions), `rect ${JSON.stringify(rect)} straddles a fold or leaves the safe area`);
  }
  assert.equal('attribution' in layout, false, 'map credits must not reserve HUD space');
  return layout;
}

test('phone portrait: status at the top of the controller region', () => {
  const l = assertSafe(base);
  assert.equal(l.status.y, HUD_MARGIN);
  assert.equal(l.blocking.width, 400);
});

test('RTL keeps the blocking region off the navigation rail', () => {
  assertSafe({ ...base, isRTL: true });
  // Two columns: a right rail in LTR moves the blocking region to the left column.
  const railed = assertSafe({ ...base, width: 840, railEdge: 'right', folds: [vfold(400, 40, { occlusionType: 'full' })] });
  assert.ok(railed.blocking.x + railed.blocking.width <= 400);
  // Physical right rail in RTL (foldable policy): the blocking region stays off the rail edge.
  const rtlRailed = assertSafe({ ...base, width: 840, isRTL: true, railEdge: 'left', folds: [vfold(400, 40, { occlusionType: 'full' })] });
  assert.ok(rtlRailed.blocking.x >= 440);
});

test('vertical occluding hinge: status and blocking region stay on the trailing screen', () => {
  const l = assertSafe({ ...base, width: 840, folds: [vfold(400, 40, { occlusionType: 'full' })] });
  assert.equal(l.regions.length, 2);
  assert.ok(l.blocking.x >= 440);
});

test('zero-width separating fold still splits', () => {
  assert.equal(usableRegions(800, 800, none, [vfold(400, 0)]).length, 2);
  assertSafe({ ...base, width: 800, folds: [vfold(400, 0)] });
});

test('flat non-separating, non-occluding crease leaves one region', () => {
  assert.equal(usableRegions(800, 800, none, [vfold(400, 0, { separating: false, occlusionType: 'none' })]).length, 1);
});

test('tabletop: status and blocking region stay in the lower half', () => {
  const fold: FoldLayout = { orientation: 'horizontal', state: 'halfOpened', posture: 'tabletop', separating: true, x: 0, y: 400, width: 400, height: 0 };
  const l = assertSafe({ ...base, folds: [fold] });
  for (const rect of [l.status, l.blocking]) assert.ok(rect.y >= 400);
});

test('trifold: every fold processed, off-container fold ignored', () => {
  const l = assertSafe({ ...base, width: 1200, folds: [vfold(400, 0), vfold(800, 0), vfold(1500, 0)] });
  assert.equal(l.regions.length, 3);
  assert.ok(l.blocking.x >= 800);
});

test('a short window keeps the status inside the region', () => {
  const l = assertSafe({ ...base, width: 800, height: 100 });
  assert.ok(l.status.y + l.status.height <= 100);
});

test('safe-area insets are respected', () => {
  const l = assertSafe({ ...base, insets: { top: 59, right: 0, bottom: 34, left: 0 } });
  assert.ok(l.status.y >= 59);
  assert.ok(l.blocking.y + l.blocking.height <= 800 - 34);
});

test('blocking states sit on one side of a spanned dual-screen hinge', () => {
  const l = assertSafe({ ...base, width: 840, folds: [vfold(400, 40, { occlusionType: 'full' })] });
  assert.ok(l.blocking.x >= 440 || l.blocking.x + l.blocking.width <= 400);
});
