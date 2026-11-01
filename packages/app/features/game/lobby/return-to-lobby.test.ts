import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createWorldSessionStore } from '../world-resume/world-session.store.ts';
import { createLobbyStore } from './lobby.store.ts';
import { bindReturnToLobby, shouldReturnToLobby } from './return-to-lobby.ts';

// Review finding H6: nothing called `returnToLobby` after a STOP.

describe('return to lobby', () => {
  it('a STOP while the game is on screen hands the tab back to the lobby', () => {
    const session = createWorldSessionStore();
    const lobby = createLobbyStore();
    const unsubscribe = bindReturnToLobby(session, lobby);
    lobby.getState().beginStart();
    session.getState().dispatch({ type: 'start', sessionId: 's1', at: 1 });
    lobby.getState().finishStart();
    assert.equal(lobby.getState().phase, 'game');
    session.getState().dispatch({ type: 'stopConfirm', at: 2 });
    assert.equal(lobby.getState().phase, 'game', 'the hold alone does not leave the game');
    session.getState().dispatch({ type: 'confirmStop', at: 3 });
    assert.equal(lobby.getState().phase, 'lobby');
    assert.equal(lobby.getState().startState, 'idle');
    unsubscribe();
  });

  it('pause, resume and a cancelled hold keep the game', () => {
    const session = createWorldSessionStore({ kind: 'playing', sessionId: 's1', startedAt: 1 });
    const lobby = createLobbyStore();
    lobby.getState().beginStart();
    lobby.getState().finishStart();
    bindReturnToLobby(session, lobby);
    session.getState().dispatch({ type: 'pillPress', at: 2 });
    session.getState().dispatch({ type: 'pillPress', at: 3 });
    session.getState().dispatch({ type: 'stopConfirm', at: 4 });
    session.getState().dispatch({ type: 'cancelStop', at: 5 });
    assert.equal(lobby.getState().phase, 'game');
  });

  it('only a session ending during the game counts', () => {
    const playing = { kind: 'playing', sessionId: 's', startedAt: 0 } as const;
    assert.equal(shouldReturnToLobby(playing, { kind: 'idle' }, 'game'), true);
    assert.equal(shouldReturnToLobby(playing, { kind: 'idle' }, 'transition'), false);
    assert.equal(shouldReturnToLobby({ kind: 'idle' }, { kind: 'idle' }, 'game'), false);
  });
});
