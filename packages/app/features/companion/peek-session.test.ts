import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStore } from 'zustand/vanilla';
import type { PeekRound } from '@acme/core/types';
import { settlePeekPlay, type PeekSettleState } from './peek-session.ts';

const found: PeekRound = { hiddenAt: 'left', guesses: ['left'] };
const missed: PeekRound = { hiddenAt: 'right', guesses: ['left', 'right'] };

function session(rounds: PeekRound[]) {
  return createStore<PeekSettleState>(() => ({ rounds, applied: false }));
}

describe('M16 Peek session settle', () => {
  it('writes one play when a session with finished rounds is left by unmount alone', () => {
    const s = session([found, missed]);
    const writes: number[] = [];
    // Android back / route change: only the unmount cleanup runs.
    settlePeekPlay(s, (q) => writes.push(q));
    assert.equal(writes.length, 1);
    assert.ok(writes[0]! > 0 && writes[0]! <= 1);
  });

  it('keeps one write when Done ran first and the unmount cleanup runs after', () => {
    const s = session([found]);
    const writes: number[] = [];
    settlePeekPlay(s, (q) => writes.push(q)); // Done / leave
    settlePeekPlay(s, (q) => writes.push(q)); // unmount
    assert.equal(writes.length, 1);
  });

  it('writes nothing when no round finished', () => {
    const s = session([]);
    let calls = 0;
    assert.equal(settlePeekPlay(s, () => { calls += 1; }), false);
    assert.equal(calls, 0);
    assert.equal(s.getState().applied, false);
  });
});
