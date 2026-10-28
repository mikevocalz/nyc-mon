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
  assert.match(legal, /<LicenceLink label=\{credit\.linkLabel\} url=\{credit\.url\} \/>/);
});

test('the on-map attribution lists data only, so the Slop credit stays off it', () => {
  const map = source('../game/MapAttribution.tsx');
  assert.doesNotMatch(map, /slop/i);
  assert.match(map, /OSM_COPYRIGHT_URL/);
});

test('every licence link in Legal & credits is a 48pt target announced as a link', () => {
  const settings = source('./settings-content.tsx');
  const link = settings.slice(settings.indexOf('function LicenceLink'), settings.indexOf('M20 Delete account'));
  assert.match(link, /role="link"/);
  assert.match(link, /className="min-h-target min-w-target /);
  assert.match(link, /Linking\.openURL\(url\)/);
  const legal = settings.slice(settings.indexOf('Legal &amp; credits'));
  // No bare caption-sized Text link is left: the only openURL is inside LicenceLink.
  assert.equal(settings.match(/Linking\.openURL/g)?.length, 1);
  assert.equal(legal.match(/<LicenceLink /g)?.length, 4);
});

test('the Preferences switches are gone: nothing stored or read them', () => {
  const settings = source('./settings-content.tsx');
  assert.doesNotMatch(settings, /label="(Push notifications|Weekly email digest|Public profile)"/);
  assert.doesNotMatch(settings, /<Switch\b/);
  // Code only: the STRUCK comment names the flags on purpose.
  const profile = source('../profile/profile.store.ts').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(profile, /\b(digest|publicProfile|setNotifications)\b/);
});

test('the Session card mounts Delete account: confirm with Cancel first, error with retry, then Welcome', () => {
  const settings = source('./settings-content.tsx');
  const row = settings.slice(settings.indexOf('function DeleteAccountRow'), settings.indexOf('function SessionCard'));
  assert.match(row, /if \(!hasAccount\) return null/);
  assert.match(row, /router\.replace\(DELETED_PATH\)/);
  assert.ok(row.indexOf("hatchCopy('m09.edit.cancel')") < row.indexOf("copy('settings.delete.confirm.action')"), 'Cancel comes first');
  assert.match(row, /copy\('settings\.delete\.confirm\.body'\)/);
  assert.match(row, /<ErrorMessage message=\{copy\(flow\.errorId\)\} \/>/);
  assert.match(row, /copy\('settings\.delete\.retry'\)/);
  assert.match(settings, /<DeleteAccountRow \/>/);
});
