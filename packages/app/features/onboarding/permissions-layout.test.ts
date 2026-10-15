import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { permissionViewport } from './permissions-layout.ts';

describe('final onboarding fold-safe viewport', () => {
  it('uses the entire phone screen when there is no hinge', () => {
    assert.deepEqual(permissionViewport(390, 844, []), { left: 0, top: 0, width: 390, height: 844 });
  });
  it('does not mistake a flat, nonseparating crease for a dual screen', () => {
    assert.deepEqual(permissionViewport(900, 700, [{
      kind: 'division', x: 446, y: 0, width: 8, height: 700,
      orientation: 'vertical', active: false, separating: false,
    }]), { left: 0, top: 0, width: 900, height: 700 });
  });
  it('avoids an Android book hinge, even when flat but separating', () => {
    assert.deepEqual(permissionViewport(1000, 800, [{
      kind: 'division', x: 492, y: 0, width: 16, height: 800,
      orientation: 'vertical', active: false, separating: true,
    }]), { left: 0, top: 0, width: 492, height: 800 });
  });
  it('keeps a tabletop form wholly below a horizontal hinge on an area tie', () => {
    assert.deepEqual(permissionViewport(800, 804, [{
      kind: 'division', x: 0, y: 400, width: 800, height: 4,
      orientation: 'horizontal', active: true,
    }]), { left: 0, top: 404, width: 800, height: 400 });
  });
  it('keeps a trifold form in one of three physical panels', () => {
    assert.deepEqual(permissionViewport(1270, 820, [
      { kind: 'division', x: 395, y: 0, width: 15, height: 820, separating: true, orientation: 'vertical' },
      { kind: 'division', x: 850, y: 0, width: 15, height: 820, separating: true, orientation: 'vertical' },
    ]), { left: 410, top: 0, width: 440, height: 820 });
  });
  it('does not treat a camera occlusion as a screen split', () => {
    assert.deepEqual(permissionViewport(390, 844, [{
      kind: 'occlusion', x: 170, y: 0, width: 50, height: 28, active: true,
    }]), { left: 0, top: 0, width: 390, height: 844 });
  });
});
