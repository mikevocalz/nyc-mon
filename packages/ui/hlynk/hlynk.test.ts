import assert from 'node:assert/strict';
import test from 'node:test';
import { HLYNK_GEOMETRY, STANDARD_ROW_NEED_PT, measureShell } from './layout.ts';
import { blinkStops, maxFlashesPerSecond, resolveLedRhythm, type LedState } from './led-rhythm.ts';
import { HLYNK_COPY, ledAccessibilityLabel } from './copy.ts';
import { resolveTier } from './tier.ts';
import { motionTokens } from '@acme/theme';

const STATES: LedState[] = ['off', 'boot', 'incubating', 'ready', 'needsYou'];

test('iPhone SE 3 fits the standard row inside its 139 pt budget', () => {
  const g = measureShell({ widthPt: 375, heightPt: 667, safeTopPt: 20, safeBottomPt: 0 });
  assert.equal(g.layout, 'standard');
  assert.equal(g.screenWidthPt, 351);
  assert.equal(g.screenHeightPt, 468);
  assert.equal(g.rowPt, 139);
  assert.ok(g.rowPt >= STANDARD_ROW_NEED_PT, `row ${g.rowPt} < need ${STANDARD_ROW_NEED_PT}`);
  // width: four keys and the pad with room for gaps
  const used = HLYNK_GEOMETRY.keyPt * 4 + HLYNK_GEOMETRY.trackpadPt;
  assert.ok(g.screenWidthPt - used >= 4 * 11 - 1);
});

test('16 Pro Max and Pixel 8 match DIRECTION.md', () => {
  const max = measureShell({ widthPt: 440, heightPt: 956, safeTopPt: 62, safeBottomPt: 34 });
  assert.equal(max.screenWidthPt, 416);
  assert.equal(Math.round(max.rowPt), 265);
  const pixel = measureShell({ widthPt: 412, heightPt: 915, safeTopPt: 24, safeBottomPt: 24 });
  assert.equal(Math.round(pixel.rowPt), 310);
});

test('short windows drop to compact; tablets stay phone-width', () => {
  const landscape = measureShell({ widthPt: 667, heightPt: 375, safeTopPt: 0, safeBottomPt: 0 });
  assert.equal(landscape.layout, 'compact');
  assert.equal(landscape.rowPt, 72);
  assert.equal(landscape.headPt, 24);
  const tablet = measureShell({ widthPt: 834, heightPt: 1194, safeTopPt: 24, safeBottomPt: 20 });
  assert.equal(tablet.layout, 'standard');
  assert.equal(tablet.bodyWidthPt, 440);
  assert.equal(tablet.rowPt, HLYNK_GEOMETRY.maxRowPt);
});

test('every LED rhythm stays at or under three flashes a second (WCAG 2.3.1)', () => {
  for (const state of STATES) {
    for (const reduced of [false, true]) {
      const r = resolveLedRhythm(state, reduced);
      assert.ok(maxFlashesPerSecond(r) <= 3, `${state} reduced=${reduced}`);
    }
  }
  assert.equal(maxFlashesPerSecond(resolveLedRhythm('needsYou', false)), 3);
  assert.equal(maxFlashesPerSecond(resolveLedRhythm('ready', false)), 2);
});

test('reduced motion never animates the LED and carries the authored cue', () => {
  assert.deepEqual(resolveLedRhythm('boot', true), { kind: 'steady', cue: undefined });
  assert.deepEqual(resolveLedRhythm('incubating', true), { kind: 'steady', cue: 'progress-ticks' });
  assert.deepEqual(resolveLedRhythm('ready', true), { kind: 'steady', cue: 'filled-dot' });
  assert.deepEqual(resolveLedRhythm('needsYou', true), { kind: 'steady', cue: 'exclamation-dot' });
  assert.deepEqual(resolveLedRhythm('off', true), { kind: 'dark' });
});

test('full motion follows the tokens', () => {
  assert.deepEqual(resolveLedRhythm('boot', false), { kind: 'ramp', durationMs: 240 });
  const breath = resolveLedRhythm('incubating', false);
  assert.equal(breath.kind, 'breathe');
  const ready = resolveLedRhythm('ready', false);
  assert.ok(ready.kind === 'blink' && ready.cycleMs === 6000);
});

test('blink stops are ordered and end lit', () => {
  const stops = blinkStops(motionTokens['motion-led-blink-needs-you'].full);
  for (let i = 1; i < stops.length; i += 1) assert.ok(stops[i]!.offsetPct > stops[i - 1]!.offsetPct);
  assert.equal(stops.at(-1)!.opacity, 1);
  assert.equal(stops.filter((s) => s.opacity === 0).length, 6);
});

test('copy never says "device" and fills the LED label', () => {
  for (const s of Object.values(HLYNK_COPY)) assert.ok(!/device/i.test(s), s);
  assert.equal(ledAccessibilityLabel('Ready to hatch'), 'Status light: Ready to hatch');
});

test('tiers without tokens resolve to core', () => {
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    assert.equal(resolveTier('pro', 'Test'), 'core');
    assert.equal(resolveTier('standard', 'Test'), 'core');
    assert.equal(resolveTier('core', 'Test'), 'core');
  } finally {
    console.warn = warn;
  }
});

test('a 320 pt phone shrinks the trackpad, never the keys', () => {
  const g = measureShell({ widthPt: 320, heightPt: 600, safeTopPt: 0, safeBottomPt: 0 });
  assert.equal(g.layout, 'standard');
  assert.equal(g.trackpadPt, 296 - 48 * 4 - 8 * 5);
  const se = measureShell({ widthPt: 375, heightPt: 667, safeTopPt: 20, safeBottomPt: 0 });
  assert.equal(se.trackpadPt, HLYNK_GEOMETRY.trackpadPt);
});
