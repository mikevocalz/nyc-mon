import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LeaderboardPage } from '@acme/core';
import { createLobbyStore } from './lobby.store.ts';

const READY: LeaderboardPage = {
  status: 'ready',
  rows: [{ rank: 1, playerId: 'p1', displayName: 'Vesper', score: 10, isSelf: false }],
};
const UNAVAILABLE: LeaderboardPage = { status: 'error', rows: [], reason: 'no-ranking-authority' };

describe('lobbyStore', () => {
  it('starts in the lobby, uncovered, with START idle and no resume decided', () => {
    const store = createLobbyStore();
    const s = store.getState();
    assert.equal(s.phase, 'lobby');
    assert.equal(s.resume, null);
    assert.equal(s.leaderboard, 'loading');
    assert.equal(s.startState, 'idle');
    assert.equal(s.transitionPhase, 'done');
  });

  it('beginStart moves to the transition with the cover entering, and only once', () => {
    const store = createLobbyStore();
    assert.equal(store.getState().beginStart(), true);
    assert.equal(store.getState().phase, 'transition');
    assert.equal(store.getState().startState, 'loading');
    assert.equal(store.getState().transitionPhase, 'enter');
    // A second press while loading is ignored: one session start per press.
    assert.equal(store.getState().beginStart(), false);
  });

  it('finishStart hands the tab to the game; failStart returns to the lobby with the reason', () => {
    const store = createLobbyStore();
    store.getState().beginStart();
    store.getState().setTransitionPhase('reveal');
    store.getState().finishStart();
    assert.equal(store.getState().phase, 'game');
    assert.equal(store.getState().transitionPhase, 'done');
    assert.equal(store.getState().startState, 'idle');
    store.getState().returnToLobby();
    store.getState().beginStart();
    store.getState().failStart('boom');
    assert.equal(store.getState().phase, 'lobby');
    assert.equal(store.getState().startError, 'boom');
    assert.equal(store.getState().startState, 'idle');
    // The next press clears the old reason.
    store.getState().beginStart();
    assert.equal(store.getState().startError, null);
  });

  it('a refetch keeps the previous rows; an empty answer is not kept', () => {
    const store = createLobbyStore();
    store.getState().setLeaderboard(READY);
    store.getState().beginLeaderboardLoad();
    assert.equal(store.getState().leaderboard, 'loading');
    assert.equal(store.getState().previousLeaderboard, READY);
    store.getState().setLeaderboard(UNAVAILABLE);
    store.getState().beginLeaderboardLoad();
    assert.equal(store.getState().previousLeaderboard, READY);
  });

  it('a leaderboard answer never touches the resume decision (fixture 11)', () => {
    const store = createLobbyStore();
    store.getState().setResume({ kind: 'new-game', rejected: [] }, 1_700_000_000_000);
    assert.equal(store.getState().openedAtMs, 1_700_000_000_000);
    store.getState().setLeaderboard(UNAVAILABLE);
    store.getState().beginLeaderboardLoad();
    store.getState().setLeaderboard(READY);
    assert.deepEqual(store.getState().resume, { kind: 'new-game', rejected: [] });
    assert.equal(store.getState().startState, 'idle');
  });
});
