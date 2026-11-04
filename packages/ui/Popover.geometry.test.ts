import test from 'node:test';
import assert from 'node:assert/strict';
import { placePopover, popoverVessel } from './Popover.geometry.ts';

const viewport = { left: 0, top: 0, width: 1280, height: 800 };
const anchor = { left: 1040, right: 1088, top: 100, bottom: 148 };

test('adaptive rich Popover uses native anchored overlay only where there is real room', () => {
  assert.equal(popoverVessel({ width: 1280, height: 800 }), 'anchored');
  assert.equal(popoverVessel({ width: 390, height: 844 }), 'sheet');
  assert.equal(popoverVessel({ width: 768, height: 300 }), 'sheet');
  assert.equal(popoverVessel({ width: 768, height: 620, keyboardHeight: 300 }), 'sheet');
  assert.equal(popoverVessel({ width: 1280, height: 800, regions: [{ active: true,
    kind: 'division', separating: true, orientation: 'vertical' }] }), 'sheet');
  assert.equal(popoverVessel({ width: 1280, height: 800, regions: [{ active: true,
    kind: 'division', separating: false, orientation: 'vertical' }] }), 'anchored');
  assert.throws(() => popoverVessel({ width: NaN, height: 800 }), RangeError);
});

test('popover keeps full-size inspector near right-edge trigger, respecting margins', () => {
  const result = placePopover(anchor, viewport, 360, 280);
  assert.equal(result.side, 'below');
  assert.equal(result.width, 360);
  assert.ok(result.left >= 8);
  assert.ok(result.left + result.width <= 1272);
  assert.equal(result.scrollable, false);
});

test('popover flips above and bounds oversized content with internal scrolling', () => {
  const bottom = { ...anchor, top: 720, bottom: 768 };
  const result = placePopover(bottom, viewport, 360, 1100);
  assert.equal(result.side, 'above');
  assert.equal(result.scrollable, true);
  assert.ok(result.top >= 8);
  assert.ok(result.top + result.maxHeight <= bottom.top);
});

test('RTL and visual viewport offsets remain correct under zoom and pinch', () => {
  const visual = { left: 40, top: 70, width: 450, height: 500 };
  const target = { left: 115, top: 140, right: 159, bottom: 184 };
  const rtl = placePopover(target, visual, 300, 280, 'auto', 'rtl');
  assert.equal(rtl.left, 115);
  const ltr = placePopover(target, visual, 300, 280, 'auto', 'ltr');
  assert.notEqual(ltr.left, rtl.left);
  for (const result of [ltr, rtl]) {
    assert.ok(result.top >= visual.top + 8);
    assert.ok(result.left >= visual.left + 8);
    assert.ok(result.left + result.width <= visual.left + visual.width - 8);
  }
});

test('invalid geometry is rejected before any popup becomes visible', () => {
  assert.throws(() => placePopover(anchor, viewport, 0, 200), RangeError);
  assert.throws(() => placePopover(anchor, viewport, 200, Infinity), RangeError);
  assert.throws(() => placePopover({ ...anchor, right: 100 }, viewport, 200, 200), RangeError);
});

test('at narrow height, long popover still stays within visible viewport', () => {
  const view = { left: 0, top: 0, width: 650, height: 200 };
  const a = { left: 500, right: 544, top: 88, bottom: 130 };
  const result = placePopover(a, view, 300, 600);
  assert.ok(result.top >= 8);
  assert.ok(result.top + result.maxHeight <= 192);
  assert.equal(result.scrollable, true);
});
