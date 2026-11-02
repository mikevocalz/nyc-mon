import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { consumeGpuTimestamp, kickGpuTimestampResolve, type GpuTimestampChannel } from './gpu-timestamps.ts';

test('a resolved GPU duration contributes once while the next resolve is stalled', async () => {
  const channel: GpuTimestampChannel = { gpuMs: null, pending: false };
  let finish!: (ms: number) => void;
  let calls = 0;
  const renderer = {
    resolveTimestampsAsync: () => {
      calls++;
      return new Promise<number>((resolve) => { finish = resolve; });
    },
  };
  const first = kickGpuTimestampResolve(renderer, channel);
  assert.equal(consumeGpuTimestamp(channel), null);
  finish(30);
  await first;
  assert.equal(consumeGpuTimestamp(channel), 30);
  const next = kickGpuTimestampResolve(renderer, channel);
  for (let frame = 0; frame < 120; frame++) {
    assert.equal(consumeGpuTimestamp(channel), null);
    await kickGpuTimestampResolve(renderer, channel);
  }
  assert.equal(calls, 2, 'backpressure does not stack resolves');
  finish(30);
  await next;
  assert.equal(consumeGpuTimestamp(channel), 30, 'an equal-valued but fresh measurement still counts');
  assert.equal(consumeGpuTimestamp(channel), null);
});

test('invalid and failed resolves do not replay a consumed duration; zero is valid', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const channel: GpuTimestampChannel = { gpuMs: 12, pending: false };
  assert.equal(consumeGpuTimestamp(channel), 12);
  for (const ms of [NaN, Infinity, -1]) {
    await kickGpuTimestampResolve({ resolveTimestampsAsync: async () => ms }, channel);
    assert.equal(consumeGpuTimestamp(channel), null);
  }
  await kickGpuTimestampResolve({ resolveTimestampsAsync: async () => { throw new Error('device lost'); } }, channel);
  assert.equal(channel.pending, false);
  assert.equal(consumeGpuTimestamp(channel), null);
  await kickGpuTimestampResolve({ resolveTimestampsAsync: async () => 0 }, channel);
  assert.equal(consumeGpuTimestamp(channel), 0);
  assert.equal(consumeGpuTimestamp(channel), null);
});

test('ThreeCanvas consumes the channel instead of replaying its last value', () => {
  const source = readFileSync(new URL('./ThreeCanvas.tsx', import.meta.url), 'utf8');
  assert.match(source, /probe\.gpuMs = rt\.gpuTiming \? consumeGpuTimestamp\(rt\.gpuTiming\) : undefined/);
});
