// Decision H-3 (docs/design/hlynk/ADAPTIVE.md): M08 and M10 as fit blocks.
// packages/ui/hlynk/adaptive.test.ts runs these shapes through the shell
// geometry and fitHLynkContent for every viewport; this file pins the shapes
// and copy lengths it mirrors, so the two cannot drift apart silently.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EGG_COPY } from './copy.ts';
import { incubateArrangement, incubateFitBlocks, meetFitBlocks, RING_MIN_DP, TRIPTYCH_MIN_DP } from './window-layout.ts';

const base = {
  titleChars: EGG_COPY['m10.title'].length,
  bodyChars: EGG_COPY['m10.body'].length,
  headInScreen: true,
  listLayout: false,
  readyChars: 'Ready at 12:45 PM tomorrow'.length,
  actionsShown: true,
  error: null,
  fontScale: 1,
  widthDp: 400,
};

test('the copy lengths the ui fit test mirrors', () => {
  assert.equal(EGG_COPY['m10.title'].length, 33);
  assert.equal(EGG_COPY['m10.body'].length, 76);
  assert.equal(EGG_COPY['m08.title'].length, 13);
  assert.equal(EGG_COPY['m08.santoro.caption'].length, 42);
});

test('M10 stack: title, body, ring, ready, actions, Start', () => {
  assert.deepEqual(incubateFitBlocks(base, false), [
    { kind: 'text', role: 'title', chars: 33 },
    { kind: 'text', role: 'body', chars: 76, tight: true },
    { kind: 'media', minPt: RING_MIN_DP, maxPt: 260 },
    { kind: 'text', role: 'strong', chars: 26 },
    { kind: 'controls', size: 'sm', minRowWidthPt: 240 },
    { kind: 'controls', size: 'lg' },
  ]);
});

test('M10 side: the ring may reach 360; a tablet-sized screen grows the stacked ring', () => {
  const cap = (widthDp: number, side = false) => incubateFitBlocks({ ...base, widthDp }, side).find((b) => b.kind === 'media')?.maxPt;
  assert.equal(cap(400, true), 360);
  // Phones, up to the 440 pt body: unchanged.
  assert.equal(cap(400), 260);
  assert.equal(cap(439), 260);
  // Tablet shell (iPad body 600, screen content ~550): 70 % of the width, 300..420.
  assert.equal(cap(440), 308);
  assert.equal(cap(552), 386);
  assert.equal(cap(640), 420);
});

test('M10 busy and error states change only their own blocks', () => {
  const busy = incubateFitBlocks({ ...base, actionsShown: false }, false);
  assert.equal(busy.filter((b) => b.kind === 'controls').length, 1, 'Start only');
  const error = incubateFitBlocks({ ...base, error: { titleChars: 20, bodyChars: 60 } }, false);
  assert.ok(error.some((b) => b.kind === 'controls' && b.size === 'md'), 'Try again');
});

test('M10 arrangement: side on a landscape screen, never in the list layout', () => {
  assert.equal(incubateArrangement(836, 229, false), 'side');
  assert.equal(incubateArrangement(836, 229, true), 'stack');
  assert.equal(incubateArrangement(406, 540, false), 'stack');
});

test('M08 browsing: head, triptych, actions', () => {
  assert.deepEqual(meetFitBlocks({
    titleChars: 13, captionChars: 42, santoroChars: 0, headInScreen: true, listLayout: false,
    cardShown: false, confirming: false, actionsShown: true, fontScale: 1,
  }), [
    { kind: 'text', role: 'title', chars: 13 },
    { kind: 'text', role: 'body', chars: 42, tight: true },
    { kind: 'media', minPt: TRIPTYCH_MIN_DP, maxPt: 10_000 },
    { kind: 'controls', size: 'sm', minRowWidthPt: 320 },
  ]);
});
