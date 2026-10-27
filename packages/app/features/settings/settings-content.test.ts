// Graphics card (time-of-day row) and the Software credit in Legal &
// credits. The option table and credit row are pure and pinned here
// against COPY_DECK; the screen wiring is checked in its source, the same
// way map-data-credit.test.ts checks the map credits, because node --test
// cannot render a .tsx tree. A rendered frame stays device-pending.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_PHYSICAL_PRESET, PHYSICAL_PRESET_IDS } from '../game/world/physical-look.ts';
import { createTimeOfDayStore } from '../game/world/time-of-day.store.ts';
import { SOFTWARE_CREDITS, SOFTWARE_CREDITS_GROUP } from './software-credits.ts';
import { TIME_OF_DAY_COPY, TIME_OF_DAY_OPTIONS } from './time-of-day-options.ts';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('time-of-day options: COPY_DECK labels, Dusk first, every preset exactly once', () => {
  assert.deepEqual(
    TIME_OF_DAY_OPTIONS.map((o) => [o.value, o.label]),
    [
      ['twilight', 'Dusk'],
      ['golden', 'Golden hour'],
      ['midday', 'Midday'],
      ['midnight', 'Night'],
    ],
  );
  assert.equal(TIME_OF_DAY_OPTIONS[0]?.value, DEFAULT_PHYSICAL_PRESET);
  assert.deepEqual([...TIME_OF_DAY_OPTIONS.map((o) => o.value)].sort(), [...PHYSICAL_PRESET_IDS].sort());
  assert.equal(TIME_OF_DAY_COPY.label, 'Time of day');
  assert.equal(TIME_OF_DAY_COPY.hint, 'Changes the light in the city. Your game is not affected.');
  for (const o of TIME_OF_DAY_OPTIONS) assert.ok(o.label.length <= 12, `${o.label} fits COPY_DECK max 12`);
});

test('every option value is one the time-of-day store accepts', () => {
  const store = createTimeOfDayStore();
  for (const { value } of TIME_OF_DAY_OPTIONS) {
    store.getState().setPreset(value);
    assert.equal(store.getState().preset, value);
  }
});

test('the time-of-day row: named for screen readers, 2x2 on phones, captioned once', () => {
  const row = source('./TimeOfDayRow.tsx');
  assert.match(row, /aria-label=\{TIME_OF_DAY_COPY\.label\}/);
  assert.match(row, /<SegmentedControl/);
  assert.match(row, /segmentClassName="basis-\[40%\] sm:basis-auto"/);
  assert.equal(row.match(/TIME_OF_DAY_COPY\.hint/g)?.length, 1);
  assert.doesNotMatch(row, /\buse(State|Reducer)\b/);
});

test('Settings mounts the Graphics card: native only, behind the physical flag, bound to timeOfDayStore', () => {
  const settings = source('./settings-content.tsx');
  assert.match(settings, /<GraphicsCard\b[^>]*\/>/);
  assert.match(settings, /process\.env\.EXPO_OS === 'web' \|\| !EXPERIMENTAL_WORLD_PHYSICAL\) return null/);
  assert.match(settings, /useTimeOfDay\(\(s\) => s\.preset\)/);
  assert.match(settings, /useTimeOfDay\(\(s\) => s\.setPreset\)/);
  assert.match(settings, /<TimeOfDayRow value=\{preset\} onChange=\{setPreset\} \/>/);
});

test('the Slop credit: the spec line verbatim, its own Software group, linked to the repository', () => {
  assert.equal(SOFTWARE_CREDITS_GROUP, 'Software');
  assert.deepEqual(SOFTWARE_CREDITS, [
    {
      line: 'Rendering techniques adapted from Slop New York by Mr.doob (MIT)',
      linkLabel: 'View the Slop New York repository',
      url: 'https://github.com/mrdoob/slop-newyork',
    },
  ]);
  const settings = source('./settings-content.tsx');
  const legal = settings.slice(settings.indexOf('Legal &amp; credits'));
  // Below the data groups, so the row never reads as a data credit.
  assert.ok(legal.indexOf('SOFTWARE_CREDITS_GROUP') > legal.indexOf('CITY_MAP_ASSETS.map'));
  assert.match(legal, /Linking\.openURL\(credit\.url\)/);
  assert.match(legal, /\{credit\.linkLabel\}/);
});

test('the on-map attribution lists data only, so the Slop credit stays off it', () => {
  const map = source('../game/MapAttribution.tsx');
  assert.doesNotMatch(map, /slop/i);
  assert.match(map, /OSM_COPYRIGHT_URL/);
});
