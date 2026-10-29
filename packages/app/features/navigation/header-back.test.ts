import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backAction, headerBack } from './header-back.ts';

describe('header back button', () => {
  it('is absent on the five primary tabs', () => {
    for (const p of ['/', '/home', '/game', '/mons', '/profile']) assert.equal(headerBack(p), null, p);
  });

  it('is absent where the shell is hidden (those screens draw their own)', () => {
    for (const p of ['/welcome', '/age', '/consent', '/sign-in', '/caller', '/meet', '/incubate', '/hatch', '/legal/terms']) {
      assert.equal(headerBack(p), null, p);
    }
  });

  it('keeps each screen\'s fallback and spoken label', () => {
    assert.deepEqual(headerBack('/sync'), { fallback: '/(home)', label: 'Back' });
    assert.deepEqual(headerBack('/mons/dex-002'), { fallback: '/(home)/mons', label: 'All Mons' });
    assert.deepEqual(headerBack('/settings'), { fallback: '/(home)', label: 'Back' });
    assert.deepEqual(headerBack('/journal'), { fallback: null, label: 'Back' });
    assert.deepEqual(headerBack('/mon/abc'), { fallback: null, label: 'Back' });
  });

  it('covers every other shell route with a plain back and the kit label', () => {
    for (const p of ['/notifications', '/game-controls', '/error', '/feed', '/rest', '/social', '/name']) {
      assert.deepEqual(headerBack(p), { fallback: null, label: undefined }, p);
    }
  });

  it('pops when there is history, else replaces to the fallback, else shows nothing', () => {
    const sync = headerBack('/sync');
    const journal = headerBack('/journal');
    assert.ok(sync && journal);
    assert.deepEqual(backAction(sync, true), { kind: 'pop' });
    assert.deepEqual(backAction(sync, false), { kind: 'replace', href: '/(home)' });
    assert.deepEqual(backAction(journal, true), { kind: 'pop' });
    assert.equal(backAction(journal, false), null);
  });

  it('does not treat look-alike paths as the mapped screens', () => {
    assert.deepEqual(headerBack('/mons/dex-002/extra'), { fallback: null, label: undefined });
    assert.deepEqual(headerBack('/synced'), { fallback: null, label: undefined });
  });
});
