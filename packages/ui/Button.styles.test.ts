import assert from 'node:assert/strict';
import test from 'node:test';
import { xrTargets } from '@acme/theme';
import { TARGET_FLOOR, button, buttonLabelStep, buttonMinHeight, type ButtonPlatform, type ButtonSize } from './Button.styles.ts';

const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];
const LOOKS = ['solid', 'outline', 'ghost'] as const;
const PLATFORMS: ButtonPlatform[] = ['ios', 'android', 'web', 'headset'];

test('every look x size x platform has a press target at or above the platform floor', () => {
  for (const look of LOOKS) {
    for (const size of SIZES) {
      for (const platform of PLATFORMS) {
        const h = buttonMinHeight(look, size, platform);
        assert.ok(h >= TARGET_FLOOR[platform], `${look}/${size} on ${platform}: ${h} < ${TARGET_FLOOR[platform]}`);
      }
    }
  }
});

test('the floors are the platform minimums: 44 on iOS and web, 48 on Android and headsets', () => {
  assert.deepEqual(TARGET_FLOOR, { ios: 44, android: 48, web: 44, headset: xrTargets.target });
  assert.equal(xrTargets.target, 48);
});

test('roots carry no rem min-height, which the rem-14 polyfill would shrink', () => {
  for (const look of LOOKS) {
    for (const size of SIZES) {
      const root = button({ look, size }).root();
      assert.doesNotMatch(root, /(^|\s)(android:)?min-h-(\d+|\[)/, `${look}/${size}: ${root}`);
    }
  }
});

test('labels use the mobile ramp on phones and the xr ramp on headsets', () => {
  for (const size of SIZES) {
    for (const headset of [false, true]) {
      const label = button({ size, xr: headset }).label().split(' ');
      assert.ok(label.includes(`text-${buttonLabelStep(size, headset)}`), `${size}/${headset}: ${label.join(' ')}`);
      assert.ok(!label.some((c) => /^(md:)?text-(xs|sm|base|lg|xl)$/.test(c)), `rem step in ${label.join(' ')}`);
    }
  }
  assert.equal(buttonLabelStep('sm', false), 'type-label');
  assert.equal(buttonLabelStep('lg', false), 'type-body');
  assert.equal(buttonLabelStep('md', true), 'xr-label');
  assert.equal(buttonLabelStep('lg', true), 'xr-body');
});

test('the label size survives the tone colour class appended after it', () => {
  for (const headset of [false, true]) {
    const label = button({ size: 'md', xr: headset }).label({ className: 'text-on-cta' }).split(' ');
    assert.ok(label.includes(`text-${buttonLabelStep('md', headset)}`), label.join(' '));
    assert.ok(label.includes('text-on-cta'), label.join(' '));
    const off = button({ size: 'md', xr: headset, disabled: true }).label().split(' ');
    assert.ok(off.includes(`text-${buttonLabelStep('md', headset)}`) && off.includes('text-ink-400'), off.join(' '));
  }
});
