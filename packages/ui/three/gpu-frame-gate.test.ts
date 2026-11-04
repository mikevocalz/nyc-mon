import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGpuFrameGate } from './gpu-frame-gate.ts';

function harness() {
  let finish!: () => void, reject!: (error: unknown) => void, wakes = 0, fences = 0, time = 0;
  const errors: unknown[] = [];
  const gate = createGpuFrameGate({ onSubmittedWorkDone() { fences++; return new Promise<void>((resolve, fail) => { finish = resolve; reject = fail; }); } },
    { wake() { wakes++; }, onError(error) { errors.push(error); }, now: () => time });
  return { gate, finish: () => finish(), reject: (error: unknown) => reject(error), advance: (n: number) => { time += n; },
    get wakes() { return wakes; }, get fences() { return fences; }, errors };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('one pending native frame coalesces arbitrary inputs and the next draw reads only their latest state', async () => {
  const h = harness(); let latest = 0;
  const frames: number[] = [];
  const draw = () => { if (h.gate.begin()) { frames.push(latest); h.gate.submitted(); } };
  draw();
  for (latest = 1; latest <= 120; latest++) { h.gate.request(); draw(); }
  assert.deepEqual(frames, [0]); assert.equal(h.fences, 1); assert.equal(h.wakes, 0);
  latest = 121; h.advance(130); h.finish(); await settle();
  assert.equal(h.wakes, 1); assert.equal(h.gate.stats.completionMs, 130);
  draw(); assert.deepEqual(frames, [0, 121]); assert.equal(h.fences, 2);
  h.finish(); await settle(); assert.equal(h.wakes, 1, 'completion without demand must not start an idle animation loop');
  assert.equal(h.gate.stats.completed, 2); h.gate.dispose();
});

test('invalidation from inside update/present is retained before the fence promise is created', async () => {
  const h = harness(); assert.equal(h.gate.begin(), true);
  assert.equal(h.gate.request(), true);
  h.gate.submitted(); h.finish(); await settle();
  assert.equal(h.wakes, 1); assert.equal(h.gate.begin(), true);
  h.gate.submitted(); h.gate.dispose(); h.finish(); await settle();
  assert.equal(h.wakes, 1, 'late completion cannot wake an unmounted canvas');
});

test('GPU rejection stops submissions explicitly and cannot replay pending input onto a failed renderer', async () => {
  const h = harness(), error = new Error('device lost');
  h.gate.begin(); h.gate.submitted(); h.gate.request(); h.reject(error); await settle();
  assert.deepEqual(h.errors, [error]); assert.equal(h.wakes, 0); assert.equal(h.gate.begin(), false);
  h.gate.submitted(); assert.equal(h.fences, 1); h.gate.dispose();
});

test('a disposed canvas cannot release another renderer slot; missing and synchronously failing queues fail explicitly', async () => {
  const old = harness(); old.gate.begin(); old.gate.submitted(); old.gate.request(); old.gate.dispose();
  const current = harness(); current.gate.begin(); current.gate.submitted();
  old.finish(); await settle(); assert.equal(current.gate.begin(), false); assert.equal(old.wakes, 0);
  current.finish(); await settle(); assert.equal(current.wakes, 1); current.gate.dispose();
  assert.throws(() => createGpuFrameGate({} as never, { wake() {}, onError() {} }), /unavailable/);
  const errors: unknown[] = [], error = new Error('native callback failed');
  const broken = createGpuFrameGate({ onSubmittedWorkDone() { throw error; } }, { wake() { assert.fail('cannot resume'); }, onError: e => errors.push(e) });
  broken.begin(); broken.submitted(); assert.deepEqual(errors, [error]); assert.equal(broken.begin(), false);
});

test('two slots overlap CPU and GPU, then coalesce saturated demand into the latest next frame', async () => {
  const pending: (() => void)[] = [], frames: number[] = [];
  let latest = 0, wakes = 0;
  const gate = createGpuFrameGate({ onSubmittedWorkDone: () => new Promise<void>(resolve => pending.push(resolve)) },
    { maxInFlight: 2, wake: () => { wakes++; }, onError: error => assert.fail(String(error)) });
  const draw = () => { if (!gate.begin()) return; frames.push(latest); gate.submitted(); };
  assert.equal(gate.begin(), true);
  assert.equal(gate.request(), false, 'an update invalidation can schedule the second slot without waiting on the first fence');
  frames.push(latest); gate.submitted();
  latest = 1; draw(); assert.deepEqual(frames, [0, 1]);
  assert.equal(gate.stats.inFlightFrames, 2); assert.equal(gate.stats.peakInFlight, 2);
  for (latest = 2; latest < 122; latest++) { assert.equal(gate.request(), true); draw(); }
  assert.equal(pending.length, 2); assert.equal(frames.length, 2);
  pending[0]!(); await settle();
  assert.equal(wakes, 1); assert.equal(gate.stats.inFlightFrames, 1);
  latest = 122; draw(); assert.deepEqual(frames, [0, 1, 122]);
  assert.equal(gate.stats.inFlightFrames, 2); assert.equal(gate.stats.submitted - gate.stats.completed, 2);
  pending[1]!(); pending[2]!(); await settle();
  assert.equal(gate.stats.inFlightFrames, 0); assert.equal(gate.stats.completed, 3); assert.equal(gate.stats.peakInFlight, 2);
  gate.dispose();
});

test('two pending fences are harmless after disposal or a device-loss rejection', async () => {
  const pending: { resolve(): void; reject(error: unknown): void }[] = [], errors: unknown[] = [];
  let wakes = 0;
  const gate = createGpuFrameGate({ onSubmittedWorkDone: () => new Promise<void>((resolve, reject) => pending.push({ resolve, reject })) },
    { maxInFlight: 2, wake() { wakes++; }, onError: error => errors.push(error) });
  gate.begin(); gate.submitted(); gate.begin(); gate.submitted(); gate.request();
  const error = new Error('device lost'); pending[1]!.reject(error); await settle();
  pending[0]!.resolve(); await settle();
  assert.deepEqual(errors, [error]); assert.equal(wakes, 0); assert.equal(gate.begin(), false); assert.equal(gate.stats.inFlightFrames, 0);
  gate.dispose();
});
