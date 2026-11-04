import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeSurfacePresentation } from './surface-presentation-probe.ts';

test('probe observes the renderer acquisition with original this/texture identity and initiates no GPU work', () => {
  const texture = { usage: 17, width: 200, height: 100, nativePointer: 123n };
  let acquisitions = 0, configurations = 0, time = 0;
  const context = {
    configure(config: { usage?: number; format?: string }) { assert.equal(this, context); assert.equal(config.usage, 17); configurations++; },
    getCurrentTexture() { assert.equal(this, context); acquisitions++; return texture; },
  };
  const get = context.getCurrentTexture, configure = context.configure;
  const samples: Record<string, unknown>[] = [];
  const probe = observeSurfacePresentation(context, { now: () => time, nativeSurface: () => ({ surface: 456n, width: 200, height: 100, clientWidth: 100, clientHeight: 50 }), log: sample => samples.push(sample) });
  assert.equal(acquisitions + configurations, 0);
  context.configure({ usage: 17, format: 'bgra8unorm' });
  assert.equal(context.getCurrentTexture(), texture); probe.presentAttempt();
  assert.equal(acquisitions, 1); assert.equal(configurations, 1);
  assert.equal(samples[0]!.textureUsage, 17); assert.equal(samples[0]!.extraTextureUsage, 0);
  assert.equal(samples[0]!.texturePointer, '123'); assert.equal(samples[0]!.nativeSurface, '456');
  texture.usage = 21; context.getCurrentTexture(); time = 500; probe.presentAttempt();
  assert.equal(samples[1]!.extraTextureUsage, 4, 'offscreen-required texture binding is distinguishable from configured usage');
  assert.equal(samples[1]!.presentAttempts, 2);
  probe.dispose(); probe.dispose();
  assert.equal(context.getCurrentTexture, get); assert.equal(context.configure, configure);
  probe.presentAttempt(); assert.equal(samples.length, 2);
});

test('sampling is capped and retired observers cannot log into a later scene', () => {
  let time = 0;
  const context = { configure(_: { usage?: number }) {}, getCurrentTexture() { return { usage: 17, width: 1, height: 1 }; } };
  const samples: Record<string, unknown>[] = [];
  const options = { now: () => time, nativeSurface: () => ({ surface: 0n, width: 0, height: 0, clientWidth: 0, clientHeight: 0 }), log: (s: Record<string, unknown>) => samples.push(s) };
  const old = observeSurfacePresentation(context, options); context.configure({ usage: 17 }); context.getCurrentTexture();
  for (let i = 0; i < 2000; i++) { old.presentAttempt(); time += 100; }
  assert.equal(samples.length, 120); old.dispose();
  const next = observeSurfacePresentation(context, options); context.configure({ usage: 17 }); context.getCurrentTexture();
  old.dispose(); old.presentAttempt(); next.presentAttempt();
  assert.equal(samples.length, 121); assert.equal(samples.at(-1)!.sequence, 1); next.dispose();
});
