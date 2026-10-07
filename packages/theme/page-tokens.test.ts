/**
 * Page choreography, signage type and home layout tokens (premium site
 * Phase 2): the groups exist with sane values, and build-css.mjs emits the
 * variables the web utilities read.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { contentWidths, hud, leading, minHeights, pageMotion, typeRamp, typeScale } from './tokens.ts';

const css = (file: string) => readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');

test('page durations ascend and stay in the 0.4–1.3 s band', () => {
  const steps = Object.values(pageMotion.duration);
  assert.deepEqual(Object.keys(pageMotion.duration), ['xs', 'sm', 'md', 'lg', 'xl']);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i]! > steps[i - 1]!);
  assert.ok(steps[0]! >= 0.4 && steps[steps.length - 1]! <= 1.3);
});

test('every page ease pairs a GSAP name with a CSS curve', () => {
  for (const [name, { gsap, css: curve }] of Object.entries(pageMotion.ease)) {
    assert.ok(gsap.length > 0, name);
    assert.match(curve, /^(cubic-bezier\(|linear$)/, name);
  }
});

test('distance, parallax and scale groups exist', () => {
  assert.ok(pageMotion.distance.reveal > 0);
  assert.ok(pageMotion.parallax.max >= pageMotion.parallax.near);
  assert.ok(pageMotion.scale.hover > 1);
});

test('type-tag holds the label floor and carries its tracking', () => {
  assert.ok(typeRamp['type-tag'].sizePt >= 14);
  assert.equal(typeRamp['type-tag'].trackingEm, 0.18);
  assert.equal(typeScale['display-hero'].size, '2.75rem');
});

test('home layout tokens exist', () => {
  for (const key of ['content-measure', 'content-narrow', 'content-hero-art'] as const) assert.ok(contentWidths[key]);
  assert.ok(minHeights.hero);
  assert.ok(leading.display && leading.heading);
});

test('the HUD palette is hex colours only', () => {
  for (const [key, hex] of Object.entries(hud)) assert.match(hex, /^#[0-9A-F]{6}$/i, key);
});

for (const file of ['theme.css', 'theme-native.css']) {
  test(`${file} emits the page motion and layout vars`, () => {
    const out = css(file);
    for (const step of Object.keys(pageMotion.duration)) {
      const ms = `${Math.round(pageMotion.duration[step as keyof typeof pageMotion.duration] * 1000)}ms`;
      assert.ok(out.includes(`--transition-duration-page-${step}: ${ms};`), `duration utility ${step}`);
      assert.ok(out.includes(`--duration-page-${step}: ${ms};`), `duration var ${step}`);
    }
    assert.ok(out.includes(`--ease-page-out: ${pageMotion.ease.out.css};`));
    assert.ok(out.includes(`--ease-page-in-out: ${pageMotion.ease.inOut.css};`));
    assert.ok(out.includes('--transition-duration-base: 200ms;'));
    assert.ok(out.includes(`--scale-page-hover: ${pageMotion.scale.hover};`));
    assert.ok(out.includes('--text-type-tag--letter-spacing: 0.18em;'));
    assert.ok(out.includes('--container-content-measure: 36rem;'));
    assert.ok(out.includes(`--min-height-hero: ${minHeights.hero};`));
    assert.ok(out.includes(`--leading-display: ${leading.display};`));
  });
}
