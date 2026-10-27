// The Settings list on the H-Lynk glass: rows, paging, credits wrapping and
// the route wiring. The model is pure; the screen and its route are checked
// in source, as settings-content.test.ts does, because node --test cannot
// render a .tsx tree. A rendered frame on a device stays pending.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CITY_MAP_ASSETS, CITY_MAP_SOURCES } from '../game/map-data-credit.ts';
import {
  clampCursor, CREDIT_LINE_CHARS, creditLines, pageAround, rowText, settingsRows, wrapWords,
} from './settings-glass-model.ts';
import { nextOf, THEME_OPTIONS } from './theme-options.ts';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('rows: Caller name first when a Caller exists, Sign out last, no sound row', () => {
  const rows = settingsRows({ callerName: 'Mike', theme: 'dark', timeOfDay: 'twilight' });
  assert.deepEqual(rows.map((r) => r.id), ['caller', 'theme', 'timeOfDay', 'controls', 'legal', 'credits', 'signOut']);
  assert.equal(rowText(rows[0]!), 'Caller name · Mike');
  assert.equal(rowText(rows[1]!), 'Theme · Dark');
  assert.equal(rowText(rows[2]!), 'Time of day · Dusk');
  assert.equal(rowText(rows[3]!), 'Game controls');
  assert.equal(rows[6]!.verb, 'Sign out');
  assert.equal(rows[6]!.hint, 'Sign out on this device only.');
});

test('rows: no Caller, no Caller row; physical city off, no Time of day row', () => {
  const rows = settingsRows({ callerName: null, theme: 'system', timeOfDay: null });
  assert.deepEqual(rows.map((r) => r.id), ['theme', 'controls', 'legal', 'credits', 'signOut']);
  assert.equal(rows[0]!.value, 'System');
});

test('rows: the Caller row says Saved. after a rename', () => {
  const [caller] = settingsRows({ callerName: 'Mike', callerSaved: true, theme: 'dark', timeOfDay: null });
  assert.equal(caller!.hint, 'Saved.');
});

test('theme cycles System, Light, Dark and wraps', () => {
  assert.deepEqual(THEME_OPTIONS.map((o) => o.value), ['system', 'light', 'dark']);
  assert.equal(nextOf(THEME_OPTIONS, 'system'), 'light');
  assert.equal(nextOf(THEME_OPTIONS, 'dark'), 'system');
});

test('paging keeps the highlight on its page', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  assert.deepEqual(pageAround(items, 0, 6), { start: 0, items: ['a', 'b', 'c', 'd', 'e', 'f'] });
  assert.deepEqual(pageAround(items, 6, 6), { start: 6, items: ['g', 'h'] });
  assert.deepEqual(pageAround(items, 99, 6).start, 6);
  assert.equal(clampCursor(-1, 3), 0);
  assert.equal(clampCursor(5, 3), 2);
  assert.equal(clampCursor(0, 0), 0);
});

test('wrapWords breaks on spaces and never drops a word', () => {
  const text = 'DOB NOW Facades compliance filings (FISP/Local Law 11), via Valdrada';
  const lines = wrapWords(text, 40);
  assert.ok(lines.every((l) => l.length <= 40));
  assert.equal(lines.join(' '), text);
  assert.deepEqual(wrapWords('averyveryverylongword x', 5), ['averyveryverylongword', 'x']);
});

test('credits: every 2D credit, wrapped to the glass, in the 2D order', () => {
  const lines = creditLines();
  const joined = lines.map((l) => l.text).join(' ');
  for (const s of [...CITY_MAP_SOURCES, ...CITY_MAP_ASSETS]) {
    assert.ok(joined.includes(s.attribution), s.attribution);
    assert.ok(joined.includes(s.license), s.license);
  }
  assert.ok(lines.every((l) => l.text.length <= CREDIT_LINE_CHARS || !l.text.includes(' ')));
  const groups = lines.filter((l) => l.kind === 'group').map((l) => l.text);
  assert.deepEqual(groups, ['Map data', 'Models & textures', 'Software']);
});

test('the H-Lynk menu opens Settings inside (home), on the glass', () => {
  assert.match(source('../companion/HomeScreen.tsx'), /router\.push\('\/\(home\)\/settings'\)/);
  assert.doesNotMatch(source('../companion/HomeScreen.tsx'), /\(drawer\)\/settings/);
  const route = source('../../../../apps/mobile/app/(home)/settings.tsx');
  assert.match(route, /SettingsGlass/);
  const screen = source('./SettingsGlass.tsx');
  assert.match(screen, /<GlassStage\b/);
  // The 2D page only as the fallback.
  assert.match(screen, /if \(!glassOn\) return <SettingsScreen /);
  assert.doesNotMatch(screen, /\buse(State|Reducer)\b/);
});

test('renaming uses the shared M07 rules in both the card and the glass', () => {
  const editor = source('./caller-name-editor.ts');
  assert.match(editor, /validateCallerName\([^)]*defaultCallerNameFilter\)/);
  assert.match(editor, /renameCaller\(/);
  assert.match(editor, /useProfile\.getState\(\)\.setName\(/);
  assert.match(source('./CallerNameCard.tsx'), /useCallerNameEditor\(\)/);
  assert.match(source('./SettingsGlass.tsx'), /useCallerNameEditor\(\)/);
});
