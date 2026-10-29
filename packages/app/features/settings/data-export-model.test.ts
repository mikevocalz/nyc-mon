// M19 Download your data: the file's shape and name.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_DEVICE_PREFS } from './device-prefs-model.ts';
import { buildDataExport, DATA_EXPORT_FORMAT, dataExportFileName, rawSaveForExport } from './data-export-model.ts';

const NOW = Date.UTC(2026, 9, 28, 12);

test('a signed-in export carries the save, the settings and the account', () => {
  const account = { email: 'a@b.co', name: 'Mike', birthYear: 1990, createdAt: null, signInMethods: ['credential', 'apple'] };
  const out = buildDataExport({ save: { v: 1 }, prefs: DEFAULT_DEVICE_PREFS, account, accountUnavailable: false, nowMs: NOW });
  assert.equal(out.format, DATA_EXPORT_FORMAT);
  assert.equal(out.exportedAt, '2026-10-28T12:00:00.000Z');
  assert.deepEqual(out.device, { save: { v: 1 }, settings: DEFAULT_DEVICE_PREFS });
  assert.deepEqual(out.account, account);
  assert.deepEqual(out.notes, []);
});

test('signed out, no save: both gaps are written down, not hidden', () => {
  const out = buildDataExport({ save: null, prefs: DEFAULT_DEVICE_PREFS, account: null, accountUnavailable: false, nowMs: NOW });
  assert.deepEqual(out.notes, ['No game save on this device.', 'Not signed in: no account copy.']);
});

test('an unreadable save still goes out, as text', () => {
  assert.equal(rawSaveForExport(undefined), null);
  assert.deepEqual(rawSaveForExport('{"a":1}'), { a: 1 });
  assert.deepEqual(rawSaveForExport('{broken'), { unreadable: '{broken' });
});

test('file name is the UTC date', () => {
  assert.equal(dataExportFileName(NOW), 'nyc-mon-export-2026-10-28.json');
});
