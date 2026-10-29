import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { headerBack } from './header-back.ts';
import { HEADER_BAR_PT, HEADER_CONTROL_PT, appHeaderLayout, fitToHeaderSlot } from './header-metrics.ts';

const ROUTES = ['/', '/home', '/game', '/mons', '/profile', '/sync', '/error', '/mons/dex-002', '/mon/abc', '/journal', '/settings', '/notifications', '/game-controls', '/feed'];

describe('app header height', () => {
  it('is 44 pt controls, 8 pt above and below, and the 2 pt keyline: 62 pt under the top inset', () => {
    assert.equal(HEADER_CONTROL_PT, 44);
    assert.equal(HEADER_BAR_PT, 62);
    assert.deepEqual(appHeaderLayout({ topInset: 24, back: false }), { height: 86, bar: 62, slot: 44 });
  });

  it('is the same on every route, with or without the Back button', () => {
    for (const topInset of [0, 20, 24, 47]) {
      const heights = new Set(
        ROUTES.flatMap((p) => [appHeaderLayout({ topInset, back: headerBack(p) !== null }).height, appHeaderLayout({ topInset, back: false }).height]),
      );
      assert.deepEqual([...heights], [topInset + HEADER_BAR_PT], `inset ${topInset}`);
    }
  });

  it('shrinks the kit Back tile to fit the 44 pt slot and never enlarges it', () => {
    assert.equal(fitToHeaderSlot(64), 44 / 64);
    assert.equal(fitToHeaderSlot(48), 44 / 48);
    assert.equal(fitToHeaderSlot(44), 1);
    assert.equal(fitToHeaderSlot(32), 1);
    assert.equal(fitToHeaderSlot(0), 1);
  });

  it('AppHeader takes its height from these metrics, not from a per-view safe-area measurement', () => {
    const src = readFileSync(new URL('../../../../apps/mobile/components/AppHeader.tsx', import.meta.url), 'utf8');
    assert.match(src, /appHeaderLayout\(/);
    assert.match(src, /useSafeAreaInsets\(/);
    assert.doesNotMatch(src, /<SafeArea\b/, 'a native SafeAreaView pads by its own measured insets, which vary by route');
    assert.doesNotMatch(src, /\bpy-\d/, 'vertical padding comes from the fixed bar height');
  });

  it('the header Back sits in the fixed slot', () => {
    const src = readFileSync(new URL('./use-header-back.tsx', import.meta.url), 'utf8');
    assert.match(src, /fitToHeaderSlot\(/);
    assert.match(src, /HEADER_CONTROL_PT/);
  });
});
