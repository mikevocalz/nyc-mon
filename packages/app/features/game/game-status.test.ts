import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { INITIAL_CITY_CAMERA } from './city-camera.ts';
import { cityDatasetBounds, isOverMappedArea } from './city-bounds.ts';
import { parseCityDataset } from './city-dataset.ts';
import { resolveGameViewState, shouldMountCanvas, type GameStatusInput } from './game-status.ts';
import { withFirstFrameSignal } from './load-game-scene.ts';

const ok: GameStatusInput = { dataset: 'ok', gpu: 'supported', canvasFailed: false, firstFrame: true, overMappedArea: true };

test('every state resolves, with data and GPU failures taking precedence', () => {
  assert.equal(resolveGameViewState(ok), 'ready');
  assert.equal(resolveGameViewState({ ...ok, firstFrame: false }), 'loading');
  assert.equal(resolveGameViewState({ ...ok, gpu: 'pending' }), 'loading');
  assert.equal(resolveGameViewState({ ...ok, overMappedArea: false }), 'empty');
  assert.equal(resolveGameViewState({ ...ok, canvasFailed: true }), 'render-error');
  assert.equal(resolveGameViewState({ ...ok, gpu: 'unsupported', canvasFailed: true }), 'unsupported');
  assert.equal(resolveGameViewState({ ...ok, dataset: 'error', gpu: 'unsupported' }), 'data-error');
});

test('the canvas stays mounted through empty so wandering off never remounts the world', () => {
  assert.equal(shouldMountCanvas('empty'), true);
  assert.equal(shouldMountCanvas('ready'), true);
  assert.equal(shouldMountCanvas('render-error'), false);
});

test('the real Apollo tile: start view is mapped, the clamp corner is not', () => {
  const raw = readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8');
  const bounds = cityDatasetBounds(parseCityDataset(JSON.parse(raw)));
  assert.ok(isOverMappedArea(INITIAL_CITY_CAMERA, bounds));
  assert.equal(isOverMappedArea({ ...INITIAL_CITY_CAMERA, yaw: 0, x: 2000, z: 2000 }, bounds), false);
  assert.equal(isOverMappedArea({ ...INITIAL_CITY_CAMERA, yaw: 0, x: Number.NaN }, bounds), false);
});

test('first-frame signal fires once, after update, and passes updates through', async () => {
  let updates = 0; let signals = 0;
  const setup = withFirstFrameSignal(() => ({ scene: {} as never, camera: {} as never, update: () => { updates++; } }));
  const params = { dataset: {} as never, camera: INITIAL_CITY_CAMERA, onFirstFrame: () => { signals++; } };
  const built = setup({} as never, params);
  built.update!({} as never, params); built.update!({} as never, params);
  assert.equal(updates, 2);
  assert.equal(signals, 0, 'signal waits for the render that follows update');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(signals, 1);
});
