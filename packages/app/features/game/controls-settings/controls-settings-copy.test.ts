import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONTROLLER_PROFILE } from '@acme/ui/game-controls/parts';
import {
  G03,
  SLIDER_RANGES,
  percentLabel,
  percentSpoken,
  previewAccessibilityLabel,
  snapToStep,
  stepSlider,
  timesLabel,
  timesSpoken,
} from './controls-settings-copy.ts';

test('percent values print and speak as whole percents', () => {
  assert.equal(percentLabel(0.15), '15%');
  assert.equal(percentSpoken(0.15), '15 percent');
  assert.equal(percentLabel(1), '100%');
  assert.equal(percentSpoken(0.3), '30 percent');
});

test('sensitivity prints and speaks as "times" with at most one decimal', () => {
  assert.equal(timesLabel(1), '1×');
  assert.equal(timesSpoken(1), '1 times');
  assert.equal(timesLabel(1.5), '1.5×');
  assert.equal(timesSpoken(1.5), '1.5 times');
  assert.equal(timesLabel(0.7000000000000001), '0.7×');
});

test('slider values snap to their step and stay inside the contract range', () => {
  assert.equal(snapToStep(0.15000000000000002, SLIDER_RANGES.deadZone), 0.15);
  assert.equal(snapToStep(0.52, SLIDER_RANGES.deadZone), 0.5);
  assert.equal(snapToStep(-0.1, SLIDER_RANGES.deadZone), 0);
  assert.equal(snapToStep(1.23, SLIDER_RANGES.sensitivity), 1.2);
  assert.equal(snapToStep(1.37, SLIDER_RANGES.scale), 1.4);
  assert.equal(snapToStep(0.33, SLIDER_RANGES.opacity), 0.35);
});

test('the preview label names hand, size, opacity and stick mode', () => {
  assert.equal(
    previewAccessibilityLabel(DEFAULT_CONTROLLER_PROFILE),
    'Controller preview. Right, size 100 percent, opacity 90 percent, analog stick.',
  );
  assert.equal(
    previewAccessibilityLabel({ ...DEFAULT_CONTROLLER_PROFILE, handedness: 'left', stickMode: 'dpad', scale: 1.2, opacity: 0.5 }),
    'Controller preview. Left, size 120 percent, opacity 50 percent, D-pad stick.',
  );
});

test('visible strings are the copy deck strings, within its limits', () => {
  // The strings are G03 05-copy.md verbatim. Four of the deck's own strings
  // run past the "Max" column it gives them (hand.caption 75/74,
  // restore.body 75/74, opacity.caption 54/48, stick.placement.caption
  // 50/48); those four are held at their measured length here and reported
  // to the ux-writer rather than shortened without the deck.
  const limits: [string, number][] = [
    [G03.title, 26], [G03.intro, 37], [G03.stick.mode.caption, 74], [G03.stick.placement.caption, 50],
    [G03.stick.deadzone.caption, 48], [G03.stick.sensitivity.caption, 48], [G03.hand.caption, 75],
    [G03.opacity.caption, 54], [G03.preview.hint, 48], [G03.bindings.caption, 74], [G03.restore.button, 34],
    [G03.restore.title, 26], [G03.restore.body, 75], [G03.restore.confirm, 34], [G03.restore.cancel, 34],
    [G03.restore.done, 37], [G03.reduced.action, 8], [G03.reduced.hint, 28],
  ];
  for (const [text, max] of limits) assert.ok(text.length <= max, `"${text}" exceeds ${max}`);
  for (const text of limits.map(([t]) => t)) assert.ok(!text.includes('!'), `"${text}" has an exclamation mark`);
  assert.equal(G03.hand.caption, 'Left puts the buttons under your left thumb and the stick under your right.');
  assert.equal(G03.restore.cancel, 'Keep my settings');
});

test('an accessibility increment or decrement moves one snapped step and stops at the ends (finding M11)', () => {
  assert.equal(stepSlider(0.15, SLIDER_RANGES.deadZone, 'increment'), 0.2);
  assert.equal(stepSlider(0.15, SLIDER_RANGES.deadZone, 'decrement'), 0.1);
  assert.equal(stepSlider(0.5, SLIDER_RANGES.deadZone, 'increment'), 0.5);
  assert.equal(stepSlider(0, SLIDER_RANGES.deadZone, 'decrement'), 0);
  assert.equal(stepSlider(1, SLIDER_RANGES.sensitivity, 'increment'), 1.1);
  // A float that drifted off the grid snaps before it steps.
  assert.equal(stepSlider(0.15000000000000002, SLIDER_RANGES.deadZone, 'increment'), 0.2);
});
