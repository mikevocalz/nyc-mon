import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  RUNTIME_LOAD_STAGES,
  describeRuntimeError,
  installFrameGlobals,
  isRuntimeLoadStage,
  routeRenderEvent,
  type RenderEventSinks,
} from './runtime-report.ts';
import { LOAD_STAGES } from '../game-session.ts';

const recordingSinks = () => {
  const calls: string[] = [];
  const sinks: RenderEventSinks = {
    log: (m) => calls.push(`log ${m}`),
    error: (m) => calls.push(`error ${m}`),
    loadStage: (s) => calls.push(`loadStage ${s}`),
  };
  return { calls, sinks };
};

test('every runtime load stage is a LOAD_STAGES key, in progress order', () => {
  const values = RUNTIME_LOAD_STAGES.map((stage) => LOAD_STAGES[stage]);
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.equal(isRuntimeLoadStage('requested'), true);
  assert.equal(isRuntimeLoadStage('done'), false);
});

test('a trace event becomes one console line naming the stage reached', () => {
  const { calls, sinks } = recordingSinks();
  assert.equal(routeRenderEvent('trace', 'installWebGPU', sinks), true);
  assert.deepEqual(calls, ['log [GameRender] render runtime reached: installWebGPU']);
});

test('an error event becomes console.error with its detail (where, message, stack)', () => {
  const { calls, sinks } = recordingSinks();
  routeRenderEvent('error', 'draw: TypeError: boom\n    at draw (game-render.ts:1:1)', sinks);
  assert.deepEqual(calls, ['error [GameRender] render runtime error in draw: TypeError: boom\n    at draw (game-render.ts:1:1)']);
});

test('a known stage advances the load bar and is logged; an unknown one is an error', () => {
  const { calls, sinks } = recordingSinks();
  routeRenderEvent('stage', 'moduleLoaded', sinks);
  routeRenderEvent('stage', 'bogus', sinks);
  assert.deepEqual(calls, [
    'log [GameRender] load stage: moduleLoaded',
    'loadStage moduleLoaded',
    'error [GameRender] unknown load stage from the render runtime: bogus',
  ]);
});

test('backend, firstFrame and failed are left to the session', () => {
  const { calls, sinks } = recordingSinks();
  for (const kind of ['backend', 'firstFrame', 'failed'] as const) assert.equal(routeRenderEvent(kind, '', sinks), false);
  assert.deepEqual(calls, []);
});

test('describeRuntimeError keeps where, name, message and stack', () => {
  const error = new TypeError('null is not an object');
  const text = describeRuntimeError('start', error);
  assert.match(text, /^start: TypeError: null is not an object\n/);
  assert.ok(text.includes(error.stack ?? '\u0000'));
  assert.equal(describeRuntimeError('stop', 'plain'), 'stop: plain');
});

test('installFrameGlobals aliases self once and never replaces an existing one', () => {
  const runtime: Record<string, unknown> = {};
  assert.equal(installFrameGlobals(runtime), true);
  assert.equal(runtime.self, runtime);
  assert.equal(installFrameGlobals(runtime), false);
  const browserLike: Record<string, unknown> = { self: 'window' };
  assert.equal(installFrameGlobals(browserLike), false);
  assert.equal(browserLike.self, 'window');
});

// The stall seen on the Surface Duo, reproduced against the installed three:
// on a runtime with requestAnimationFrame but no `self` (a worklet runtime),
// Renderer.init() never settles. With the alias it resolves. Each case runs
// in its own node process so the missing `self` and the unhandled rejection
// stay out of this one.
const initProbe = (aliasSelf: boolean) => `
const THREE = await import(${JSON.stringify(import.meta.resolve('three/webgpu'))});
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame = (h) => clearTimeout(h);
${aliasSelf ? 'globalThis.self = globalThis;' : ''}
const canvas = { width: 1, height: 1, style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} };
class StubBackend extends THREE.Backend {
  constructor() { super({}); }
  getDomElement() { return canvas; }
  get coordinateSystem() { return THREE.WebGPUCoordinateSystem; }
}
let unhandled = '';
process.on('unhandledRejection', (e) => { unhandled = String(e); });
const renderer = new THREE.Renderer(new StubBackend(), {});
const outcome = await Promise.race([
  renderer.init().then(() => 'resolved', (e) => 'rejected ' + e),
  new Promise((r) => setTimeout(() => r('pending'), 500)),
]);
renderer._animation?.stop?.();
console.log(JSON.stringify({ outcome, unhandled }));
process.exit(0);
`;
const runProbe = (aliasSelf: boolean): { outcome: string; unhandled: string } => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', initProbe(aliasSelf)], { encoding: 'utf8', timeout: 20_000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim().split('\n').at(-1) ?? '{}');
};

test('three Renderer.init() hangs silently without self, the stall the Duo showed', () => {
  const { outcome, unhandled } = runProbe(false);
  assert.equal(outcome, 'pending');
  assert.match(unhandled, /reading 'requestAnimationFrame'/);
});

test('three Renderer.init() resolves once self is aliased', () => {
  assert.deepEqual(runProbe(true), { outcome: 'resolved', unhandled: '' });
});
