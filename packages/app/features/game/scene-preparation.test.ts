import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from './city-dataset.ts';
import { finishPreparation, runPreparation } from './scene-preparation.ts';
import { prepareCityWorld } from './world/index.ts';

const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')));

test('async preparation yields after completed phases and retains synchronous result semantics', async () => {
  const seen: string[] = [];
  function* build() { seen.push('material'); yield 0.2; seen.push('mesh'); yield 0.8; return 'ready'; }
  assert.equal(await runPreparation(build(), undefined, async () => { seen.push('paint'); }, { budgetMs: 0 }), 'ready');
  assert.deepEqual(seen, ['material', 'paint', 'mesh', 'paint']);
  assert.equal(finishPreparation(build()), 'ready');
});

test('abort closes a suspended real world and disposes its completed geometry and materials', async () => {
  const abort = new AbortController();
  let geometry = 0, material = 0;
  const disposeGeometry = THREE.BufferGeometry.prototype.dispose;
  const disposeMaterial = THREE.Material.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose = function () { geometry++; disposeGeometry.call(this); };
  THREE.Material.prototype.dispose = function () { material++; disposeMaterial.call(this); };
  const progress: number[] = [];
  try {
    await assert.rejects(runPreparation(prepareCityWorld(THREE as never, dataset, { vd: false, skyRig: false, pbr: false, glass: false, carPbr: false, onProgress: (p) => progress.push(p) }), abort.signal, async () => { abort.abort(); }, { budgetMs: 0 }), /abort/i);
    assert.deepEqual(progress, [0.1], 'no later phase runs after cancellation');
    assert.equal(geometry, 2, 'sky and ground geometries released');
    assert.ok(material > 0, 'owned material set released');
  } finally {
    THREE.BufferGeometry.prototype.dispose = disposeGeometry;
    THREE.Material.prototype.dispose = disposeMaterial;
  }
});

test('failed scheduling closes the generator and pre-aborted requests allocate nothing', async () => {
  let allocated = 0, released = 0;
  function* build() { try { allocated++; yield 0.1; return 'ready'; } finally { released++; } }
  await assert.rejects(runPreparation(build(), undefined, async () => { throw new Error('surface lost'); }, { budgetMs: 0 }), /surface lost/);
  assert.equal(released, 1);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(runPreparation(build(), abort.signal), /abort/i);
  assert.equal(allocated, 1);
});

test('abort immediately releases suspended ownership even if the scheduler never resumes', async () => {
  let released = 0;
  const abort = new AbortController();
  function* build() { try { yield 0.1; return 'ready'; } finally { released++; } }
  const running = runPreparation(build(), abort.signal, () => new Promise(() => {}), { budgetMs: 0 });
  await Promise.resolve();
  abort.abort();
  await assert.rejects(running, /abort/i);
  assert.equal(released, 1);
});

test('production frame yielding cancels its native animation request on abort', async () => {
  const { yieldPreparationFrame } = await import('./scene-preparation.ts');
  const oldRequest = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  const cancelled: number[] = [];
  globalThis.requestAnimationFrame = () => 73;
  globalThis.cancelAnimationFrame = (frame) => { if (typeof frame === 'number') cancelled.push(frame); };
  try {
    const abort = new AbortController();
    const pending = yieldPreparationFrame(abort.signal);
    abort.abort();
    await pending;
    assert.deepEqual(cancelled, [73]);
  } finally {
    globalThis.requestAnimationFrame = oldRequest;
    globalThis.cancelAnimationFrame = oldCancel;
  }
});

test('scene rejection after world completion releases the world and every earlier actor', async () => {
  const { createCityScene } = await import('./city-scene.ts');
  let actorDisposed = 0, geometriesDisposed = 0;
  const original = THREE.BufferGeometry.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose = function () { geometriesDisposed++; original.call(this); };
  try {
    assert.throws(() => createCityScene({ THREE, invalidate() {}, renderer: undefined } as never, {
      dataset,
      camera: { x: 0, z: 0, yaw: 0, pitch: 0.3, distance: 24 },
      actors: [() => ({ object: new THREE.Group(), dispose() { actorDisposed++; } }), () => { throw new Error('actor allocation failed'); }],
    } as never), /actor allocation failed/);
    assert.equal(actorDisposed, 1);
    assert.ok(geometriesDisposed >= 2, 'completed world geometry released on rejected scene setup');
  } finally { THREE.BufferGeometry.prototype.dispose = original; }
});

test('many cheap checkpoints share an 8 ms CPU slice rather than requiring one frame each', async () => {
  let clock = 0, frames = 0, done = 0;
  function* build() { for (let i = 0; i < 1000; i++) { clock += 0.01; done++; yield i / 1000; } return 'ready'; }
  assert.equal(await runPreparation(build(), undefined, async () => { frames++; }, { now: () => clock }), 'ready');
  assert.equal(done, 1000);
  assert.equal(frames, 1, '1000 tiny steps need one budget boundary, not1000 vsyncs');
});

test('costly atomic steps yield when the budget is exhausted and abort is checked between cheap steps', async () => {
  let clock = 0, frames = 0;
  function* build() { clock += 9; yield 0.2; clock += 3; yield 0.4; clock += 6; yield 0.8; return 'ready'; }
  assert.equal(await runPreparation(build(), undefined, async () => { frames++; }, { now: () => clock }), 'ready');
  assert.equal(frames, 2);
  const abort = new AbortController();
  let visited = 0, released = false;
  function* cancelled() { try { for (let i = 0; i < 20; i++) { visited++; if (i === 2) abort.abort(); yield i; } return 'ready'; } finally { released = true; } }
  await assert.rejects(runPreparation(cancelled(), abort.signal, async () => {}, { now: () => 0 }), /abort/i);
  assert.equal(visited, 3);
  assert.equal(released, true);
});
