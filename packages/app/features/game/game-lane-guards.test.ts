import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { INITIAL_SESSION_STATE } from '@acme/core';
import { gameplayInputEnabled, sessionEventsFor } from './game-input-bindings.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'data' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

test('gameplay input waits for the lobby to hand over (finding H1)', () => {
  assert.equal(gameplayInputEnabled(true, 'transition'), false);
  assert.equal(gameplayInputEnabled(true, 'lobby'), false);
  assert.equal(gameplayInputEnabled(false, 'game'), false);
  assert.equal(gameplayInputEnabled(true, 'game'), true);
});

test('a hardware stop request with no session sends nothing to the session (finding L8, app half)', () => {
  assert.deepEqual(sessionEventsFor('stop-request', INITIAL_SESSION_STATE, 1), []);
});

test('no Game feature file imports expo-router (finding M19)', () => {
  const offenders = sourceFiles(HERE).filter((file) => /from ['"]expo-router['"]/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('Game screen copy says H-Lynk, never "device" (Law 9; finding M22)', () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(HERE)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;
      // Quoted UI strings only: identifiers like deviceId and comments are not copy.
      for (const match of line.matchAll(/(['"`])((?:(?!\1).)*)\1/g)) {
        const text = match[2] ?? '';
        // Prose has words separated by spaces; an id template (`device-${…}`) is not copy.
        if (/\bdevice\b/i.test(text) && /[a-z] [a-z]/i.test(text) && !text.includes('${')) offenders.push(`${file}:${index + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});

test('the in-game stop ring times itself from the contract hold (finding M9, app half)', async () => {
  const { STOP_HOLD_MS } = await import('@acme/ui/game-controls/parts');
  assert.equal(typeof STOP_HOLD_MS, 'number');
  const source = readFileSync(join(HERE, 'use-game-input.ts'), 'utf8');
  assert.match(source, /STOP_HOLD_MS,\n\s+createGameInputRouter,[\s\S]*?from '@acme\/ui\/game-controls\/parts'/);
});
