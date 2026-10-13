import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANON_COPY,
  CITY_COPY,
  COMPANION_COPY,
  DIRECTIONS,
  allReviewStrings,
  directionFromSearch,
  reviewRoutesEnabled,
} from './copy.ts';

// docs/COPY_DECK.md "Banned words in ui copy" and "Caller and Callah".
const BANNED = [
  /\bdevices?\b/i,
  /\bwild\b/i,
  /\bowners?\b/i,
  /\btrainers?\b/i,
  /\busers?\b/i,
  /\bmasters?\b/i,
  /\bcatch(es|ing)?\b/i,
  /\bcapture[sd]?\b/i,
  /\brecruit/i,
  /\bdead\b|\bdied\b|\bkilled\b/i,
  /\bfamily\b/i,
  /\bEngineX\b/i,
  /\bCallah\b/,
];

test('no review string uses a banned word, Callah or an exclamation mark', () => {
  for (const s of allReviewStrings()) {
    for (const re of BANNED) assert.doesNotMatch(s, re, `"${s}" matches ${re}`);
    assert.doesNotMatch(s, /!/, `"${s}" has an exclamation mark`);
  }
});

test('no pronoun for a Mon (PS-005)', () => {
  for (const s of allReviewStrings()) {
    assert.doesNotMatch(s, /\bMon\b[^.]*\b(he|she|him|her|his|hers)\b/i, `"${s}" may use a pronoun for a Mon`);
  }
});

test('headlines are sentence case and end with a full stop', () => {
  const headlines = [CANON_COPY.titleLines.flat().join(' '), COMPANION_COPY.title, CITY_COPY.title];
  for (const h of headlines) {
    assert.match(h, /^[A-Z]/);
    assert.match(h, /\.$/);
    // Only the first word, proper nouns and "Mon" may be capitalised.
    const caps = h.split(/\s+/).slice(1).filter((w) => /^[A-Z]/.test(w));
    for (const w of caps) assert.match(w, /^(Mon|Mons|New|York's|Your)\b/, `"${w}" in "${h}" breaks sentence case`);
  }
});

test('the proposed headlines join their art-directed lines exactly', () => {
  assert.equal(COMPANION_COPY.titleLines.join(' '), COMPANION_COPY.title);
  assert.equal(CITY_COPY.titleLines.join(' '), CITY_COPY.title);
});

test('A is the only approved direction', () => {
  assert.deepEqual(
    DIRECTIONS.map((d) => [d.id, d.status]),
    [['a', 'approved'], ['b', 'proposed'], ['c', 'proposed']],
  );
});

test('the review route is gated on NYCMON_REVIEW_ROUTES=1 exactly', () => {
  assert.equal(reviewRoutesEnabled({ NYCMON_REVIEW_ROUTES: '1' }), true);
  for (const value of [undefined, '', '0', 'true', 'yes']) {
    assert.equal(reviewRoutesEnabled({ NYCMON_REVIEW_ROUTES: value }), false, String(value));
  }
  assert.equal(reviewRoutesEnabled({}), false);
});

test('?direction= picks a direction and falls back to A', () => {
  assert.equal(directionFromSearch('?direction=b'), 'b');
  assert.equal(directionFromSearch('?direction=c'), 'c');
  assert.equal(directionFromSearch('?direction=z'), 'a');
  assert.equal(directionFromSearch(''), 'a');
});
