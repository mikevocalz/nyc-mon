import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ArcadeViewModelInstance } from '../game-controls/rive-binding.ts';
import { createLobbyRiveBinding, LOBBY_ROWS_AUTHORED, type LobbyViewModelInstance } from './lobby-rive-binding.ts';

/** A fake instance that records every write and can hide paths like an older artboard would. */
function fakeInstance(hidden: readonly string[] = []) {
  const writes: [string, unknown][] = [];
  const lookups: string[] = [];
  const property = (path: string) => {
    lookups.push(path);
    if (hidden.includes(path)) return undefined;
    return { set: (value: unknown) => { writes.push([path, value]); } };
  };
  const instance: ArcadeViewModelInstance = {
    numberProperty: property,
    booleanProperty: property,
    enumProperty: property,
    stringProperty: property,
  };
  return { instance, writes, lookups };
}

/** A fake with a `leaderboard/rows` list of `count` items; item writes are recorded as `item<n>/<field>`. */
function listInstance(count: number) {
  const writes: [string, unknown][] = [];
  const lookups: string[] = [];
  const item = (index: number): ArcadeViewModelInstance => {
    const property = (path: string) => {
      lookups.push(`item${index}:${path}`);
      return { set: (value: unknown) => { writes.push([`item${index}/${path}`, value]); } };
    };
    return { numberProperty: property, booleanProperty: property, enumProperty: property, stringProperty: property };
  };
  const base = fakeInstance();
  const instance: LobbyViewModelInstance = {
    ...base.instance,
    listProperty: (path: string) => {
      lookups.push(path);
      if (path !== 'leaderboard/rows') return undefined;
      return { getInstanceAtAsync: async (index: number) => (index < count ? item(index) : undefined) };
    },
  };
  return { instance, writes, lookups };
}

describe('createLobbyRiveBinding', () => {
  it('writes the data-contract paths for resume, START, transition, theme, layout and reduced motion', () => {
    const { instance, writes } = fakeInstance();
    const binding = createLobbyRiveBinding(instance);
    binding.setResume(true, 'Harlem');
    binding.setStartState('loading');
    binding.setStartPressed(true);
    binding.setStartFocused(true);
    binding.setTransitionPhase('reveal');
    binding.setTheme('daylit');
    binding.setLayoutProfile('fold-book');
    binding.setReducedMotion(true);
    assert.deepEqual(writes, [
      ['lobby/resume/eligible', true],
      ['lobby/resume/district', 'Harlem'],
      ['lobby/start/state', 'loading'],
      ['lobby/start/pressed', true],
      ['lobby/start/focused', true],
      ['transition/phase', 'reveal'],
      ['theme/variant', 'daylit'],
      ['layout/profile', 'fold-book'],
      ['a11y/reducedMotion', true],
    ]);
  });

  it('writes rows through leaderboard/rows list items, never a bracketed scalar path (review finding H9)', async () => {
    const { instance, writes, lookups } = listInstance(LOBBY_ROWS_AUTHORED);
    const binding = createLobbyRiveBinding(instance);
    binding.setLeaderboardRows([
      { rank: 1, name: 'Vesper', score: 48200, isSelf: false, playerId: 'p1' },
      { rank: 17, name: 'Sable', isSelf: true, playerId: 'p2' },
    ]);
    await binding.rowsReady;
    assert.ok(!lookups.some((path) => path.includes('[')), `no bracket path is ever looked up: ${lookups.join(', ')}`);
    assert.deepEqual(binding.missingPaths, []);
    assert.equal(writes.length, LOBBY_ROWS_AUTHORED * 4);
    assert.deepEqual(writes.slice(0, 8), [
      ['item0/rank', 1],
      ['item0/name', 'Vesper'],
      ['item0/score', 48200],
      ['item0/isSelf', false],
      ['item1/rank', 17],
      ['item1/name', 'Sable'],
      // An absent score is bound as 0 and hidden by the artboard.
      ['item1/score', 0],
      ['item1/isSelf', true],
    ]);
    // A shorter page clears the slots it leaves.
    assert.deepEqual(writes.slice(8, 12), [
      ['item2/rank', 0],
      ['item2/name', ''],
      ['item2/score', 0],
      ['item2/isSelf', false],
    ]);
  });

  it('writes later pages straight to the resolved items and skips unchanged values', async () => {
    const { instance, writes } = listInstance(LOBBY_ROWS_AUTHORED);
    const binding = createLobbyRiveBinding(instance);
    binding.setLeaderboardRows([]);
    await binding.rowsReady;
    writes.length = 0;
    binding.setLeaderboardRows([{ rank: 2, name: 'Nimbus', isSelf: false, playerId: 'p3' }]);
    assert.deepEqual(writes, [['item0/rank', 2], ['item0/name', 'Nimbus']]);
  });

  it('records a missing list or item and writes the items that exist', async () => {
    const short = listInstance(2);
    const binding = createLobbyRiveBinding(short.instance);
    binding.setLeaderboardRows([{ rank: 1, name: 'Vesper', isSelf: false, playerId: 'p1' }]);
    await binding.rowsReady;
    assert.deepEqual(binding.missingPaths, ['leaderboard/rows[2]', 'leaderboard/rows[3]']);
    assert.equal(short.writes.length, 2 * 4);

    const { instance } = fakeInstance();
    const noList = createLobbyRiveBinding(instance);
    noList.setLeaderboardRows([{ rank: 1, name: 'Vesper', isSelf: false, playerId: 'p1' }]);
    await noList.rowsReady;
    assert.deepEqual(noList.missingPaths, ['leaderboard/rows']);
  });

  it('drops rows that resolve after dispose', async () => {
    const { instance, writes } = listInstance(LOBBY_ROWS_AUTHORED);
    const binding = createLobbyRiveBinding(instance);
    binding.setLeaderboardRows([{ rank: 1, name: 'Vesper', isSelf: false, playerId: 'p1' }]);
    binding.dispose();
    await binding.rowsReady;
    assert.equal(writes.length, 0);
  });

  it('skips writes whose value did not change and looks each handle up once', () => {
    const { instance, writes, lookups } = fakeInstance();
    const binding = createLobbyRiveBinding(instance);
    binding.setLeaderboardStatus('unavailable');
    binding.setLeaderboardStatus('unavailable');
    binding.setLeaderboardStatus('ready');
    assert.equal(writes.length, 2);
    assert.deepEqual(lookups, ['leaderboard/status']);
  });

  it('records a missing path once and keeps writing the rest', () => {
    const { instance, writes } = fakeInstance(['lobby/start/focused']);
    const binding = createLobbyRiveBinding(instance);
    binding.setStartFocused(true);
    binding.setStartFocused(false);
    binding.setStartState('idle');
    assert.deepEqual(binding.missingPaths, ['lobby/start/focused']);
    assert.deepEqual(writes, [['lobby/start/state', 'idle']]);
  });

  it('writes nothing after dispose', () => {
    const { instance, writes } = fakeInstance();
    const binding = createLobbyRiveBinding(instance);
    binding.dispose();
    binding.setTheme('night');
    assert.equal(writes.length, 0);
  });
});
