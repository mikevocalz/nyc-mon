import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameScreenActions, gameScreenStore, LOAD_STAGES } from './game-session.ts';

test('load progress only moves forward and lands on 100 with the first frame', () => {
  gameScreenActions.resetForMount();
  assert.equal(gameScreenStore.getState().loadProgress, 0);
  gameScreenActions.loadStage('moduleLoaded');
  gameScreenActions.loadStage('requested');
  assert.equal(gameScreenStore.getState().loadProgress, LOAD_STAGES.moduleLoaded);
  gameScreenActions.loadStage('worldBuilt');
  gameScreenActions.firstFrame();
  assert.equal(gameScreenStore.getState().loadProgress, 100);
});

test('a new mount and Retry start the bar again from zero', () => {
  gameScreenActions.loadStage('worldBuilt');
  gameScreenActions.retry();
  assert.equal(gameScreenStore.getState().loadProgress, 0);
  gameScreenActions.loadStage('firstRender');
  gameScreenActions.resetForMount();
  assert.equal(gameScreenStore.getState().loadProgress, 0);
});
