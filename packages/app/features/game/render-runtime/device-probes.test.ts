// The shared, skiatex and pipecache probes, run against node stand-ins. These
// pin the probes' verdict logic and their log shape; whether a real device
// passes them is the iPad run's question (D1, D7).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fakeDevice, fakeSkia, type FakeTexture } from './webgpu-mock.test-support.ts';
import {
  classifyFrame, createPipecacheTimer, formatProbeRecord, probeShared, probeSkiaTex, webgpuSampler,
} from './device-probes.ts';
import { rgba, type SkiaInterop, type SkiaTexture } from './skia-texture-bridge.ts';
import { CITY_COLORS } from '../world/palette.ts';

const asDevice = (d: ReturnType<typeof fakeDevice>) => d as unknown as GPUDevice;
const asSkia = (s: ReturnType<typeof fakeSkia>) => s as unknown as SkiaInterop;

test('shared passes when the read-back is lit and Skia takes the texture', async () => {
  const device = fakeDevice();
  const record = await probeShared({ runtime: 'js', device: asDevice(device), deviceSource: 'shared', skia: asSkia(fakeSkia(device)) });
  assert.equal(record.ok, true);
  assert.equal(record.nonBlack, true);
  assert.deepEqual(record.detail.pixel, record.detail.expected);
  assert.equal(record.detail.skiaAccepts, true);
  assert.equal(device.textures[0]?.destroyed, true);
});

test('shared fails when Skia is on another device, and keeps Skia\'s error', async () => {
  const device = fakeDevice();
  const record = await probeShared({ runtime: 'worklet', device: asDevice(device), deviceSource: 'own', skia: asSkia(fakeSkia(fakeDevice())) });
  assert.equal(record.ok, false);
  assert.equal(record.nonBlack, true);
  assert.equal(record.detail.skiaAccepts, false);
  assert.match(String(record.detail.skiaError), /not on the Skia device/);
});

test('shared without Skia on the runtime reports skiaAccepts null and does not pass', async () => {
  const device = fakeDevice();
  const record = await probeShared({ runtime: 'worklet', device: asDevice(device), deviceSource: 'shared', skia: null });
  assert.equal(record.ok, false);
  assert.equal(record.detail.skiaAccepts, null);
  assert.equal(record.detail.skiaOnRuntime, false);
});

test('classifyFrame tells this frame from the last one and from black', () => {
  const bytes = (hex: string) => rgba(hex).map((v) => Math.round(v * 255));
  const green = bytes(CITY_COLORS.signGreen);
  const amber = bytes(CITY_COLORS.windowAmber);
  assert.equal(classifyFrame(green, 0), 'fresh');
  assert.equal(classifyFrame(amber, 1), 'fresh');
  assert.equal(classifyFrame(green, 1), 'stale');
  assert.equal(classifyFrame([0, 0, 0, 255], 1), 'black');
});

test('skiatex: a consumer that sees each flush is fresh on every frame, in both flush modes', async () => {
  const device = fakeDevice();
  const record = await probeSkiaTex({ runtime: 'js', device: asDevice(device), skia: asSkia(fakeSkia(device)), sample: webgpuSampler(asDevice(device)), frames: 4 });
  assert.equal(record.ok, true, JSON.stringify(record.detail));
  assert.equal(record.nonBlack, true);
  const detail = record.detail as Record<'flush' | 'flushSync', { verdicts: string[] }>;
  assert.deepEqual(detail.flush.verdicts, ['fresh', 'fresh', 'fresh', 'fresh']);
  assert.deepEqual(detail.flushSync.verdicts, ['fresh', 'fresh', 'fresh', 'fresh']);
});

test('skiatex: a consumer one frame behind is reported stale, and the probe fails', async () => {
  const device = fakeDevice();
  let previous = [0, 0, 0, 0];
  const lagging = async (source: SkiaTexture) => {
    const shown = previous;
    previous = [...(source.texture as unknown as FakeTexture).texel];
    return shown;
  };
  const record = await probeSkiaTex({ runtime: 'worklet', device: asDevice(device), skia: asSkia(fakeSkia(device)), sample: lagging, frames: 3 });
  assert.equal(record.ok, false);
  const detail = record.detail as Record<'flush' | 'flushSync', { verdicts: string[] }>;
  assert.deepEqual(detail.flush.verdicts.slice(1), ['stale', 'stale']);
});

test('skiatex: a read-back that never settles is reported as timeout, not waited on', async () => {
  const device = fakeDevice();
  const hung = () => new Promise<number[]>(() => {});
  const record = await probeSkiaTex({ runtime: 'worklet', device: asDevice(device), skia: asSkia(fakeSkia(device)), sample: hung, timeoutMs: 20 });
  assert.equal(record.ok, false);
  const detail = record.detail as Record<'flush' | 'flushSync', { verdicts: string[] }>;
  assert.deepEqual(detail.flush.verdicts, ['timeout']);
  assert.deepEqual(detail.flushSync.verdicts, ['timeout']);
});

test('skiatex without Skia on the runtime says so instead of drawing', async () => {
  const record = await probeSkiaTex({ runtime: 'worklet', device: asDevice(fakeDevice()), skia: null, sample: async () => [] });
  assert.equal(record.ok, false);
  assert.equal(record.detail.error, 'Skia API not installed on this runtime');
});

test('pipecache keeps the first time of each stage and reports world-ready once', () => {
  let t = 100;
  const timer = createPipecacheTimer('worklet', () => t);
  t = 140;
  timer.mark('rendererInit');
  t = 900;
  timer.mark('worldBuilt');
  timer.mark('rendererInit');
  t = 1600;
  const record = timer.finish();
  assert.deepEqual(record?.detail, { worldReadyMs: 1500, marks: { rendererInit: 40, worldBuilt: 800 } });
  assert.equal(timer.finish(), null);
  assert.match(formatProbeRecord(record!), /^probe \{"probe":"pipecache","runtime":"worklet"/);
});

test('the JS-runtime runner logs one probe line for shared and skiatex, and skips pipecache', async () => {
  const { runJsDeviceProbe } = await import('./run-js-device-probes.ts');
  const device = fakeDevice();
  const lines: string[] = [];
  const deps = {
    gpu: async () => ({ device: asDevice(device), source: 'shared' }),
    globals: () => ({ skia: asSkia(fakeSkia(device)), webgpu: null }),
    log: (line: string) => lines.push(line),
  };
  assert.equal((await runJsDeviceProbe('shared', deps))?.ok, true);
  assert.equal((await runJsDeviceProbe('skiatex', deps))?.ok, true);
  assert.equal(await runJsDeviceProbe('pipecache', deps), null);
  assert.equal(await runJsDeviceProbe(null, deps), null);
  assert.equal(lines.length, 2);
  assert.match(lines[0]!, /^\[GameRender\] js runtime: probe \{"probe":"shared","runtime":"js","ok":true/);
  assert.match(lines[1]!, /^\[GameRender\] js runtime: probe \{"probe":"skiatex","runtime":"js","ok":true/);
});
