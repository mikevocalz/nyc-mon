import assert from 'node:assert/strict';
import test from 'node:test';
import { placeMenu } from './Menu.web-position.ts';
const viewport = { left: 0, top: 0, width: 844, height: 390 };
test('short landscape flips above and bounds scroll space for every option', () => {
  const p = placeMenu({ left: 600, right: 820, top: 300, bottom: 344 }, viewport, 220, 500);
  assert.equal(p.side, 'above');
  assert.equal(p.top, 8);
  assert.equal(p.maxHeight, 286);
  assert.ok(p.top + p.maxHeight <= 382);
});
test('narrow and offset visual viewports clamp every popup edge', () => {
  const p = placeMenu({ left: 260, right: 400, top: 135, bottom: 170 }, { left: 50, top: 100, width: 280, height: 240 }, 420, 400);
  assert.equal(p.width, 264);
  assert.equal(p.left, 58);
  assert.ok(p.top >= 108);
  assert.ok(p.top + p.maxHeight <= 332);
});
test('fitting menus stay below and offscreen/fullscreen anchors remain reachable', () => {
  const p = placeMenu({ left: 10, right: 60, top: 30, bottom: 60 }, viewport, 208, 140);
  assert.equal(p.side, 'below'); assert.equal(p.top, 66); assert.equal(p.left, 8);
  for (const anchor of [{ left: 0, right: 844, top: -100, bottom: 500 }, { left: 20, right: 50, top: 500, bottom: 550 }]) {
    const result = placeMenu(anchor, viewport, 208, 800);
    assert.ok(result.maxHeight >= 44);
    assert.ok(result.top >= 8);
    assert.ok(result.top + result.maxHeight <= 382);
  }
});
