import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  KEYCHAIN_SNAPSHOT_VERSION,
  KEYCHAIN_STALE_MS,
  buildKeychainSnapshot,
  KEYCHAIN_HEARTBEAT_MS,
  keychainSignature,
  shouldWriteKeychain,
  type KeychainInput,
  type MonCareViewLike,
} from './keychain-snapshot.ts';
import { BANNED_CARE_WORDS } from './care-copy.ts';

const NOW = Date.UTC(2026, 9, 29, 15, 0);
const HOUR = 3_600_000;

const view = (over: Partial<MonCareViewLike> = {}): MonCareViewLike => ({
  hearts: { fullness: 3, social: 2, energy: 4 },
  poop: 0,
  cold: null,
  asleep: false,
  paused: false,
  attention: 'none',
  ...over,
});

const input = (over: Partial<KeychainInput> = {}): KeychainInput => ({
  monName: 'Squeaklet',
  view: view(),
  predictions: [],
  now: NOW,
  ...over,
});

describe('buildKeychainSnapshot', () => {
  it('carries the contract fields plus the widget strings', () => {
    const snap = buildKeychainSnapshot(input());
    assert.deepEqual(snap, {
      v: KEYCHAIN_SNAPSHOT_VERSION,
      monName: 'Squeaklet',
      hearts: { fullness: 3, energy: 4, social: 2 },
      attention: 'none',
      poop: 0,
      cold: false,
      asleep: false,
      paused: false,
      nextCallAt: null,
      updatedAt: NOW,
      staleAt: NOW + KEYCHAIN_STALE_MS,
      text: {
        title: 'Squeaklet',
        status: 'Squeaklet is content',
        calling: 'Squeaklet is calling',
        detail: null,
        a11y: 'Squeaklet. Squeaklet is content. Fullness 3 of 4, Energy 4 of 4, Social 2 of 4.',
        a11yCalling: 'Squeaklet. Squeaklet is calling. Fullness 3 of 4, Energy 4 of 4, Social 2 of 4.',
        stale: 'Open NYC-MON to update',
        meters: { fullness: 'Fullness', energy: 'Energy', social: 'Social' },
      },
    });
  });

  it('lights the LED for any open call, real or false, as the in-app lamp does (D20d, keychain.calling)', () => {
    for (const attention of ['call', 'false-call'] as const) {
      const snap = buildKeychainSnapshot(input({ view: view({ attention }) }));
      assert.equal(snap.attention, 'call', attention);
      assert.equal(snap.text.status, 'Squeaklet is calling');
    }
  });

  it('says asleep, and a call outranks sleep (bedtime with the light on)', () => {
    assert.equal(buildKeychainSnapshot(input({ view: view({ asleep: true }) })).text.status, 'Squeaklet is asleep');
    assert.equal(buildKeychainSnapshot(input({ view: view({ asleep: true, attention: 'call' }) })).text.status, 'Squeaklet is calling');
  });

  it('while paused: Paused, no LED, no next call', () => {
    const snap = buildKeychainSnapshot(input({
      view: view({ paused: true, attention: 'call' }),
      predictions: [{ kind: 'hunger', at: NOW + HOUR }],
    }));
    assert.equal(snap.paused, true);
    assert.equal(snap.attention, 'none');
    assert.equal(snap.nextCallAt, null);
    assert.equal(snap.text.status, 'Paused');
  });

  it('names when the next real call opens, so the widget lights up on time without the app', () => {
    const snap = buildKeychainSnapshot(input({
      predictions: [{ kind: 'false-call', at: NOW + HOUR }, { kind: 'social', at: NOW + 3 * HOUR }, { kind: 'energy', at: NOW + 2 * HOUR }],
    }));
    assert.equal(snap.nextCallAt, NOW + 2 * HOUR);
  });

  it('a second line for a cold and for piles', () => {
    assert.equal(buildKeychainSnapshot(input({ view: view({ cold: { dosesRemaining: 2 } }) })).text.detail, 'Has a cold');
    assert.equal(buildKeychainSnapshot(input({ view: view({ poop: 1 }) })).text.detail, '1 pile');
    assert.equal(buildKeychainSnapshot(input({ view: view({ poop: 3, cold: { dosesRemaining: 1 } }) })).text.detail, 'Has a cold · 3 piles');
  });

  it('clamps hearts and piles to 0..4 and tidies the name', () => {
    const snap = buildKeychainSnapshot(input({
      monName: '   ',
      view: view({ hearts: { fullness: 9 as never, social: -1 as never, energy: 2.6 as never }, poop: 7 as never }),
    }));
    assert.deepEqual(snap.hearts, { fullness: 4, energy: 2, social: 0 });
    assert.equal(snap.poop, 4);
    assert.equal(snap.monName, 'Your Mon');
    assert.equal(buildKeychainSnapshot(input({ monName: 'A'.repeat(40) })).monName.length, 24);
  });

  it('never says a banned word', () => {
    const snap = buildKeychainSnapshot(input({ view: view({ cold: { dosesRemaining: 2 }, poop: 2, attention: 'call' }) }));
    for (const line of Object.values(snap.text)) if (typeof line === 'string') assert.doesNotMatch(line, BANNED_CARE_WORDS);
  });
});

describe('keychainSignature', () => {
  it('ignores the clock, so a quiet minute tick spends no widget reload', () => {
    assert.equal(keychainSignature(buildKeychainSnapshot(input())), keychainSignature(buildKeychainSnapshot(input({ now: NOW + 60_000 }))));
  });

  it('changes when anything the widget draws changes', () => {
    const a = buildKeychainSnapshot(input());
    const b = buildKeychainSnapshot(input({ view: view({ hearts: { fullness: 2, social: 2, energy: 4 } }) }));
    assert.notEqual(keychainSignature(a), keychainSignature(b));
  });
});

describe('shouldWriteKeychain', () => {
  const snap = (now: number) => buildKeychainSnapshot(input({ now }));

  it('writes the first time, on any visible change, and on the heartbeat', () => {
    assert.equal(shouldWriteKeychain(null, snap(NOW)), true);
    const prev = { signature: keychainSignature(snap(NOW)), at: NOW };
    assert.equal(shouldWriteKeychain(prev, snap(NOW + 60_000)), false);
    assert.equal(shouldWriteKeychain(prev, snap(NOW + KEYCHAIN_HEARTBEAT_MS)), true);
    assert.equal(shouldWriteKeychain(prev, buildKeychainSnapshot(input({ now: NOW + 60_000, view: view({ attention: 'call' }) }))), true);
  });
});
