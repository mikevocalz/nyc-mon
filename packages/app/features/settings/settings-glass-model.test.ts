// The Settings list on the H-Lynk glass: rows, paging, credits wrapping and
// the route wiring. The model is pure; the screen and its route are checked
// in source, as settings-content.test.ts does, because node --test cannot
// render a .tsx tree. A rendered frame on a device stays pending.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CITY_MAP_ASSETS, CITY_MAP_SOURCES } from '../game/map-data-credit.ts';
import {
  clampCursor, CONFIRM_LINES, CREDIT_LINE_CHARS, creditLines, deleteConfirmLines, pageAround, rowText, settingsRows, wrapWords,
} from './settings-glass-model.ts';
import { nextOf, THEME_OPTIONS } from './theme-options.ts';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('rows: Caller name first when a Caller exists, Sign out last; device rows only when given', () => {
  const rows = settingsRows({ callerName: 'Mike', theme: 'dark', timeOfDay: 'twilight' });
  assert.deepEqual(rows.map((r) => r.id), ['caller', 'theme', 'timeOfDay', 'controls', 'export', 'legal', 'credits', 'signOut']);
  assert.equal(rowText(rows[0]!), 'Caller name · Mike');
  assert.equal(rowText(rows[1]!), 'Theme · Dark');
  assert.equal(rowText(rows[2]!), 'Time of day · Dusk');
  assert.equal(rowText(rows[3]!), 'Game controls');
  assert.equal(rows[7]!.verb, 'Sign out');
  assert.equal(rows[7]!.hint, 'Sign out on this device only.');
});

test('rows: no Caller, no Caller row; physical city off, no Time of day row', () => {
  const rows = settingsRows({ callerName: null, theme: 'system', timeOfDay: null });
  assert.deepEqual(rows.map((r) => r.id), ['theme', 'controls', 'export', 'legal', 'credits', 'signOut']);
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

test('Delete account is the last row, only with an account, and selecting it only opens the question', () => {
  const base = { callerName: 'Ray', theme: 'dark' as const, timeOfDay: null };
  assert.equal(settingsRows(base).some((r) => r.id === 'deleteAccount'), false);
  assert.equal(settingsRows({ ...base, hasAccount: false }).some((r) => r.id === 'deleteAccount'), false);
  const rows = settingsRows({ ...base, hasAccount: true });
  const last = rows[rows.length - 1];
  assert.equal(last?.id, 'deleteAccount');
  assert.equal(last?.label, 'Delete account');
  assert.equal(last?.verb, 'Open');
});

test('the glass question shows the warning, or the error in its place, within eight caption lines', () => {
  const body = deleteConfirmLines(undefined);
  assert.ok(body.length > 1 && body.length <= CONFIRM_LINES);
  assert.ok(body.every((line) => line.length <= CREDIT_LINE_CHARS || !line.includes(' ')));
  assert.equal(body.join(' '), 'This deletes your email, Caller name, birth year and sign-in methods right away, and clears the save on this device. Your Mon goes to stay with Dr. Santoro. You can\u2019t undo this.');
  assert.deepEqual(deleteConfirmLines('Try again.'), ['Try again.']);
});

test('the glass Delete question: Cancel is the default, the trackpad and Back cancel', () => {
  const glass = readFileSync(new URL('./SettingsGlass.tsx', import.meta.url), 'utf8');
  const view = glass.slice(glass.indexOf("s.mode === 'deleteAccount') {\n    label"), glass.indexOf("} else if (s.mode === 'credits') {\n    label"));
  assert.match(view, /target: 'cancel', label: cancel, tone: 'primary'/);
  assert.ok(view.indexOf("target: 'cancel'") < view.indexOf("target: 'delete'"));
  assert.match(glass, /mode === 'deleteAccount'\) \{\n      \/\/ Same rule: the trackpad and Back answer Cancel, never Delete\.\n      if \(leaving \|\| key === 'activate'\) toList\(\);/);
  assert.match(glass, /useDeleteAccountFlow\(\(\) => router\.replace\(DELETED_PATH\)\)/);
});

test('rows: M19/M20 rows in reading order, switches say On or Off', () => {
  const rows = settingsRows({
    callerName: 'Mike', theme: 'dark', timeOfDay: null, hasAccount: true, email: 'mike@example.com',
    notify: true, haptics: false, sound: true, motion: false,
  });
  assert.deepEqual(rows.map((r) => r.id), [
    'account', 'caller', 'notify', 'haptics', 'sound', 'motion', 'theme', 'controls', 'export', 'legal', 'credits', 'signOut', 'deleteAccount',
  ]);
  assert.equal(rowText(rows[0]!), 'Account · mike@example.com');
  assert.equal(rowText(rows[2]!), 'Egg alerts · On');
  assert.equal(rowText(rows[3]!), 'Haptics · Off');
  assert.equal(rows[8]!.verb, 'Download');
});

test('rows: no Egg alerts row where notifications are unsupported; a blocked OS opens Settings', () => {
  assert.ok(!settingsRows({ callerName: null, theme: 'dark', timeOfDay: null, notify: null }).some((r) => r.id === 'notify'));
  const [row] = settingsRows({ callerName: null, theme: 'dark', timeOfDay: null, notify: false, notifyDenied: true });
  assert.equal(row!.id, 'notify');
  assert.equal(row!.verb, 'Open phone Settings');
});

test('rows: Mon calls sits after Egg alerts, says On or Off, and opens Settings when the OS blocks alerts', () => {
  const rows = settingsRows({ callerName: null, theme: 'dark', timeOfDay: null, notify: true, monCalls: false });
  assert.deepEqual(rows.slice(0, 2).map((r) => r.id), ['notify', 'monCalls']);
  assert.equal(rowText(rows[1]!), 'Mon calls · Off');
  assert.equal(rows[1]!.hint, 'An alert when your Mon needs food, rest, play, medicine or bedtime. Never while paused.');
  const blocked = settingsRows({ callerName: null, theme: 'dark', timeOfDay: null, notify: false, monCalls: false, notifyDenied: true });
  assert.equal(blocked.find((r) => r.id === 'monCalls')!.verb, 'Open phone Settings');
  assert.ok(!settingsRows({ callerName: null, theme: 'dark', timeOfDay: null, monCalls: null }).some((r) => r.id === 'monCalls'));
});
