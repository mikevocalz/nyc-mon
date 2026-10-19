// Lane L6 "holding frame rate": the controller is deterministic — feed
// synthetic frame timestamps, assert the exact scale decisions at the
// band boundaries, the floor clamp, the parked-gap exclusion, the
// reversal damping and the bounded decision log. The mount fakes the
// renderer's pixel-ratio pair so apply/dispose are checked without a
// GPU. No rAF anywhere: timestamps are injected.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSkyRigFlag } from '../world/sky-rig.ts';
import {
  createRenderScaleController,
  EXPERIMENTAL_WORLD_RENDER_SCALE,
  mountRenderScale,
  RENDER_SCALE,
  RENDER_SCALE_FLOOR,
  type RenderScaleDecision,
} from './render-scale.ts';

const BAND = { low: 27, high: 38 } as const;

type Controller = ReturnType<typeof createRenderScaleController>;

/**
 * Feed frames every `dt` ms from `start` until the first evaluation
 * window closes; returns the decision and the next stream timestamp.
 * Stops AT the closing frame so no intervals leak past the verdict.
 */
function windowAt(c: Controller, start: number, dt: number): { decision: RenderScaleDecision; next: number } {
  const maxFrames = Math.ceil(RENDER_SCALE.intervalMs / dt) + 10;
  let last = start;
  for (let i = 0; i < maxFrames; i++) {
    last = start + dt * i;
    const d = c.frame(last);
    if (d) return { decision: d, next: last + dt };
  }
  assert.fail(`no window closed inside ${maxFrames} frames at ${dt} ms`);
}

test('flag is opt-in and shares the rig-flag truth table', () => {
  for (const on of ['1', 'true', 'on', 'yes', ' TRUE ', 'On']) {
    assert.equal(parseSkyRigFlag(on), true, on);
  }
  for (const off of [undefined, null, '', '0', 'false', 'off', 'nope', '  ']) {
    assert.equal(parseSkyRigFlag(off), false, String(off));
  }
  assert.equal(
    EXPERIMENTAL_WORLD_RENDER_SCALE,
    parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_RENDER_SCALE),
  );
  // The floor is the provisional 0.5 — the spec item pending Mike's sign-off.
  assert.equal(RENDER_SCALE_FLOOR, 0.5);
});

test('below the band steps the scale down 10% every window to the floor, then holds clamped', () => {
  const c = createRenderScaleController({ band: BAND });
  let t = 0;
  const expected = [0.9, 0.81, 0.729, 0.6561, 0.59049, 0.531441];
  for (const want of expected) {
    const { decision, next } = windowAt(c, t, 40); // 25 fps — below the 27 floor of the band
    assert.equal(decision.verdict, 'down');
    assert.ok(Math.abs(decision.to - want) < 1e-9, `scale ${decision.to} ≈ ${want}`);
    t = next;
  }
  const floored = windowAt(c, t, 40);
  assert.ok(Math.abs(floored.decision.to - RENDER_SCALE_FLOOR) < 1e-9, 'clamps at the 0.5 floor');
  const held = windowAt(c, floored.next, 40);
  assert.equal(held.decision.verdict, 'hold');
  assert.equal(held.decision.to, RENDER_SCALE_FLOOR);
  assert.match(held.decision.reason, /clamped at floor/);
});

test('above the band steps up 5% to the 1.0 ceiling, then holds clamped', () => {
  const c = createRenderScaleController({ band: BAND, startScale: 0.9 });
  const first = windowAt(c, 0, 20); // 50 fps — above the 38 ceiling of the band
  assert.equal(first.decision.verdict, 'up');
  assert.ok(Math.abs(first.decision.to - 0.945) < 1e-9);
  const second = windowAt(c, first.next, 20);
  assert.ok(Math.abs(second.decision.to - 0.99225) < 1e-9);
  const capped = windowAt(c, second.next, 20);
  assert.equal(capped.decision.to, 1);
  const held = windowAt(c, capped.next, 20);
  assert.equal(held.decision.verdict, 'hold');
  assert.match(held.decision.reason, /clamped at ceiling/);
});

test('inside the band — and exactly on its edges — is a hold', () => {
  const c = createRenderScaleController({ band: BAND });
  // 33.3 fps sits inside [27, 38].
  const inside = windowAt(c, 0, 30);
  assert.equal(inside.decision.verdict, 'hold');
  assert.equal(inside.decision.to, 1);
  // Exact edges are inside the band: the comparisons are strict. The
  // 25/50 fps edges divide evenly into 1000 and each window gets a fresh
  // controller, so the estimate lands on the edge exactly.
  const low = windowAt(createRenderScaleController({ band: { low: 25, high: 50 } }), 0, 40);
  assert.equal(low.decision.fps, 25);
  assert.equal(low.decision.verdict, 'hold');
  const high = windowAt(createRenderScaleController({ band: { low: 25, high: 50 } }), 0, 20);
  assert.equal(high.decision.fps, 50);
  assert.equal(high.decision.verdict, 'hold');
  // And just outside each edge decides — the deadband ends at the edge.
  const edge = createRenderScaleController({ band: { low: 25, high: 50 } });
  const below = windowAt(edge, 0, 41); // 24.4 fps
  assert.equal(below.decision.verdict, 'down');
  const above = windowAt(edge, below.next, 18); // >50 fps → reversal 1/2, damped after 'down'
  assert.equal(above.decision.verdict, 'hold');
  assert.match(above.decision.reason, /reversal 1\/2/);
});

test('a reversal of the last applied direction must persist two windows; wobble never flips the scale', () => {
  const c = createRenderScaleController({ band: BAND });
  // First window below the band: down applies immediately (nothing to reverse).
  const first = windowAt(c, 0, 40);
  assert.equal(first.decision.to, 0.9);
  // Now above the band: the first 'up' verdict is damped, the second applies.
  const damped = windowAt(c, first.next, 20);
  assert.equal(damped.decision.verdict, 'hold');
  assert.equal(damped.decision.to, 0.9);
  assert.match(damped.decision.reason, /reversal 1\/2/);
  const reversed = windowAt(c, damped.next, 20);
  assert.equal(reversed.decision.verdict, 'up');
  assert.ok(Math.abs(reversed.decision.to - 0.945) < 1e-9);
  // A rate wobbling across the edge: alternating verdicts never apply —
  // the pending 'down' is cancelled by the next 'up' rather than resumed,
  // so under strict alternation the scale freezes after the first move.
  const downHold = windowAt(c, reversed.next, 40);
  assert.equal(downHold.decision.verdict, 'hold');
  assert.match(downHold.decision.reason, /reversal 1\/2/);
  const upHold = windowAt(c, downHold.next, 20);
  assert.equal(upHold.decision.verdict, 'hold');
  assert.match(upHold.decision.reason, /cancelled down reversal/);
  const stillHeld = windowAt(c, upHold.next, 40);
  assert.equal(stillHeld.decision.verdict, 'hold');
  assert.match(stillHeld.decision.reason, /reversal 1\/2/);
  assert.ok(Math.abs(c.scale - 0.945) < 1e-9);
  // Another 'up' verdict cancels the fresh 'down' pending the same way,
  // and once the wobble clears a same-direction verdict resumes applying.
  const brokeUp = windowAt(c, stillHeld.next, 20);
  assert.equal(brokeUp.decision.verdict, 'hold');
  assert.match(brokeUp.decision.reason, /cancelled down reversal/);
  const applied = windowAt(c, brokeUp.next, 20);
  assert.equal(applied.decision.verdict, 'up');
  assert.ok(Math.abs(applied.decision.to - 0.99225) < 1e-9);
});

test('parked gaps past 250 ms do not count as slow frames; sparse windows hold', () => {
  const c = createRenderScaleController({ band: BAND });
  // One drawn frame, then a 5 s park — the gap is excluded, and the window
  // straddling it evaluates with no active intervals: a hold, not a down.
  assert.equal(c.frame(0), null);
  const parked = c.frame(5000);
  assert.ok(parked);
  assert.equal(parked.verdict, 'hold');
  assert.equal(parked.frames, 0);
  assert.equal(parked.fps, null);
  assert.match(parked.reason, /insufficient frames/);
  // Resume: one counted 200 ms interval, another park, window closes sparse.
  assert.equal(c.frame(5200), null); // 200 ms — counted
  const sparse = c.frame(6700); // 1500 ms park closes the window
  assert.ok(sparse);
  assert.equal(sparse.verdict, 'hold');
  assert.equal(sparse.frames, 1);
  assert.match(sparse.reason, /insufficient frames/);
  // Then continuous drawing measures normally again.
  const recovered = windowAt(c, 6720, 40); // 25 fps
  assert.equal(recovered.decision.verdict, 'down');
});

test('determinism: identical frame streams give identical decisions', () => {
  const a = createRenderScaleController({ band: BAND });
  const b = createRenderScaleController({ band: BAND });
  const stamps = [0, 40, 80, 5000, 5040, 5080, 5120, 5200, 7000, 7040, 7080, 7120, 7160, 8600];
  const da = stamps.map((t) => a.frame(t));
  const db = stamps.map((t) => b.frame(t));
  assert.deepEqual(da, db);
});

test('the decision log is bounded at the cap', () => {
  const c = createRenderScaleController({ band: BAND, decisionCap: 4 });
  // Eight windows separated by 10 s parks; each emits at least one decision.
  for (let w = 0; w < 8; w++) {
    c.frame(w * 10_000);
    windowAt(c, w * 10_000 + 40, 40);
  }
  assert.equal(c.decisions.length, 4);
  // Bounded arrays drop oldest first — the last window is the newest entry.
  assert.ok(c.decisions[3]!.at > c.decisions[0]!.at);
});

test('invalid options are rejected up front', () => {
  assert.throws(() => createRenderScaleController({ band: { low: 0, high: 30 } }), /band/);
  assert.throws(() => createRenderScaleController({ band: { low: 40, high: 30 } }), /band/);
  assert.throws(() => createRenderScaleController({ band: BAND, floor: 0 }), /floor/);
  assert.throws(() => createRenderScaleController({ band: BAND, floor: 0.6, ceiling: 0.5 }), /floor/);
});

test('the mount applies base×scale through setPixelRatio, self-heals on resize, and dispose restores', () => {
  const calls: number[] = [];
  const renderer = {
    ratio: 1,
    setPixelRatio(v: number) { this.ratio = v; calls.push(v); },
    getPixelRatio() { return this.ratio; },
  };
  const logged: RenderScaleDecision[] = [];
  const mount = mountRenderScale(renderer, { band: BAND, log: (d) => logged.push(d) });

  // Frames carry the device ratio (2x phone); scale 1 → ratio 2.
  for (let i = 0; i < 41; i++) mount.frame(i * 40, 2); // 25 fps → down
  assert.equal(mount.scale, 0.9);
  assert.equal(renderer.ratio, 2 * 0.9);
  assert.equal(logged.length, 1);
  assert.equal(logged[0]!.verdict, 'down');

  // The canvas's applySize re-stamps the raw device ratio, then resize() re-asserts the scale.
  renderer.setPixelRatio(2);
  mount.resized();
  assert.equal(renderer.ratio, 2 * 0.9);

  mount.dispose();
  assert.equal(renderer.ratio, 2, 'dispose restores the device ratio');
  const before = renderer.ratio;
  mount.frame(10_000, 2);
  mount.resized();
  assert.equal(renderer.ratio, before, 'a disposed mount touches nothing');
  mount.dispose(); // idempotent
});

test('forceDown steps immediately, bypasses the window cadence, and damps the climb back', () => {
  const c = createRenderScaleController({ band: BAND });
  // Mid-window: pacing frames have not closed a window yet, so only an
  // external input (thermal) can move the scale here.
  c.frame(0);
  c.frame(40);
  const step = c.forceDown(80, 'thermal warm (status 2, headroom 0.75)');
  assert.equal(step.verdict, 'down');
  assert.equal(step.to, 0.9);
  assert.equal(c.decisions.length, 1, 'forced steps join the same audit log');

  // A clamped step at the floor records a 'hold' — the request is audited,
  // not silently dropped.
  const floor = createRenderScaleController({ band: BAND, floor: 0.9, startScale: 0.9 });
  const clamped = floor.forceDown(0, 'thermal hot');
  assert.equal(clamped.verdict, 'hold');
  assert.match(clamped.reason, /clamped at floor/);

  // The forced step marks lastMoved='down', so the next 'up' verdict must
  // persist reversalWindows times — thermal steps do not bounce back.
  let t = 100;
  const first = windowAt(c, t, 25); // 40 fps → above the band, wants up
  assert.equal(first.decision.verdict, 'hold');
  assert.match(first.decision.reason, /reversal 1\/2 after down/);
  const second = windowAt(c, first.next, 25);
  assert.equal(second.decision.verdict, 'up');
});
