/**
 * Horizon OS type and target tokens (docs/spatial/HORIZON-LAYOUT.md, lesson 6).
 * They must reach both CSS outputs in px: the native rem polyfill is 14, so a
 * rem value would render smaller on the headset than the token says.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { typeRamp, xrTargets, xrTypeRamp } from './tokens.ts';

const css = (file: string) => readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');

test('each xr step is at least as large as the mobile step it replaces', () => {
  assert.ok(xrTypeRamp['xr-caption'].sizePt >= typeRamp['type-caption'].sizePt);
  assert.ok(xrTypeRamp['xr-label'].sizePt >= typeRamp['type-label'].sizePt);
  assert.ok(xrTypeRamp['xr-body'].sizePt >= typeRamp['type-body'].sizePt);
  assert.ok(xrTypeRamp['xr-title'].sizePt >= typeRamp['type-title'].sizePt);
  assert.ok(xrTypeRamp['xr-heading'].sizePt >= typeRamp['type-station'].sizePt);
});

test('pointer target is the 48dp Horizon minimum', () => {
  assert.equal(xrTargets.target, 48);
});

for (const file of ['theme.css', 'theme-native.css']) {
  test(`${file} emits xr type and targets in px`, () => {
    const body = css(file);
    for (const [name, step] of Object.entries(xrTypeRamp)) {
      assert.ok(body.includes(`--text-${name}: ${step.sizePt}px;`), `${file}: --text-${name}`);
      assert.ok(body.includes(`--text-${name}--line-height: ${step.lineHeightPt}px;`), `${file}: --text-${name} line height`);
    }
    for (const [name, px] of Object.entries(xrTargets)) {
      assert.ok(body.includes(`--spacing-${name}: ${px}px;`), `${file}: --spacing-${name}`);
    }
  });
}
