import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// Compile the real WidgetKit entry and timeline, not a JavaScript model of Swift.
test('keychain timeline handles requests at and after a predicted call', { skip: process.platform !== 'darwin' }, () => {
  const out = mkdtempSync(join(tmpdir(), 'keychain-timeline-'));
  const widget = fileURLToPath(new URL('../../targets/keychain-widget/', import.meta.url));
  try {
    const binary = join(out, 'timeline-test');
    execFileSync('xcrun', ['swiftc', '-o', binary,
      join(widget, 'KeychainSnapshot.swift'), join(widget, 'KeychainState.swift'),
      join(widget, 'KeychainEntry.swift'), join(widget, 'KeychainTimeline.swift'),
      fileURLToPath(new URL('./fixtures/keychain-timeline/main.swift', import.meta.url)),
    ], { stdio: 'pipe' });
    assert.match(execFileSync(binary, { encoding: 'utf8' }), /regression cases passed/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
