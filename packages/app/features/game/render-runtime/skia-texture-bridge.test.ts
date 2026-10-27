// The Skia texture bridge: label layout, the Skia path on a shared device,
// and the bitmap fallback. Skia and the device are node stand-ins
// (webgpu-mock.test-support.ts); the usage flags are compared against
// react-native-webgpu's own mock constants. N8: nothing here needs a DOM.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { fakeDevice, fakeSkia, webgpuMock } from './webgpu-mock.test-support.ts';
import {
  createSkiaTexture, label, labelRects, labelSize, makeLabelTexture, rasterLabel, SKIA_TEXTURE_FORMAT, SKIA_TEXTURE_USAGE,
  type SkiaInterop,
} from './skia-texture-bridge.ts';
import { GLYPH_HEIGHT, layoutText } from '../world/pixel-font.ts';

const asDevice = (d: ReturnType<typeof fakeDevice>) => d as unknown as GPUDevice;
const asSkia = (s: ReturnType<typeof fakeSkia>) => s as unknown as SkiaInterop;

test('no DOM globals are needed', () => {
  const g = globalThis as Record<string, unknown>;
  assert.equal(g.document, undefined);
  assert.equal(g.window, undefined);
  assert.equal(g.localStorage, undefined);
});

test('texture usage is RENDER_ATTACHMENT | TEXTURE_BINDING | COPY_SRC by the WebGPU constants react-native-webgpu ships', () => {
  const u = webgpuMock.GPUTextureUsage;
  assert.equal(SKIA_TEXTURE_USAGE, u.RENDER_ATTACHMENT | u.TEXTURE_BINDING | u.COPY_SRC);
  assert.equal(SKIA_TEXTURE_FORMAT, 'rgba8unorm');
});

test('a label is sized from the pixel-font layout and is deterministic', () => {
  const spec = label('blade', 'W 125 ST');
  const { width } = layoutText('W 125 ST');
  assert.deepEqual(labelSize(spec), { width: (width + 4) * 4, height: (GLYPH_HEIGHT + 4) * 4 });
  assert.deepEqual(labelRects(spec), labelRects(label('blade', 'W 125 ST')));
  // Every rect sits inside the label, on whole font pixels.
  const { width: w, height: h } = labelSize(spec);
  for (const r of labelRects(spec)) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h, JSON.stringify(r));
    assert.equal(r.x % 4, 0);
    assert.equal(r.h, 4);
  }
});

test('the bitmap fallback holds ground in the margin and ink on lit font pixels', () => {
  const spec = label('blade', 'I');
  const { width, data } = rasterLabel(spec);
  const at = (x: number, y: number) => Array.from(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));
  const byte = (v: number) => Math.round(v * 255);
  assert.deepEqual(at(0, 0), spec.ground.map(byte));
  const first = labelRects(spec)[0]!;
  assert.deepEqual(at(first.x, first.y), spec.ink.map(byte));
});

test('Skia draws into a texture of the shared device, and flush() follows the draw', () => {
  const device = fakeDevice();
  const skia = fakeSkia(device);
  const target = createSkiaTexture({ device: asDevice(device), skia: asSkia(skia), width: 32, height: 16 });
  const created = device.textures[0]!;
  assert.equal(created.desc.usage, SKIA_TEXTURE_USAGE);
  assert.deepEqual(created.desc.size, { width: 32, height: 16 });
  target.draw((canvas) => canvas.clear(Float32Array.from([1, 0, 0, 1])));
  target.draw((canvas) => canvas.clear(Float32Array.from([0, 1, 0, 1])), { sync: true });
  assert.deepEqual(skia.calls, ['MakeFromGPUTexture', 'flush()', 'flush(true)']);
  assert.deepEqual(created.texel, [0, 255, 0, 255]);
  target.dispose();
  assert.equal(created.destroyed, true);
  assert.ok(skia.calls.includes('surface.dispose'));
});

test('on the shared device a label becomes an ExternalTexture over the Skia texture', () => {
  const device = fakeDevice();
  const skia = fakeSkia(device);
  const result = makeLabelTexture(THREE, label('plate', 'NYC 1234'), { device: asDevice(device), deviceSource: 'shared', skia: asSkia(skia) });
  assert.equal(result.path, 'skia');
  assert.equal(result.fallbackReason, null);
  const texture = result.texture as THREE.ExternalTexture;
  assert.equal(texture.isExternalTexture, true);
  assert.equal(texture.sourceTexture, device.textures[0]);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.ok(skia.calls.includes('drawRect'));
  assert.ok(skia.calls.includes('flush()'));
});

test('an own device, a missing Skia API, or a Skia refusal each fall back to the bitmap and say why', () => {
  const device = fakeDevice();
  const other = fakeDevice();
  const spec = label('destination', 'M101 125 ST');
  const own = makeLabelTexture(THREE, spec, { device: asDevice(device), deviceSource: 'own', skia: asSkia(fakeSkia(device)) });
  assert.equal(own.path, 'bitmap');
  assert.match(own.fallbackReason ?? '', /device is own/);
  const noSkia = makeLabelTexture(THREE, spec, { device: asDevice(device), deviceSource: 'shared', skia: null });
  assert.match(noSkia.fallbackReason ?? '', /Skia API not on this runtime/);
  const refused = makeLabelTexture(THREE, spec, { device: asDevice(device), deviceSource: 'shared', skia: asSkia(fakeSkia(other)) });
  assert.equal(refused.path, 'bitmap');
  assert.match(refused.fallbackReason ?? '', /not on the Skia GPUDevice/);
  assert.equal(device.textures[0]?.destroyed, true, 'the refused texture is released');
  const data = refused.texture as THREE.DataTexture;
  assert.equal(data.image.width, labelSize(spec).width);
});
