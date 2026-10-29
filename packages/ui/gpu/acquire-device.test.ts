// N10, device side: where the app's one GPUDevice comes from under
// EXPO_PUBLIC_WORLD_PHYSICAL. The shared import is driven by
// react-native-webgpu 0.16.0's own Jest mock (lib/commonjs/mock.js, built
// from src/mock.ts), whose importDevice throws because node has no Dawn. The
// mock needs `react-native` only for a View, so that one import is stubbed.
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { acquireSharedOrOwnDevice, parseDeviceFlag, SHARED_GPU_DEVICE } from './acquire-device.ts';

const RN_STUB = 'file:///react-native-stub.cjs';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react-native') return { url: RN_STUB, format: 'commonjs', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === RN_STUB) return { source: 'exports.View = function View() { return null; };', format: 'commonjs', shortCircuit: true };
    return next(url, context);
  },
});

const require = createRequire(import.meta.url);
const webgpuMock = require('react-native-webgpu/lib/commonjs/mock.js') as {
  importDevice: (pointer: bigint) => GPUDevice;
  GPUTextureUsage: GPUTextureUsage;
};

const fakeDevice = (label: string) => ({ label }) as unknown as GPUDevice;
const fakeAdapter = (device: GPUDevice) => ({ requestDevice: async () => device }) as unknown as GPUAdapter;

test('the flag uses the sky-rig truthy table and defaults off', () => {
  for (const on of ['1', 'true', ' On ', 'YES']) assert.equal(parseDeviceFlag(on), true, on);
  for (const off of [undefined, null, '', '0', 'false', 'enabled']) assert.equal(parseDeviceFlag(off), false, String(off));
  assert.equal(SHARED_GPU_DEVICE, parseDeviceFlag(process.env.EXPO_PUBLIC_WORLD_PHYSICAL));
});

test('the imported Skia device is used as is, with no adapter request', async () => {
  const shared = fakeDevice('skia');
  let adapterRequests = 0;
  const got = await acquireSharedOrOwnDevice({
    importShared: async () => shared,
    requestAdapter: async () => {
      adapterRequests++;
      return null;
    },
  });
  assert.equal(got?.device, shared);
  assert.equal(got?.source, 'shared');
  assert.equal(got?.sharedError, null);
  assert.equal(adapterRequests, 0);
});

test("react-native-webgpu's mock importDevice throws, and the own device stands in with the reason kept", async () => {
  const own = fakeDevice('own');
  const got = await acquireSharedOrOwnDevice({
    importShared: async () => webgpuMock.importDevice(1n),
    requestAdapter: async () => fakeAdapter(own),
  });
  assert.equal(got?.device, own);
  assert.equal(got?.source, 'own');
  assert.match(got?.sharedError ?? '', /importDevice\(\) is not available under Jest/);
});

test('no shared device and no adapter is the unsupported case', async () => {
  const got = await acquireSharedOrOwnDevice({
    importShared: async () => webgpuMock.importDevice(1n),
    requestAdapter: async () => null,
  });
  assert.equal(got, null);
});

test('the web and node source refuses to share, so the own path runs there', async () => {
  const { importSharedDevice } = await import('./shared-device-source.ts');
  assert.throws(() => importSharedDevice(), /native only/);
});
