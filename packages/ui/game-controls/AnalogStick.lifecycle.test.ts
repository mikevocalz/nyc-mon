import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { createGameInputRouter } from './create-game-input-router.ts';

const source = readFileSync(new URL('./AnalogStick.tsx', import.meta.url), 'utf8');
// Execute the component's actual terminal callback bodies with injected native
// primitives. This checks ordering and reentrancy; only device QA proves the
// compiled UI-runtime worklets and GPU view behavior.
function body(name: string): string {
  const start = source.indexOf(`    ${name}:`);
  const open = source.indexOf('{', start);
  let depth = 1, end = open + 1;
  for (; depth > 0; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  return source.slice(open + 1, end - 1);
}
function setup() {
  const router = createGameInputRouter();
  router.move(0, 1, 'begin', 'touch', 1);
  const shared = (initial: unknown) => { let value = initial; return { get: () => value, set: (next: unknown) => { value = next; } }; };
  const owner = shared(7);
  let terminals = 0;
  const context: Record<string, unknown> = {
    owner, reducedMotion: true, ENGAGE_MS: 120, RETURN_SPRING: {}, LEVER_SPRING: {},
    lastX: shared(0), lastY: shared(1), lastEngaged: shared(true), lastDirection: shared('n'),
    engage: shared(1), shiftX: shared(0), shiftY: shared(0), padX: shared(0), padY: shared(-36),
    withTiming: (value: unknown) => value, withSpring: (value: unknown) => value,
    runOnJS: (fn: unknown) => fn,
    publish: (_x: number, _y: number, _engaged: boolean, _direction: string, phase: 'end' | 'cancel') => {
      terminals++; router.move(0, 0, phase, 'touch', 2);
    },
  };
  const finalize = runInNewContext(`(e) => {${body('onFinalize')}}`, context);
  context.GestureStateManager = { deactivate() { assert.equal(router.stick.engaged, false); finalize({}); } };
  return { router, owner, terminals: () => terminals,
    up: runInNewContext(`(e) => {${body('onTouchesUp')}}`, context),
    cancel: runInNewContext(`(e) => {${body('onTouchesCancel')}}`, context), finalize,
  };
}
test('actual touch-up callback neutralizes before synchronous native finalization exactly once', () => {
  const state = setup();
  state.up({ handlerTag: 1, changedTouches: [{ id: 7 }], allTouches: [] });
  state.finalize({});
  assert.equal(state.terminals(), 1);
  assert.equal(state.owner.get(), -1);
  assert.equal(state.router.diagnostics.rejected, 0);
});
test('actual empty-changed cancellation and finalize-only callbacks neutralize owned input', () => {
  const cancelled = setup();
  cancelled.cancel({ changedTouches: [], allTouches: [{ id: 7 }] });
  assert.equal(cancelled.router.stick.engaged, false);
  const finalized = setup(); finalized.finalize({});
  assert.equal(finalized.router.stick.engaged, false);
});
