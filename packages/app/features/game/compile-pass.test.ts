// compile-pass.ts: with a progress callback the START compile still runs in the post pass's target and MRT, reports
// through the renderer's onProgress, and puts the renderer's target and MRT back after.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityCompilePass, compileForFrames, type CompilePass } from './compile-pass.ts';

function fakeRenderer() {
  const calls: { scene: unknown; camera: unknown; target: unknown; mrt: unknown; onProgress: unknown }[] = [];
  let target: unknown = 'canvas-target';
  let mrt: unknown = 'canvas-mrt';
  let finish: () => void = () => {};
  const renderer = {
    samples: 4,
    reversedDepthBuffer: true,
    getOutputBufferType: () => 1016,
    getRenderTarget: () => target,
    setRenderTarget: (t: unknown) => { target = t; },
    getMRT: () => mrt,
    setMRT: (m: unknown) => { mrt = m; },
    compileAsync: (scene: unknown, camera: unknown, _t: unknown, onProgress: unknown) => {
      calls.push({ scene, camera, target, mrt, onProgress });
      return new Promise<void>((resolve) => { finish = resolve; });
    },
  };
  return { renderer, calls, state: () => ({ target, mrt }), finish: () => finish() };
}

function fakePass(): CompilePass & { scene: object; camera: object; _mrt: unknown; passCompiles: number } {
  return {
    passCompiles: 0,
    compileAsync() { this.passCompiles++; return Promise.resolve(); },
    options: {},
    renderTarget: { samples: 0, texture: { type: 0 }, depthTexture: { type: 0 } },
    scene: { id: 'pass-scene' },
    camera: { id: 'pass-camera' },
    _mrt: 'pass-mrt',
  };
}

test('with onProgress: compiles in the pass target and MRT, synchronously, then restores both', async () => {
  const { renderer, calls, state, finish } = fakeRenderer();
  const scene = {};
  const pass = fakePass();
  cityCompilePass.set(scene, pass);
  const onProgress = () => {};
  const done = compileForFrames(renderer, scene, {}, onProgress);
  assert.equal(calls.length, 1, 'the renderer compile starts before the first await (planWarmUp relies on it)');
  assert.deepEqual(calls[0], { scene: pass.scene, camera: pass.camera, target: pass.renderTarget, mrt: 'pass-mrt', onProgress });
  assert.equal(pass.renderTarget.samples, 4);
  assert.equal(pass.renderTarget.texture.type, 1016);
  assert.equal(pass.renderTarget.depthTexture!.type, 1015);
  assert.equal(pass.passCompiles, 0);
  finish();
  await done;
  assert.deepEqual(state(), { target: 'canvas-target', mrt: 'canvas-mrt' });
});

test('without onProgress the pass compiles itself; without a pass the renderer compiles the scene', async () => {
  const a = fakeRenderer();
  const scene = {};
  const pass = fakePass();
  cityCompilePass.set(scene, pass);
  await compileForFrames(a.renderer, scene, {});
  assert.equal(pass.passCompiles, 1);
  assert.equal(a.calls.length, 0);

  const b = fakeRenderer();
  const bare = {};
  const camera = {};
  const onProgress = () => {};
  const done = compileForFrames(b.renderer, bare, camera, onProgress);
  assert.deepEqual(b.calls[0], { scene: bare, camera, target: 'canvas-target', mrt: 'canvas-mrt', onProgress });
  b.finish();
  await done;
});
