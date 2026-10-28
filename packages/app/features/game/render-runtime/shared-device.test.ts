// N10, renderer side: which device game-render hands to WebGPURenderer under
// EXPO_PUBLIC_WORLD_PHYSICAL. The importDevice that fails is
// react-native-webgpu 0.16.0's own mock export.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fakeDevice, fakeSkia, webgpuMock } from './webgpu-mock.test-support.ts';
import { readInteropGlobals, resolveRendererDevice } from './shared-device.ts';

const device = fakeDevice() as unknown as GPUDevice;

test('the interop globals are read only when they carry the functions the bridge calls', () => {
  assert.deepEqual(readInteropGlobals({}), { skia: null, webgpu: null });
  assert.deepEqual(readInteropGlobals({ SkiaApi: {}, RNWebGPU: {} }), { skia: null, webgpu: null });
  const skia = fakeSkia(fakeDevice());
  const got = readInteropGlobals({ SkiaApi: skia, RNWebGPU: webgpuMock });
  assert.equal(got.skia, skia);
  assert.equal(got.webgpu, webgpuMock);
});

test('a handed device wins and keeps the source gpu-store recorded', () => {
  const got = resolveRendererDevice(device, 'shared', { skia: null, webgpu: null });
  assert.equal(got.device, device);
  assert.equal(got.source, 'shared');
  assert.equal(resolveRendererDevice(device, undefined, { skia: null, webgpu: null }).source, 'unknown');
});

test('with nothing handed, Skia\'s pointer goes through importDevice on this runtime', () => {
  const pointers: bigint[] = [];
  const skia = fakeSkia(fakeDevice(), { pointer: 0xdead_beefn });
  const got = resolveRendererDevice(null, null, {
    skia: skia as never,
    webgpu: { importDevice: (pointer) => { pointers.push(pointer); return device; } },
  });
  assert.deepEqual(pointers, [0xdead_beefn]);
  assert.equal(got.device, device);
  assert.equal(got.source, 'shared');
});

test("the mock's importDevice throws, and three is left to request its own device with the reason in the trace", () => {
  const got = resolveRendererDevice(null, null, { skia: fakeSkia(fakeDevice()) as never, webgpu: webgpuMock });
  assert.equal(got.device, null);
  assert.equal(got.source, 'three');
  assert.match(got.note, /importDevice\(\) is not available under Jest/);
});

test('missing globals are named', () => {
  const got = resolveRendererDevice(null, null, { skia: null, webgpu: null });
  assert.equal(got.source, 'three');
  assert.match(got.note, /SkiaApi and RNWebGPU not installed on this runtime/);
});
